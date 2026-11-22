import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createElement as h } from "react";
import { describe, expect, it } from "vitest";
import { createFinding, createProject } from "../domain/factories";
import type { PdfImage } from "./markdown";
import { ReportDocument } from "./Report";
import { registerFonts } from "./theme";

registerFonts(resolve(__dirname, "../../public"));

/** A flat PNG of the given size, standing in for a terminal screenshot. */
function png(width: number, height: number): string {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 3, 30);
  row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return `data:image/png;base64,${Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64")}`;
}

/** As in the report that lost one: a tall and a shorter terminal capture. */
const SHOTS = new Map<string, PdfImage>([
  ["tall", { src: png(1380, 760), width: 1380, height: 760 }],
  ["short", { src: png(1380, 500), width: 1380, height: 500 }],
]);

interface Printed {
  /** How many images the report draws. */
  images: number;
  /** Whether the page with the Screenshots heading also has a screenshot. */
  headingKept: boolean;
}

/** What the whole report prints when its finding has this write-up. */
async function print(body: string): Promise<Printed> {
  const project = { ...createProject("Test"), preparedBy: "0xExploitLabs", client: "Repla" };
  const finding = {
    ...createFinding(project.id, 0),
    title: "Bull Board exposed",
    cvss: "6.5",
    body,
  };
  const doc = h(ReportDocument, {
    input: { project, findings: [finding], images: SHOTS, logo: null },
    pages: {},
    collect: {},
  }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await getDocument({ data: new Uint8Array(await renderToBuffer(doc)) }).promise;
  let images = 0;
  let headingKept = false;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const drawn = (await page.getOperatorList()).fnArray.filter(
      (op) => op === OPS.paintImageXObject,
    ).length;
    const text = (await page.getTextContent()).items.map((t) => ("str" in t ? t.str : "")).join("");
    // The heading is letter-spaced, so its letters come out apart.
    if (/screenshots/i.test(text.replace(/\s/g, ""))) headingKept = drawn > 0;
    images += drawn;
  }
  return { images, headingKept };
}

/** Prose, evidence in a code block, then the screenshots, as a finding is written. */
function writeUp(lines: number, screenshots: string): string {
  return [
    "## Description",
    "",
    Array.from({ length: lines }, (_, i) => `Line ${i} of the description.`).join("\n\n"),
    "",
    "```javascript",
    "/var/www/duplex-iptv-backend/",
    "```",
    "",
    "## Screenshots",
    "",
    screenshots,
    "",
    "## Remediation",
    "",
    "- Enforce authentication.",
  ].join("\n");
}

// Wherever the screenshots fall on a page, every one of them is printed, and
// the heading goes with the first. The description grows a line at a time,
// across more than a page.
const POSITIONS = Array.from({ length: 64 }, (_, i) => i);

describe("screenshots in the PDF", () => {
  it.each(POSITIONS)("are all printed, a paragraph each, after %i lines", async (lines) => {
    const printed = await print(writeUp(lines, "![](asset:tall)\n\n![](asset:short)"));
    expect(printed).toEqual({ images: 2, headingKept: true });
  });

  it.each(POSITIONS)("are all printed, in one paragraph, after %i lines", async (lines) => {
    const printed = await print(writeUp(lines, "![](asset:tall)\n![](asset:short)"));
    expect(printed).toEqual({ images: 2, headingKept: true });
  });
});
