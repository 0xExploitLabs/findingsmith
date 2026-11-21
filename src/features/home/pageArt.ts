import { SEVERITY_HEX } from "../../domain/severity";
import { INK, MUTED, PAPER, RULE, SYNTAX, tint, WASH } from "../../pdf/palette";

/** One block of the drawing: position and size in page units, a colour and an opacity. */
export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  o?: number;
}

/* The sample finding's page drawn in blocks, 60 units by 84. A unit is about
   ten PDF points, so each part sits where src/pdf/Report.tsx prints it and the
   drawing can cross-fade into the typeset page. Words are blocks of their own,
   and the score is set in a three by five pixel face. */
export const ART = { width: 60, height: 84 };
/** The middle of the score's digits, as fractions of the page: where the view flies in. */
export const FOCUS = { x: 9.25 / ART.width, y: 15.35 / ART.height };
/** The digits' size as fractions of the page, for choosing how far to zoom. */
export const FOCUS_SIZE = { w: 4.5 / ART.width, h: 2.5 / ART.height };

const RED = SEVERITY_HEX.Critical;
const TEAL = "#036877";
const LEFT = 6;
const WIDTH = 48;

const DIGITS: Record<string, string[]> = {
  "9": ["111", "101", "111", "001", "111"],
  "8": ["111", "101", "111", "101", "111"],
  ".": ["0", "0", "0", "0", "1"],
};

/** A run of words as blocks, wrapped at the column's edge. Returns the blocks and the next line's y. */
function words(
  x: number,
  y: number,
  widths: number[],
  { h = 0.7, fill = INK, o = 0.5, gap = 0.6, pitch = 1.5, max = LEFT + WIDTH } = {},
): { blocks: Block[]; y: number } {
  const blocks: Block[] = [];
  let cx = x;
  let cy = y;
  for (const w of widths) {
    if (cx + w > max) {
      cx = x;
      cy += pitch;
    }
    blocks.push({ x: cx, y: cy, w, h, fill, o });
    cx += w + gap;
  }
  return { blocks, y: cy + pitch };
}

function label(y: number, w: number): Block {
  return { x: LEFT, y, w, h: 0.6, fill: TEAL };
}

