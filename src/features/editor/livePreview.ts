import { syntaxTree } from "@codemirror/language";
import {
  type EditorState,
  type Extension,
  type Range,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { assetUrl } from "../../data/assets";

/**
 * Live preview, in the manner of Obsidian and Inkdrop: the document stays
 * plain Markdown, but markup is hidden and rendered in place everywhere except
 * the lines being edited. Moving the cursor onto a line reveals its syntax.
 */

const setFocus = StateEffect.define<boolean>();

const focusField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setFocus)) return e.value;
    return value;
  },
});

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-bullet";
    el.textContent = "•";
    return el;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    box.className = "cm-lp-check";
    box.setAttribute("aria-label", this.checked ? "Done" : "Not done");
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? " " : "x" },
      });
    });
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-hr";
    return el;
  }
}

class LabelWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }
  eq(other: LabelWidget) {
    return other.label === this.label;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-codelabel";
    el.textContent = this.label;
    return el;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
  ) {
    super();
  }
  eq(other: ImageWidget) {
    return other.url === this.url && other.alt === this.alt;
  }
  toDOM() {
    const figure = document.createElement("span");
    figure.className = "cm-lp-image";
    const img = document.createElement("img");
    img.alt = this.alt;
    if (this.url.startsWith("asset:")) {
      void assetUrl(this.url.slice(6)).then((src) => {
        if (src) img.src = src;
        else figure.classList.add("is-missing");
      });
    } else if (/^https?:\/\//.test(this.url)) {
      img.src = this.url;
      img.referrerPolicy = "no-referrer";
    }
    figure.append(img);
    if (this.alt) {
      const caption = document.createElement("span");
      caption.className = "cm-lp-caption";
      caption.textContent = this.alt;
      figure.append(caption);
    }
    return figure;
  }
  ignoreEvent() {
    return false;
  }
}

