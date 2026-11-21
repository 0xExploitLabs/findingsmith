/**
 * A GFM table as data: read from its Markdown, changed cell by cell, and
 * written back. The editor shows a table as a grid and keeps the Markdown
 * underneath in step with it through these two functions.
 */

export type Align = "" | "left" | "center" | "right";

export interface TableData {
  /** One entry per column. */
  align: Align[];
  /** The header row first, then the body rows; every row has one cell per column. */
  rows: string[][];
}

const DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (/(?<!\\)\|$/.test(text)) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function alignOf(cell: string): Align {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  return left && right ? "center" : right ? "right" : left ? "left" : "";
}

export function parseTable(source: string): TableData {
  const lines = source.split("\n").filter((line) => line.trim());
  const header = splitRow(lines[0] ?? "");
  const second = lines[1] ?? "";
  const hasDelimiter = DELIMITER.test(second);
  const marks = hasDelimiter ? splitRow(second) : [];
  const width = Math.max(1, header.length);
  const fit = (cells: string[]) => Array.from({ length: width }, (_, i) => cells[i] ?? "");
  return {
    align: Array.from({ length: width }, (_, i) => alignOf(marks[i] ?? "")),
    rows: [header, ...lines.slice(hasDelimiter ? 2 : 1).map(splitRow)].map(fit),
  };
}

const MARK: Record<Align, string> = { "": "---", left: ":---", center: ":---:", right: "---:" };

function row(cells: string[]): string {
  const text = cells.map((cell) =>
    cell
      .replace(/\s*\n\s*/g, " ")
      .trim()
      .replace(/\|/g, "\\|"),
  );
  return `| ${text.join(" | ")} |`;
}

export function serializeTable(table: TableData): string {
  const [header = [""], ...body] = table.rows;
  return [
    row(header),
    `| ${header.map((_, i) => MARK[table.align[i] ?? ""]).join(" | ")} |`,
    ...body.map(row),
  ].join("\n");
}

export function addRow(table: TableData, at = table.rows.length): TableData {
  const rows = [...table.rows];
  rows.splice(
    Math.max(1, at),
    0,
    table.align.map(() => ""),
  );
  return { ...table, rows };
}

export function addColumn(table: TableData): TableData {
  return {
    align: [...table.align, ""],
    rows: table.rows.map((cells, r) => [...cells, r === 0 ? "Column" : ""]),
  };
}

/** Without a body row; the header stays, since a table cannot exist without one. */
export function removeRow(table: TableData, at: number): TableData {
  if (at < 1 || at >= table.rows.length) return table;
  return { ...table, rows: table.rows.filter((_, r) => r !== at) };
}

/** Without a column; the last one stays. */
export function removeColumn(table: TableData, at: number): TableData {
  if (table.align.length < 2 || at < 0 || at >= table.align.length) return table;
  return {
    align: table.align.filter((_, c) => c !== at),
    rows: table.rows.map((cells) => cells.filter((_, c) => c !== at)),
  };
}
