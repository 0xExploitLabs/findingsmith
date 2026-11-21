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