class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly from: number,
  ) {
    super();
  }
  eq(other: TableWidget) {
    return other.source === this.source && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-lp-table";
    const table = document.createElement("table");
    const rows = this.source
      .split("\n")
      .filter(
        (line) => line.trim() && !/^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line),
      );
    rows.forEach((line, r) => {
      const tr = document.createElement("tr");
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split(/(?<!\\)\|/);
      for (const cell of cells) {
        const td = document.createElement(r === 0 ? "th" : "td");
        td.textContent = cell.trim().replace(/\\\|/g, "|").replace(/[*_`]/g, "");
        tr.append(td);
      }
      table.append(tr);
    });
    wrap.append(table);
    wrap.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.from } });
      view.focus();
    });
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

class HintWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-hint";
    el.textContent = "Type / to insert a block";
    return el;
  }
}

const hide = Decoration.replace({});
const bullet = Decoration.replace({ widget: new BulletWidget() });
const hint = Decoration.widget({ widget: new HintWidget(), side: 1 });
const mark = (cls: string) => Decoration.mark({ class: cls });
const line = (cls: string) => Decoration.line({ class: cls });

function activeLines(state: EditorState, focused: boolean): Set<number> {
  const lines = new Set<number>();
  if (!focused) return lines;
  for (const r of state.selection.ranges) {
    const first = state.doc.lineAt(r.from).number;
    const last = state.doc.lineAt(r.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

function overlapsSelection(
  state: EditorState,
  from: number,
  to: number,
  focused: boolean,
): boolean {
  if (!focused) return false;
  return state.selection.ranges.some((r) => r.to >= from && r.from <= to);
}

function build(state: EditorState): DecorationSet {
  const focused = state.field(focusField);
  const active = activeLines(state, focused);
  const { doc } = state;
  const out: Range<Decoration>[] = [];
  const isActive = (pos: number) => active.has(doc.lineAt(pos).number);
  const hideMark = (node: SyntaxNode, trailingSpace = false) => {
    if (isActive(node.from)) return;
    let to = node.to;
    if (trailingSpace && doc.sliceString(to, to + 1) === " ") to += 1;
    if (to > node.from) out.push(hide.range(node.from, to));
  };

  syntaxTree(state).iterate({
    enter: (ref) => {
      const node = ref.node;
      const name = node.name;

      const heading = /^ATXHeading(\d)$/.exec(name);
      if (heading) {
        out.push(line(`cm-lp-h${heading[1]}`).range(doc.lineAt(node.from).from));
        return;
      }
      switch (name) {
        case "HeaderMark":
          if (node.parent?.name.startsWith("ATXHeading")) hideMark(node, true);
          return;
        case "EmphasisMark":
        case "StrikethroughMark":
          hideMark(node);
          return;
        case "Emphasis":
          out.push(mark("cm-lp-em").range(node.from, node.to));
          return;
        case "StrongEmphasis":
          out.push(mark("cm-lp-strong").range(node.from, node.to));
          return;
        case "Strikethrough":
          out.push(mark("cm-lp-strike").range(node.from, node.to));
          return;
        case "InlineCode": {
          out.push(mark("cm-lp-code").range(node.from, node.to));
          if (!isActive(node.from)) {
            for (let c = node.firstChild; c; c = c.nextSibling)
              if (c.name === "CodeMark") hideMark(c);
          }
          return false;
        }
        case "Link": {
          const marks: SyntaxNode[] = [];
          for (let c = node.firstChild; c; c = c.nextSibling)
            if (c.name === "LinkMark") marks.push(c);
          const open = marks[0];
          const close = marks[1];
          if (open && close && close.from > open.to) {
            out.push(mark("cm-lp-link").range(open.to, close.from));
            if (!isActive(node.from)) {
              out.push(hide.range(open.from, open.to));
              out.push(hide.range(close.from, node.to));
            }
          }
          return false;
        }
        case "Image": {
          if (isActive(node.from)) return false;
          const url = node.getChild("URL");
          const marks: SyntaxNode[] = [];
          for (let c = node.firstChild; c; c = c.nextSibling)
            if (c.name === "LinkMark") marks.push(c);
          const alt = marks[0] && marks[1] ? doc.sliceString(marks[0].to, marks[1].from) : "";
          if (url) {
            out.push(
              Decoration.replace({
                widget: new ImageWidget(doc.sliceString(url.from, url.to), alt),
              }).range(node.from, node.to),
            );
          }
          return false;
        }
        case "ListMark": {
          const item = node.parent;
          const isTask = item?.getChild("Task");
          const text = doc.sliceString(node.from, node.to);
          if (isTask) {
            hideMark(node, true);
          } else if (/^[-*+]$/.test(text)) {
            if (!isActive(node.from)) out.push(bullet.range(node.from, node.to));
          } else {
            out.push(mark("cm-lp-num").range(node.from, node.to));
          }
          return;
        }
        case "TaskMarker": {
          if (isActive(node.from)) return;
          const checked = /x/i.test(doc.sliceString(node.from, node.to));
          out.push(
            Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(
              node.from,
              node.to,
            ),
          );
          return;
        }
        case "Blockquote": {
          for (let n = doc.lineAt(node.from).number; n <= doc.lineAt(node.to).number; n++) {
            out.push(line("cm-lp-quote").range(doc.line(n).from));
          }
          return;
        }
        case "QuoteMark":
          hideMark(node, true);
          return;
        case "HorizontalRule":
          if (!isActive(node.from)) {
            out.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
          }
          return;
        case "FencedCode":
        case "CodeBlock": {
          const first = doc.lineAt(node.from).number;
          const last = doc.lineAt(node.to).number;
          const fenced = name === "FencedCode";
          // An unclosed fence runs to the end of the document; its last line is code, not a fence.
          const closer = node.lastChild;
          const closed =
            fenced &&
            last > first &&
            closer?.name === "CodeMark" &&
            closer.from > doc.line(first).to;
          const editing = overlapsSelection(state, node.from, node.to, focused);
          for (let n = first; n <= last; n++) {
            const ln = doc.line(n);
            const opening = fenced && n === first;
            const closing = closed && n === last;
            const classes = ["cm-lp-codeline"];
            if (opening) classes.push("cm-lp-open");
            if (closing) classes.push("cm-lp-close");
            if (!fenced && n === first) classes.push("cm-lp-open", "cm-lp-indented");
            if (!fenced && n === last) classes.push("cm-lp-close");
            if ((opening || closing) && !editing) {
              const info = opening ? node.getChild("CodeInfo") : null;
              const label = info ? doc.sliceString(info.from, info.to) : "";
              if (!label) classes.push("cm-lp-collapsed");
              if (ln.to > ln.from) {
                out.push(
                  label
                    ? Decoration.replace({ widget: new LabelWidget(label) }).range(ln.from, ln.to)
                    : hide.range(ln.from, ln.to),
                );
              }
            }
            out.push(line(classes.join(" ")).range(ln.from));
          }
          return false;
        }
        case "Table": {
          const from = doc.lineAt(node.from).from;
          const to = doc.lineAt(node.to).to;
          if (!overlapsSelection(state, from, to, focused) && from === node.from) {
            out.push(
              Decoration.replace({
                widget: new TableWidget(doc.sliceString(from, to), from),
                block: true,
              }).range(from, to),
            );
          }
          return false;
        }
        default:
          return;
      }
    },
  });

  // A quiet prompt on the empty line being edited.
  if (focused && state.selection.ranges.length === 1) {
    const head = state.selection.main.head;
    const ln = doc.lineAt(head);
    if (ln.length === 0 && state.selection.main.empty && doc.length > 0) {
      const tree = syntaxTree(state).resolveInner(head, 1);
      if (!/Code/.test(tree.name)) out.push(hint.range(head));
    }
  }

  return Decoration.set(out, true);
}

const decorations = StateField.define<DecorationSet>({
  create: (state) => build(state),
  update(value, tr) {
    const focusChanged = tr.effects.some((e) => e.is(setFocus));
    if (
      tr.docChanged ||
      tr.selection ||
      focusChanged ||
      syntaxTree(tr.startState) !== syntaxTree(tr.state)
    ) {
      return build(tr.state);
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function livePreview(): Extension {
  return [
    focusField,
    decorations,
    EditorView.focusChangeEffect.of((_state, focusing) => setFocus.of(focusing)),
  ];
}
