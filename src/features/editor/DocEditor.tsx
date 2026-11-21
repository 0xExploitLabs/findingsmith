import {
  autocompletion,
  type Completion,
  CompletionContext,
  type CompletionResult,
  closeCompletion,
  completionStatus,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  deleteMarkupBackward,
  insertNewlineContinueMarkupCommand,
  markdown,
  markdownLanguage,
} from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { search, searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState } from "@codemirror/state";
import { drawSelection, EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import { storeImage } from "../../data/assets";
import { toast } from "../../ui/toast";
import { CODE_LANGUAGES } from "./codeLang";
import { livePreview, type SectionHints } from "./livePreview";
import { focusTable, tableEditing } from "./table";

/**
 * Colours for code inside fenced blocks, from the brand signal colours.
 * Prose styling comes from live preview.
 */
const codeColours = HighlightStyle.define([
  {
    tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword],
    color: "rgb(var(--brand-signal-warn))",
  },
  {
    tag: [t.string, t.special(t.string), t.regexp, t.escape],
    color: "rgb(var(--brand-signal-add))",
  },
  { tag: [t.number, t.bool, t.null, t.atom, t.unit], color: "rgb(var(--brand-signal-drop))" },
  {
    tag: [t.propertyName, t.attributeName, t.labelName, t.tagName, t.url],
    color: "var(--color-accent)",
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.typeName, t.className],
    color: "var(--color-ink)",
    fontWeight: "600",
  },
  { tag: [t.definition(t.variableName), t.variableName], color: "var(--color-ink)" },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.meta],
    color: "var(--color-ink-faint)",
    fontStyle: "italic",
  },
  { tag: [t.operator, t.punctuation, t.bracket, t.separator], color: "var(--color-ink-muted)" },
  { tag: [t.processingInstruction, t.contentSeparator], color: "var(--color-ink-faint)" },
  { tag: [t.heading], fontWeight: "650" },
]);

/** The pattern of a line that opens or closes a backtick fence. */
const FENCE = /^ {0,3}```/;

function fencedCodeAt(state: EditorState, pos: number) {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1);
    node;
    node = node.parent
  ) {
    if (node.name === "FencedCode") return node;
  }
  return null;
}

/**
 * Typing the third backtick of a fence closes the block straight away, so the
 * rest of the document does not turn into code while you write. Typing the
 * closing fence yourself on the line above the automatic one steps over it.
 */
const autoCloseFence = EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== "`" || from !== to) return false;
  const { state } = view;
  const ln = state.doc.lineAt(from);
  const before = state.sliceDoc(ln.from, from);
  if (!/^ {0,3}``$/.test(before) || state.sliceDoc(from, ln.to).trim()) return false;
  const block = fencedCodeAt(state, from);
  if (block) {
    const next = ln.number < state.doc.lines ? state.doc.line(ln.number + 1) : null;
    if (!next || !/^ {0,3}```\s*$/.test(next.text) || next.to !== block.to) return false;
    const removeFrom = Math.max(0, ln.from - 1);
    view.dispatch({
      changes: { from: removeFrom, to: ln.to },
      selection: { anchor: next.to - (ln.to - removeFrom) },
      userEvent: "input.type",
    });
    return true;
  }
  const indent = before.slice(0, -2);
  view.dispatch({
    changes: { from, insert: `\`\n${indent}\`\`\`` },
    selection: { anchor: from + 1 },
    userEvent: "input.type",
  });
  return true;
});

