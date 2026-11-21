/* The colours of the printed report. No PDF engine here, so the app can show the same page on screen. */

export const INK = "#0B181B";
export const MUTED = "#55666A";
export const FAINT = "#8A979A";
export const RULE = "#D5DFE1";
export const WASH = "#F2F6F7";
export const CODE_BG = "#F3F6F7";
export const PAPER = "#FFFFFF";
/** The lighter stripe of a zebra table, between PAPER and WASH. */
export const STRIPE = "#FAFCFC";
/** Medium's amber is too light for small text on white; labels use this darker step. */
export const MEDIUM_TEXT = "#7A5300";

/** Code colours on white paper, mirroring the app's five syntax roles. */
export const SYNTAX: Record<string, string> = {
  keyword: "#8A5200",
  string: "#036877",
  number: "#B2261F",
  title: "#0B181B",
  comment: "#7A8A8E",
  addition: "#226A30",
  deletion: "#B2261F",
};

/** Mixes a hex colour toward white, for tinted fills derived from the accent. */
export function tint(hex: string, amount: number): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** The text colour that reads on a fill of this colour: white, or ink on a light one. */
export function onColor(hex: string): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return luminance > 0.42 ? INK : PAPER;
}

/**
 * The cover's lower edge breaks up into pixels, the way the app draws: for
 * each row below the block, which columns are inked. The pattern is fixed, so
 * a report looks the same every time it is made.
 */
export function coverPixels(columns: number, rows: number): boolean[][] {
  const fill = [0.66, 0.36, 0.15, 0.06];
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => {
      let h = Math.imul(c + 11, 374761393) ^ Math.imul(r + 7, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295 < (fill[r] ?? 0.04);
    }),
  );
}
