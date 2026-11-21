import { describe, expect, it } from "vitest";
import {
  addColumn,
  addRow,
  parseTable,
  removeColumn,
  removeRow,
  serializeTable,
} from "./tableModel";

const SOURCE = `| Target | Notes |
| --- | --- |
| app.example.com | Production |`;

describe("a table as data", () => {
  it("reads the header, the body and nothing of the delimiter row", () => {
    expect(parseTable(SOURCE)).toEqual({
      align: ["", ""],
      rows: [
        ["Target", "Notes"],
        ["app.example.com", "Production"],
      ],
    });
  });

  it("writes back the Markdown it read", () => {
    expect(serializeTable(parseTable(SOURCE))).toBe(SOURCE);
  });

  it("tidies a table written by hand, keeping its alignment", () => {
    const loose = "Name|Score\n:--|--:\nalice|9.8|extra\nbob";
    expect(serializeTable(parseTable(loose))).toBe(
      "| Name | Score |\n| :--- | ---: |\n| alice | 9.8 |\n| bob |  |",
    );
  });

  it("keeps a pipe typed into a cell inside that cell", () => {
    const table = parseTable(SOURCE);
    table.rows[1] = ["a | b", "line one\nline two"];
    const written = serializeTable(table);
    expect(written).toContain("| a \\| b | line one line two |");
    expect(parseTable(written).rows[1]).toEqual(["a | b", "line one line two"]);
  });

  it("is a table from the moment it is inserted, with an empty row to fill", () => {
    const fresh = parseTable("| Column | Column |\n| --- | --- |\n|  |  |");
    expect(fresh.rows).toEqual([
      ["Column", "Column"],
      ["", ""],
    ]);
  });

  it("adds and removes rows and columns, never the header or the last column", () => {
    let table = addRow(parseTable(SOURCE));
    expect(table.rows).toHaveLength(3);
    table = addColumn(table);
    expect(table.rows.map((r) => r.length)).toEqual([3, 3, 3]);
    expect(table.rows[0]?.[2]).toBe("Column");
    table = removeColumn(table, 0);
    expect(table.rows[0]).toEqual(["Notes", "Column"]);
    expect(removeRow(table, 0)).toBe(table);
    expect(removeRow(table, 2).rows).toHaveLength(2);
    const single = removeColumn(table, 0);
    expect(removeColumn(single, 0)).toBe(single);
  });
});