/** Enter on an opening fence with no closing one adds it, as typing the fence would. */
const closeFenceOnEnter: Command = (view) => {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const ln = state.doc.lineAt(sel.head);
  if (sel.head !== ln.to || !FENCE.test(ln.text) || !/^ {0,3}```[\w+#.-]*\s*$/.test(ln.text)) {
    return false;
  }
  const block = fencedCodeAt(state, ln.to);
  if (!block || state.doc.lineAt(block.from).number !== ln.number) return false;
  const closer = block.lastChild;
  const closed = closer?.name === "CodeMark" && closer.from > ln.to;
  if (closed) return false;
  const indent = /^ */.exec(ln.text)?.[0] ?? "";
  view.dispatch({
    changes: { from: ln.to, insert: `\n${indent}\n${indent}\`\`\`` },
    selection: { anchor: ln.to + 1 + indent.length },
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
};

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
  /** The Markdown it stands for, shown at the right of the menu. */
  detail: string;
  insert: string;
  /** Cursor offset inside `insert`; the end when omitted. */
  cursor?: number;
  /** Wraps the cursor inside a line instead of starting a block of its own. */
  inline?: boolean;
  /** A table: it needs clear lines around it, and the caret goes into its first cell. */
  table?: boolean;
  icon: string;
}

/* Icons for the slash menu, as the inside of a 24 by 24 stroked SVG. */
const ICON = {
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  heading: '<path d="M6 12h12M6 20V4M18 20V4"/>',
  rule: '<path d="M4 12h16"/>',
  ordered: '<path d="M10 6h11M10 12h11M10 18h11M4 10V6H3M3 10h2M5 18H3c0-1 2-2 2-3s-1-1.5-2-1"/>',
  bullets: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  checks: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  table: '<path d="M3 4h18v16H3zM3 10h18M3 15h18M10 4v16"/>',
  quote: '<path d="M4 5v14M9 7h11M9 12h11M9 17h7"/>',
  image:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  bold: '<path d="M7 12h8a4 4 0 0 1 0 8H7zM7 4h7a4 4 0 0 1 0 8H7z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  request: '<path d="M3 7h13M12 3l4 4-4 4M21 17H8M12 13l-4 4 4 4"/>',
  terminal: '<path d="m5 8 4 4-4 4M12 16h7"/>',
};

const FORMATTING: Block[] = [
  { label: "Code block", detail: "```", insert: "```\n\n```", cursor: 4, icon: ICON.code },
  { label: "Heading 1", detail: "#", insert: "# ", icon: ICON.heading },
  { label: "Heading 2", detail: "##", insert: "## ", icon: ICON.heading },
  { label: "Heading 3", detail: "###", insert: "### ", icon: ICON.heading },
  { label: "Heading 4", detail: "####", insert: "#### ", icon: ICON.heading },
  { label: "Horizontal rule", detail: "---", insert: "---\n", icon: ICON.rule },
  { label: "Ordered list", detail: "1.", insert: "1. ", icon: ICON.ordered },
  { label: "Bulleted list", detail: "-", insert: "- ", icon: ICON.bullets },
  { label: "Task list", detail: "- [ ]", insert: "- [ ] ", icon: ICON.checks },
  {
    label: "Table",
    detail: "2 by 2",
    insert: "| Column | Column |\n| --- | --- |\n|  |  |",
    table: true,
    icon: ICON.table,
  },
  { label: "Quote", detail: ">", insert: "> ", icon: ICON.quote },
  { label: "Bold", detail: "**", insert: "****", cursor: 2, inline: true, icon: ICON.bold },
  { label: "Italic", detail: "_", insert: "__", cursor: 1, inline: true, icon: ICON.italic },
  { label: "Inline code", detail: "`", insert: "``", cursor: 1, inline: true, icon: ICON.code },
  {
    label: "Link",
    detail: "[ ]( )",
    insert: "[](https://)",
    cursor: 1,
    inline: true,
    icon: ICON.link,
  },
];

/** A code block in each language, so "/bash" or "/json" is all it takes. */
const CODE: Block[] = CODE_LANGUAGES.map((l) => ({
  label: `${l.label} code`,
  detail: `\`\`\`${l.id}`,
  insert: `\`\`\`${l.id}\n\n\`\`\``,
  cursor: l.id.length + 4,
  icon: l.id === "http" ? ICON.request : l.id === "bash" ? ICON.terminal : ICON.code,
}));