function build(): Block[] {
  const out: Block[] = [];
  const put = (...blocks: Block[]) => out.push(...blocks);

  // Running head and its rule.
  put(...words(LEFT, 3, [7, 0.4, 13], { h: 0.5, fill: MUTED, o: 0.7 }).blocks);
  put({ x: 47, y: 3, w: 7, h: 0.5, fill: TEAL });
  put({ x: LEFT, y: 4.3, w: WIDTH, h: 0.15, fill: RULE });

  // Reference, severity pill and title.
  put({ x: LEFT, y: 7, w: 3.5, h: 0.8, fill: TEAL });
  put({ x: 10.5, y: 6.7, w: 8.6, h: 1.4, fill: tint(RED, 0.86) });
  put({ x: 11.2, y: 7.1, w: 0.6, h: 0.6, fill: RED });
  put({ x: 12.4, y: 7.1, w: 5.8, h: 0.6, fill: RED });
  put(...words(LEFT, 8.8, [3.2, 7, 1.8, 2.8, 4, 3.6], { h: 1.5, o: 1, gap: 0.8 }).blocks);

  // The score box: a tinted cell with the score in pixels, then the vector and status.
  put({ x: LEFT, y: 12, w: WIDTH, h: 5.6, fill: RULE });
  put({ x: LEFT + 0.1, y: 12.1, w: WIDTH - 0.2, h: 5.4, fill: PAPER });
  put({ x: LEFT + 0.1, y: 12.1, w: 9.5, h: 5.4, fill: tint(RED, 0.9) });
  put({ x: 15.6, y: 12.1, w: 0.1, h: 5.4, fill: RULE });
  put({ x: 7, y: 13, w: 3.4, h: 0.5, fill: MUTED, o: 0.8 });
  let dx = 7;
  for (const char of "9.8") {
    const rows = DIGITS[char] ?? [];
    rows.forEach((row, r) => {
      [...row].forEach((on, c) => {
        if (on === "1") put({ x: dx + c * 0.5, y: 14.1 + r * 0.5, w: 0.5, h: 0.5, fill: RED });
      });
    });
    dx += (rows[0]?.length ?? 0) * 0.5 + 0.5;
  }
  put({ x: 17, y: 13, w: 3, h: 0.5, fill: MUTED, o: 0.8 });
  put(
    ...words(17, 13.9, [4.2, 2.4, 2.4, 2.4, 2.4, 2, 2, 2, 2], { h: 0.6, o: 0.75, gap: 0.25 })
      .blocks,
  );
  put(...words(17, 15.7, [3, 2.2], { h: 0.6, fill: MUTED, o: 0.8 }).blocks);

  // Description.
  let y = 19.3;
  put(label(y, 6.5));
  const description = words(
    LEFT,
    y + 1.2,
    [
      1.6, 2.6, 2, 3, 1.4, 1.6, 2.6, 1, 3.6, 2, 2.4, 2, 1.6, 2.6, 2.4, 1.8, 3.6, 2.4, 2, 4, 1.8, 1,
      1.6,
    ],
  );
  put(...description.blocks);

  // Steps to reproduce, with the request as a code block.
  y = description.y + 1.2;
  put(label(y, 10));
  put(...words(LEFT + 1.6, y + 1.2, [2.2, 1.6, 2.6, 2.4]).blocks);
  put(...words(LEFT + 1.6, y + 2.7, [2.2, 1.6, 3.4, 2.8, 1.8, 4, 1, 1.6, 2.8, 5]).blocks);
  put({ x: LEFT, y: y + 1.2, w: 0.7, h: 0.7, fill: MUTED, o: 0.7 });
  put({ x: LEFT, y: y + 2.7, w: 0.7, h: 0.7, fill: MUTED, o: 0.7 });
  y += 4.6;
  put({ x: LEFT, y, w: WIDTH, h: 7.2, fill: RULE });
  put({ x: LEFT + 0.1, y: y + 0.1, w: WIDTH - 0.2, h: 7, fill: WASH });
  put({ x: 7, y: y + 0.8, w: 2, h: 0.4, fill: MUTED, o: 0.6 });
  put({ x: 7, y: y + 1.8, w: 2.2, h: 0.6, fill: SYNTAX.keyword ?? INK });
  put({ x: 9.6, y: y + 1.8, w: 3.2, h: 0.6, fill: TEAL });
  put({ x: 13.2, y: y + 1.8, w: 4.2, h: 0.6, fill: MUTED, o: 0.7 });
  put({ x: 7, y: y + 3, w: 2.6, h: 0.6, fill: TEAL });
  put({ x: 10, y: y + 3, w: 8, h: 0.6, fill: INK, o: 0.7 });
  put({ x: 7, y: y + 5.4, w: 4.6, h: 0.6, fill: TEAL });
  put({ x: 11.8, y: y + 5.4, w: 5.4, h: 0.6, fill: INK, o: 0.7 });
  put({ x: 17.4, y: y + 5.4, w: 5, h: 0.6, fill: TEAL });

  // Remediation.
  y += 8.8;
  put(label(y, 7.5));
  put(...words(LEFT, y + 1.2, [1.8, 6.4, 3.8, 1.6, 2.6, 4.4, 2]).blocks);

  // Folio.
  put(...words(LEFT, 81, [7, 0.4, 5], { h: 0.5, fill: MUTED, o: 0.7 }).blocks);
  put({ x: 51.5, y: 81, w: 2.5, h: 0.5, fill: MUTED, o: 0.7 });
  return out;
}

export const PAGE_ART: Block[] = build();
