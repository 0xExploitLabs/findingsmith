import { redo, undo } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import { EditorView, keymap, WidgetType } from "@codemirror/view";
import {
  addColumn,
  addRow,
  parseTable,
  removeColumn,
  removeRow,
  serializeTable,
  type TableData,
} from "./tableModel";

/**
 * A table is always shown as a grid whose cells are edited in place: the pipes
 * of its Markdown are never on screen. Every edit rewrites the table's Markdown
 * in the document, so undo, saving and the PDF all see ordinary Markdown.
 */

interface Mounted {
  source: string;
  data: TableData;
  /** The cell that last had the caret, for the row and column buttons. */
  at: [row: number, column: number];
}

const mounted = new WeakMap<HTMLElement, Mounted>();

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  row: '<path d="M3 5h18M3 19h18M9 12h6"/>',
  column: '<path d="M5 3v18M19 3v18M9 12h6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};

function icon(inner: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

function cellAt(wrap: HTMLElement, r: number, c: number): HTMLElement | null {
  return wrap.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
}

function caretTo(cell: HTMLElement, where: "start" | "end" | "all") {
  cell.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  if (where !== "all") range.collapse(where === "start");
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** Where the caret is inside a cell, as "at the start" and "at the end". */
function caretEdges(cell: HTMLElement): { start: boolean; end: boolean } {
  const selection = getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return { start: false, end: false };
  const before = document.createRange();
  before.selectNodeContents(cell);
  before.setEnd(selection.focusNode ?? cell, selection.focusOffset);
  const offset = before.toString().length;
  return { start: offset === 0, end: offset >= (cell.textContent ?? "").length };
}

function readCells(wrap: HTMLElement, data: TableData): TableData {
  return {
    align: data.align,
    rows: data.rows.map((cells, r) =>
      cells.map((_, c) => (cellAt(wrap, r, c)?.textContent ?? "").replace(/\s*\n\s*/g, " ")),
    ),
  };
}

function draw(wrap: HTMLElement, view: EditorView, source: string) {
  const data = parseTable(source);
  const state: Mounted = { source, data, at: mounted.get(wrap)?.at ?? [0, 0] };
  mounted.set(wrap, state);
  wrap.textContent = "";

  const grid = document.createElement("div");
  grid.className = "cm-lp-table-grid";
  const table = document.createElement("table");
  data.rows.forEach((cells, r) => {
    const tr = document.createElement("tr");
    cells.forEach((text, c) => {
      const cell = document.createElement(r === 0 ? "th" : "td");
      cell.contentEditable = "true";
      cell.spellcheck = false;
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.setAttribute(
        "aria-label",
        r === 0 ? `Column ${c + 1} heading` : `Row ${r}, column ${c + 1}`,
      );
      const align = data.align[c];
      if (align) cell.style.textAlign = align;
      cell.textContent = text;
      tr.append(cell);
    });
    table.append(tr);
  });

  const button = (cls: string, label: string, svg: string, run: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cm-lp-table-btn ${cls}`.trim();
    b.title = label;
    b.setAttribute("aria-label", label);
    b.innerHTML = icon(svg);
    // Keep the caret where it is, so the action knows its row and column.
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", run);
    return b;
  };

  const tools = document.createElement("div");
  tools.className = "cm-lp-table-tools";
  tools.append(
    button("", "Delete row", ICONS.row, () => {
      const [r, c] = current(wrap).at;
      if (r === 0) return;
      const next = removeRow(readCells(wrap, current(wrap).data), r);
      commit(wrap, view, next, [Math.min(r, next.rows.length - 1), c]);
    }),
    button("", "Delete column", ICONS.column, () => {
      const [r, c] = current(wrap).at;
      const next = removeColumn(readCells(wrap, current(wrap).data), c);
      commit(wrap, view, next, [r, Math.min(c, next.align.length - 1)]);
    }),
    button("", "Delete table", ICONS.trash, () => removeTable(wrap, view)),
  );

  // Under the table: a strip that adds a row, and the delete actions while a cell has the caret.
  const foot = document.createElement("div");
  foot.className = "cm-lp-table-foot";
  foot.append(
    button("cm-lp-table-add", "Add row", ICONS.plus, () => {
      const next = addRow(readCells(wrap, current(wrap).data));
      commit(wrap, view, next, [next.rows.length - 1, 0]);
    }),
    tools,
  );
  grid.append(
    table,
    button("cm-lp-table-add cm-lp-table-add-col", "Add column", ICONS.plus, () => {
      const next = addColumn(readCells(wrap, current(wrap).data));
      commit(wrap, view, next, [0, next.align.length - 1], "all");
    }),
    foot,
  );
  wrap.append(grid);
}

function current(wrap: HTMLElement): Mounted {
  const state = mounted.get(wrap);
  if (!state) throw new Error("Table widget is not mounted");
  return state;
}

/** Brings the grid in line with new Markdown, keeping the caret when the shape is the same. */
function sync(wrap: HTMLElement, view: EditorView, source: string) {
  const state = mounted.get(wrap);
  if (!state) return draw(wrap, view, source);
  if (state.source === source) return;
  const data = parseTable(source);
  const sameShape =
    data.rows.length === state.data.rows.length &&
    data.align.length === state.data.align.length &&
    data.align.every((a, i) => a === state.data.align[i]);
  if (!sameShape) return draw(wrap, view, source);
  state.source = source;
  state.data = data;
  data.rows.forEach((cells, r) => {
    cells.forEach((text, c) => {
      const cell = cellAt(wrap, r, c);
      if (!cell || (cell.textContent ?? "") === text) return;
      const focused = document.activeElement === cell;
      // A cell being typed in holds what was typed; only its outer spaces differ.
      if (focused && (cell.textContent ?? "").trim() === text) return;
      cell.textContent = text;
      if (focused) caretTo(cell, "end");
    });
  });
}

function tableAt(view: EditorView, pos: number): HTMLElement | null {
  for (const el of view.contentDOM.querySelectorAll<HTMLElement>(".cm-lp-table")) {
    if (view.posAtDOM(el) === pos) return el;
  }
  return null;
}

/** Writes the table back as Markdown, then puts the caret in the given cell. */
function commit(
  wrap: HTMLElement,
  view: EditorView,
  data: TableData,
  focus?: [number, number],
  select: "start" | "end" | "all" = "end",
) {
  const state = current(wrap);
  const from = view.posAtDOM(wrap);
  const next = serializeTable(data);
  if (next !== state.source) {
    view.dispatch({
      changes: { from, to: from + state.source.length, insert: next },
      userEvent: "input",
    });
  }
  if (!focus) return;
  const cell = cellAt(tableAt(view, from) ?? wrap, focus[0], focus[1]);
  if (cell) caretTo(cell, select);
}

function removeTable(wrap: HTMLElement, view: EditorView) {
  const from = view.posAtDOM(wrap);
  const to = from + current(wrap).source.length;
  view.dispatch({ changes: { from, to }, selection: { anchor: from }, userEvent: "delete" });
  view.focus();
}

/**
 * Leaves the table for the text around it. Below, the cursor lands on a line
 * that a blank line separates from the table: a line straight after a table
 * would be read as one more row of it.
 */
function leave(wrap: HTMLElement, view: EditorView, side: "before" | "after") {
  const { doc } = view.state;
  const from = view.posAtDOM(wrap);
  if (side === "before") {
    if (from === 0)
      view.dispatch({ changes: { from: 0, insert: "\n\n" }, selection: { anchor: 0 } });
    else {
      const above = doc.lineAt(from - 1);
      if (above.length === 0 && above.from > 0) {
        view.dispatch({ selection: { anchor: above.from - 1 }, scrollIntoView: true });
      } else {
        view.dispatch({ selection: { anchor: above.to }, scrollIntoView: true });
      }
    }
    view.focus();
    return;
  }
  const end = from + current(wrap).source.length;
  const last = doc.lineAt(end);
  const gap = last.number < doc.lines ? doc.line(last.number + 1) : null;
  const target = gap && gap.number < doc.lines ? doc.line(gap.number + 1) : null;
  if (gap && gap.length === 0 && target) {
    // Onto the next empty line; before text, onto the gap, where typing starts a paragraph.
    const anchor = target.length === 0 ? target.from : gap.from;
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
  } else if (gap && gap.length === 0) {
    view.dispatch({
      changes: { from: gap.to, insert: "\n" },
      selection: { anchor: gap.to + 1 },
      scrollIntoView: true,
    });
  } else {
    view.dispatch({
      changes: { from: end, insert: "\n\n" },
      selection: { anchor: end + 2 },
      scrollIntoView: true,
    });
  }
  view.focus();
}

function onKey(e: KeyboardEvent, wrap: HTMLElement, view: EditorView) {
  const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-r]");
  if (!cell || e.isComposing) return;
  const state = current(wrap);
  const r = Number(cell.dataset.r);
  const c = Number(cell.dataset.c);
  const rows = state.data.rows.length;
  const columns = state.data.align.length;
  const mod = e.ctrlKey || e.metaKey;
  const go = (row: number, column: number, where: "start" | "end" | "all" = "all") => {
    const target = cellAt(wrap, row, column);
    if (target) caretTo(target, where);
  };
  const handled = () => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (mod && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
    handled();
    if (e.key.toLowerCase() === "y" || e.shiftKey) redo(view);
    else undo(view);
    // Undoing the table itself leaves no cell to be in: the caret goes back to the text.
    if (!wrap.isConnected) view.focus();
  } else if (e.key === "Escape" || (mod && e.key === "Enter")) {
    handled();
    leave(wrap, view, "after");
  } else if (e.key === "Tab") {
    handled();
    const index = r * columns + c + (e.shiftKey ? -1 : 1);
    if (index < 0) leave(wrap, view, "before");
    else if (index >= rows * columns) {
      commit(wrap, view, addRow(readCells(wrap, state.data)), [rows, 0]);
    } else go(Math.floor(index / columns), index % columns);
  } else if (e.key === "Enter") {
    handled();
    if (r + 1 < rows) go(r + 1, c);
    else commit(wrap, view, addRow(readCells(wrap, state.data)), [rows, c]);
  } else if (e.key === "ArrowDown" && !e.shiftKey) {
    handled();
    if (r + 1 < rows) go(r + 1, c, "end");
    else leave(wrap, view, "after");
  } else if (e.key === "ArrowUp" && !e.shiftKey) {
    handled();
    if (r > 0) go(r - 1, c, "end");
    else leave(wrap, view, "before");
  } else if (e.key === "ArrowLeft" && !e.shiftKey && !mod && caretEdges(cell).start) {
    if (r === 0 && c === 0) return;
    handled();
    const index = r * columns + c - 1;
    go(Math.floor(index / columns), index % columns, "end");
  } else if (e.key === "ArrowRight" && !e.shiftKey && !mod && caretEdges(cell).end) {
    if (r === rows - 1 && c === columns - 1) return;
    handled();
    const index = r * columns + c + 1;
    go(Math.floor(index / columns), index % columns, "start");
  } else if (e.key === "Backspace" && !(cell.textContent ?? "")) {
    // Backspace in an empty row takes the row away; in an empty table, the table.
    const live = readCells(wrap, state.data);
    if (!live.rows[r]?.every((text) => !text.trim())) return;
    handled();
    if (r > 0) commit(wrap, view, removeRow(live, r), [r - 1, c]);
    else if (rows === 1) removeTable(wrap, view);
  }
}

export class TableWidget extends WidgetType {
  constructor(readonly source: string) {
    super();
  }
  eq(other: TableWidget) {
    return other.source === this.source;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-lp-table";
    draw(wrap, view, this.source);
    wrap.addEventListener("keydown", (e) => onKey(e, wrap, view));
    wrap.addEventListener("input", () => {
      const state = current(wrap);
      commit(wrap, view, readCells(wrap, state.data));
    });
    wrap.addEventListener("focusin", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-r]");
      if (cell) current(wrap).at = [Number(cell.dataset.r), Number(cell.dataset.c)];
    });
    // Cells hold plain text: pasted formatting and line breaks are dropped.
    wrap.addEventListener("paste", (e) => {
      if (!(e.target as HTMLElement).closest("[data-r]")) return;
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\s*\n\s*/g, " ");
      document.execCommand("insertText", false, text);
    });
    wrap.addEventListener("drop", (e) => e.preventDefault());
    return wrap;
  }
  updateDOM(dom: HTMLElement, view: EditorView) {
    sync(dom, view, this.source);
    return true;
  }
  get estimatedHeight() {
    return 44 * this.source.split("\n").length;
  }
  ignoreEvent() {
    return true;
  }
}

/** The table whose Markdown ends at `pos`, when it stands at the start of its lines. */
function tableEndingAt(state: EditorState, pos: number): { from: number; to: number } | null {
  for (let node = syntaxTree(state).resolveInner(pos, -1); ; node = node.parent as typeof node) {
    if (node.name === "Table") {
      const to = state.doc.lineAt(node.to).to;
      return to === pos && state.doc.lineAt(node.from).from === node.from
        ? { from: node.from, to }
        : null;
    }
    if (!node.parent) return null;
  }
}

/** Puts the caret in a cell of the table that starts at `pos`. */
export function focusTable(
  view: EditorView,
  pos: number,
  cell: "first" | "last" = "first",
  select: "start" | "end" | "all" = "all",
): boolean {
  const wrap = tableAt(view, pos);
  const state = wrap ? mounted.get(wrap) : null;
  if (!wrap || !state) return false;
  const target = cellAt(wrap, cell === "first" ? 0 : state.data.rows.length - 1, 0);
  if (!target) return false;
  caretTo(target, select);
  return true;
}

/** Arrow keys walk from the text into a table instead of jumping over it. */
function step(view: EditorView, forward: boolean): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const here = state.doc.lineAt(sel.head);
  if (state.doc.lineAt(view.moveVertically(sel, forward).head).number === here.number) return false;
  if (forward) {
    if (here.number === state.doc.lines) return false;
    return focusTable(view, state.doc.line(here.number + 1).from, "first", "end");
  }
  if (here.number === 1) return false;
  const table = tableEndingAt(state, state.doc.line(here.number - 1).to);
  return table ? focusTable(view, table.from, "last", "end") : false;
}

/**
 * Text typed on the line straight under a table would become a row of it and
 * vanish into the grid, so that line is kept empty: typing there starts a
 * paragraph one line further down, and Backspace cannot pull text up into it.
 */
const keepGap = EditorView.inputHandler.of((view, from, to, text) => {
  if (from !== to || !text.trim()) return false;
  const { state } = view;
  const line = state.doc.lineAt(from);
  if (line.length > 0 || line.number === 1) return false;
  if (!tableEndingAt(state, state.doc.line(line.number - 1).to)) return false;
  // The new paragraph gets an empty line below it too, when text follows.
  const below = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null;
  view.dispatch({
    changes: { from, insert: `\n${text}${below?.length ? "\n" : ""}` },
    selection: { anchor: from + 1 + text.length },
    userEvent: "input.type",
  });
  return true;
});

function guardBackspace(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.from || line.length === 0 || line.number < 3) return false;
  const gap = state.doc.line(line.number - 1);
  if (gap.length > 0) return false;
  return !!tableEndingAt(state, state.doc.line(line.number - 2).to);
}

export function tableEditing(): Extension {
  return [
    keepGap,
    keymap.of([
      { key: "ArrowDown", run: (view) => step(view, true) },
      { key: "ArrowUp", run: (view) => step(view, false) },
      { key: "Backspace", run: guardBackspace },
    ]),
  ];
}