const EVIDENCE: Block[] = [
  {
    label: "Request and response",
    detail: "two blocks",
    insert: "```http\nGET / HTTP/1.1\nHost: \n```\n\n```http\nHTTP/1.1 200 OK\n\n```",
    cursor: 29,
    icon: ICON.request,
  },
];

/* The formatting entries come first and need no heading of their own. */
const SECTIONS = {
  code: { name: "Code blocks", rank: 1 },
  evidence: { name: "Evidence", rank: 2 },
};

/**
 * Puts a table where the slash command was typed and the caret in its first
 * cell. A table takes every line that follows it as a row, so it is given an
 * empty line on both sides.
 */
function insertTable(view: EditorView, from: number, to: number, table: string) {
  const { doc } = view.state;
  const line = doc.lineAt(from);
  const above = line.number > 1 ? doc.line(line.number - 1).text : "";
  const below = line.number < doc.lines ? doc.line(line.number + 1).text : "";
  const lead = /\S/.test(line.text.slice(0, from - line.from)) ? "\n\n" : above.trim() ? "\n" : "";
  const tail = `${doc.sliceString(to, line.to).trim() ? "\n\n" : ""}${below.trim() ? "\n" : ""}`;
  view.dispatch({ changes: { from, to, insert: lead + table + tail }, userEvent: "input" });
  focusTable(view, from + lead.length);
}

/** The icon of a slash-menu entry, kept beside the completion it belongs to. */
const icons = new WeakMap<Completion, string>();

/**
 * The menu behind "/": every block and inline format with its icon and the
 * Markdown it stands for, filtered as you type. It opens at the start of a
 * line or after a space, and never inside code.
 */
function slashMenu(onImage: () => void) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const word = ctx.matchBefore(/(?:^|\s)\/[\w ]*$/);
    if (!word) return null;
    for (let node = syntaxTree(ctx.state).resolveInner(ctx.pos, -1); ; ) {
      if (/Code/.test(node.name)) return null;
      if (!node.parent) break;
      node = node.parent;
    }
    const slash = word.from + word.text.indexOf("/");
    const line = ctx.state.doc.lineAt(slash);
    const midLine = /\S/.test(line.text.slice(0, slash - line.from));
    const entry = (b: Block, section: Completion["section"], i: number): Completion => {
      const completion: Completion = {
        label: b.label,
        detail: b.detail,
        section,
        // Keep the menu in this order instead of alphabetical.
        boost: 60 - i,
        apply: (view, _c, _from, to) => {
          if (b.table) return insertTable(view, slash, to, b.insert);
          // A block asked for in the middle of a line starts on a line of its own.
          const lead = midLine && !b.inline ? "\n" : "";
          // One of several lines keeps the text after the cursor on a line of its own.
          const rest = view.state.sliceDoc(to, view.state.doc.lineAt(to).to);
          const tail = b.insert.includes("\n") && rest.trim() ? "\n" : "";
          view.dispatch({
            changes: { from: slash, to, insert: lead + b.insert + tail },
            selection: { anchor: slash + lead.length + (b.cursor ?? b.insert.length) },
          });
        },
      };
      icons.set(completion, b.icon);
      return completion;
    };
    const image: Completion = {
      label: "Image",
      detail: "or paste",
      section: SECTIONS.evidence,
      boost: 0,
      apply: (view, _c, _from, to) => {
        view.dispatch({ changes: { from: slash, to, insert: "" } });
        onImage();
      },
    };
    icons.set(image, ICON.image);
    const options = [
      ...FORMATTING.map((b, i) => entry(b, undefined, i)),
      ...CODE.map((b, i) => entry(b, SECTIONS.code, FORMATTING.length + i)),
      ...EVIDENCE.map((b, i) => entry(b, SECTIONS.evidence, FORMATTING.length + CODE.length + i)),
      image,
    ];
    return { from: slash + 1, options, filter: true, validFor: /^[\w ]*$/ };
  };
}

