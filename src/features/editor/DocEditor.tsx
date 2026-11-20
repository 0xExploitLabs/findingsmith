import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  deleteMarkupBackward,
  insertNewlineContinueMarkupCommand,
  markdown,
  markdownLanguage,
} from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { search, searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState } from "@codemirror/state";
import { drawSelection, EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import { storeImage } from "../../data/assets";
import { toast } from "../../ui/toast";
import { livePreview } from "./livePreview";

/** Colours for code inside fenced blocks; prose styling comes from live preview. */
const codeColours = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword], color: "rgb(var(--brand-signal-warn))" },
  { tag: [t.string, t.attributeName, t.special(t.string)], color: "var(--color-accent)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "rgb(var(--brand-signal-drop))" },
  { tag: [t.comment, t.meta], color: "var(--color-ink-faint)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.typeName, t.className, t.tagName], fontWeight: "600" },
  { tag: [t.processingInstruction, t.contentSeparator], color: "var(--color-ink-faint)" },
  { tag: [t.url], color: "var(--color-accent)" },
]);

type Command = (view: EditorView) => boolean;

/** Wraps the selection in a marker, or unwraps it when it is already wrapped. */
function wrap(before: string, after = before, fallback = "text"): Command {
  return (view) => {
    view.dispatch(
      view.state.changeByRange((range) => {
        const outerFrom = range.from - before.length;
        const outerTo = range.to + after.length;
        if (
          outerFrom >= 0 &&
          view.state.sliceDoc(outerFrom, range.from) === before &&
          view.state.sliceDoc(range.to, outerTo) === after
        ) {
          return {
            changes: [
              { from: outerFrom, to: range.from, insert: "" },
              { from: range.to, to: outerTo, insert: "" },
            ],
            range: EditorSelection.range(outerFrom, range.to - before.length),
          };
        }
        const body = view.state.sliceDoc(range.from, range.to) || fallback;
        return {
          changes: { from: range.from, to: range.to, insert: `${before}${body}${after}` },
          range: EditorSelection.range(
            range.from + before.length,
            range.from + before.length + body.length,
          ),
        };
      }),
    );
    return true;
  };
}

const link: Command = (view) => {
  const { from, to } = view.state.selection.main;
  const text = view.state.sliceDoc(from, to);
  if (/^https?:\/\/\S+$/.test(text)) {
    view.dispatch({
      changes: { from, to, insert: `[](${text})` },
      selection: { anchor: from + 1 },
    });
  } else {
    const label = text || "link text";
    const insert = `[${label}](https://)`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + label.length + 3, head: from + insert.length - 1 },
    });
  }
  return true;
};

async function insertImages(view: EditorView, projectId: string, files: File[], pos?: number) {
  const images = files.filter((f) => f.type.startsWith("image/"));
  if (images.length === 0) return;
  try {
    const refs: string[] = [];
    for (const file of images) {
      const asset = await storeImage(projectId, file, file.name);
      // No alt text by default: whatever is typed between the brackets becomes the caption.
      refs.push(`![](asset:${asset.id})`);
    }
    const at = pos ?? view.state.selection.main.head;
    const ln = view.state.doc.lineAt(at);
    const before = ln.text.trim() ? "\n\n" : "";
    const insert = `${before}${refs.join("\n\n")}\n`;
    const from = ln.text.trim() ? ln.to : at;
    view.dispatch({ changes: { from, insert }, selection: { anchor: from + insert.length } });
    view.focus();
  } catch (err) {
    toast(`Could not add image: ${err instanceof Error ? err.message : String(err)}`, "error");
  }
}

interface Block {
  label: string;
  detail: string;
  insert: string;
  /** Cursor offset inside `insert`; the end when omitted. */
  cursor?: number;
}

const BLOCKS: Block[] = [
  { label: "Heading", detail: "##", insert: "## " },
  { label: "Subheading", detail: "###", insert: "### " },
  { label: "HTTP request", detail: "```http", insert: "```http\n\n```", cursor: 8 },
  { label: "Code block", detail: "```", insert: "```\n\n```", cursor: 4 },
  { label: "Numbered list", detail: "1.", insert: "1. " },
  { label: "Bulleted list", detail: "-", insert: "- " },
  { label: "Checklist", detail: "- [ ]", insert: "- [ ] " },
  {
    label: "Table",
    detail: "| |",
    insert: "| Column | Column |\n| --- | --- |\n|  |  |",
    cursor: 36,
  },
  { label: "Quote", detail: ">", insert: "> " },
  { label: "Divider", detail: "---", insert: "---\n" },
];

function slashMenu(onImage: () => void) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const word = ctx.matchBefore(/^\s*\/[\w ]*$/);
    if (!word) return null;
    const slash = word.from + word.text.indexOf("/");
    const options: Completion[] = [
      ...BLOCKS.map(
        (b, i): Completion => ({
          label: b.label,
          detail: b.detail,
          type: "text",
          // Keep the menu in this order instead of alphabetical.
          boost: 50 - i,
          apply: (view, _c, _from, to) => {
            view.dispatch({
              changes: { from: slash, to, insert: b.insert },
              selection: { anchor: slash + (b.cursor ?? b.insert.length) },
            });
          },
        }),
      ),
      {
        label: "Image",
        detail: "or paste",
        type: "text",
        boost: 50 - BLOCKS.length,
        apply: (view, _c, _from, to) => {
          view.dispatch({ changes: { from: slash, to, insert: "" } });
          onImage();
        },
      },
    ];
    return { from: slash + 1, options, filter: true, validFor: /^[\w ]*$/ };
  };
}

export function DocEditor({
  value,
  onChange,
  projectId,
  placeholder,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fileInput = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: created once per document; later value changes are synced below
  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false }),
          syntaxHighlighting(codeColours),
          livePreview(),
          search({ top: true }),
          autocompletion({
            override: [slashMenu(() => fileInput.current?.click())],
            icons: false,
            closeOnBlur: true,
          }),
          placeholderExt(placeholder ?? ""),
          EditorView.contentAttributes.of({
            spellcheck: "false",
            autocorrect: "off",
            autocapitalize: "off",
            "aria-label": label,
          }),
          keymap.of([
            // Enter on an empty list item ends the list, as in Obsidian.
            { key: "Enter", run: insertNewlineContinueMarkupCommand({ nonTightLists: false }) },
            { key: "Backspace", run: deleteMarkupBackward },
            { key: "Mod-b", run: wrap("**") },
            { key: "Mod-i", run: wrap("_") },
            { key: "Mod-e", run: wrap("`", "`", "code") },
            { key: "Mod-k", run: link },
            { key: "Mod-Shift-x", run: wrap("~~") },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            paste(event, ev) {
              const files = [...(event.clipboardData?.files ?? [])];
              if (!files.some((f) => f.type.startsWith("image/"))) return false;
              event.preventDefault();
              void insertImages(ev, projectId, files);
              return true;
            },
            drop(event, ev) {
              const files = [...(event.dataTransfer?.files ?? [])];
              if (!files.some((f) => f.type.startsWith("image/"))) return false;
              event.preventDefault();
              const pos = ev.posAtCoords({ x: event.clientX, y: event.clientY }) ?? undefined;
              void insertImages(ev, projectId, files, pos);
              return true;
            },
          }),
        ],
      }),
    });
    view.current = v;
    if (autoFocus) v.focus();
    return () => {
      v.destroy();
      view.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div className="doc-editor">
      <div ref={host} />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          const v = view.current;
          if (v) void insertImages(v, projectId, files);
        }}
      />
    </div>
  );
}