/**
 * Enter straight after a slash command takes its entry even when the menu has
 * not had time to open: "/table" and Enter typed in one go must give a table,
 * not a new line. It picks what the menu would list first: the first entry
 * whose name starts with what was typed, or failing that has a word that does.
 */
function takeSlashCommand(source: ReturnType<typeof slashMenu>): Command {
  return (view) => {
    const { state } = view;
    const sel = state.selection.main;
    // Only while the menu is on its way: an open one takes Enter itself, and
    // one dismissed with Escape leaves the text as it was typed.
    if (!sel.empty || completionStatus(state) !== "pending") return false;
    const result = source(new CompletionContext(state, sel.head, true));
    if (!result) return false;
    const typed = state.sliceDoc(result.from, sel.head).trim().toLowerCase();
    if (!typed) return false;
    const names = result.options.map((o) => o.label.toLowerCase());
    let at = names.findIndex((name) => name.startsWith(typed));
    if (at < 0) at = names.findIndex((name) => name.split(" ").some((w) => w.startsWith(typed)));
    const option = result.options[at];
    if (!option || typeof option.apply !== "function") return false;
    closeCompletion(view);
    option.apply(view, option, result.from, sel.head);
    return true;
  };
}

/** Draws an entry's icon at the start of its row. */
function renderIcon(completion: Completion): HTMLElement {
  const box = document.createElement("span");
  box.className = "cm-slash-icon";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons.get(completion) ?? ""}</svg>`;
  return box;
}

/** Lets the page around the editor add to the document. */
export interface DocController {
  /** Appends a `## title` section and puts the cursor under it. */
  addSection: (title: string) => void;
}

export function DocEditor({
  value,
  onChange,
  projectId,
  placeholder,
  label,
  autoFocus,
  controller,
  hints,
}: {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
  controller?: React.RefObject<DocController | null>;
  /** What to write under each `##` heading while its section is empty, by heading. */
  hints?: SectionHints;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fileInput = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: created once per document; later value changes are synced below
  useEffect(() => {
    if (!host.current) return;
    const slash = slashMenu(() => fileInput.current?.click());
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
          livePreview(hints),
          tableEditing(),
          autoCloseFence,
          search({ top: true }),
          autocompletion({
            override: [slash],
            icons: false,
            closeOnBlur: true,
            addToOptions: [{ render: renderIcon, position: 20 }],
            maxRenderedOptions: 60,
            // The menu is asked for by typing "/", so nothing guards against it.
            activateOnTypingDelay: 0,
            interactionDelay: 0,
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
            { key: "Enter", run: takeSlashCommand(slash) },
            { key: "Enter", run: closeFenceOnEnter },
            { key: "Enter", run: insertNewlineContinueMarkupCommand({ nonTightLists: false }) },
            { key: "Backspace", run: deleteMarkupBackward },
            { key: "Mod-b", run: wrap("**") },
            { key: "Mod-i", run: wrap("_") },
            { key: "Mod-e", run: wrap("`", "`", "code") },
            // Mod-k opens search everywhere in the workspace, so the link moves beside it.
            { key: "Mod-Shift-k", run: link, preventDefault: true },
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
    if (controller) {
      controller.current = {
        addSection(title) {
          const text = v.state.doc.toString();
          const end = text.length;
          const sep = !text.trim()
            ? ""
            : text.endsWith("\n\n")
              ? ""
              : text.endsWith("\n")
                ? "\n"
                : "\n\n";
          const insert = `${sep}## ${title}\n\n`;
          v.dispatch({
            changes: { from: end, insert },
            selection: { anchor: end + insert.length },
            scrollIntoView: true,
          });
          v.focus();
        },
      };
    }
    if (autoFocus) v.focus();
    return () => {
      v.destroy();
      view.current = null;
      if (controller) controller.current = null;
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
