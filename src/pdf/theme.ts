import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * The report is set in the brand faces. react-pdf cannot read variable fonts,
 * so these are static instances cut from the variable files (see README,
 * "Fonts"). Noto Sans is the fallback for Greek and Cyrillic, which 0x Sans
 * does not draw. There is no italic master, so italic maps to the upright.
 */
export function registerFonts(): void {
  if (registered) return;
  registered = true;
  const both = (src: string, fontWeight: number) => [
    { src, fontWeight },
    { src, fontWeight, fontStyle: "italic" as const },
  ];
  Font.register({
    family: "Sans",
    fonts: [
      ...both("/fonts/pdf-sans-400.ttf", 400),
      ...both("/fonts/pdf-sans-600.ttf", 600),
      ...both("/fonts/pdf-sans-700.ttf", 700),
    ],
  });
  Font.register({ family: "Display", fonts: both("/fonts/pdf-sans-display.ttf", 700) });
  Font.register({
    family: "Mono",
    fonts: [...both("/fonts/pdf-mono-400.ttf", 400), ...both("/fonts/pdf-mono-700.ttf", 700)],
  });
  Font.register({
    family: "Fallback",
    fonts: [
      ...both("/fonts/pdf-fallback-400.ttf", 400),
      ...both("/fonts/pdf-fallback-400.ttf", 600),
      ...both("/fonts/pdf-fallback-700.ttf", 700),
    ],
  });
  Font.registerHyphenationCallback(breakLongWords);
}

/**
 * Prose is never hyphenated. Long unbroken tokens (URLs, hashes, CVSS
 * vectors, tokens in evidence) are given break points after punctuation, and
 * failing that every 16 characters, so they wrap instead of running off the page.
 */
export function breakLongWords(word: string): string[] {
  if (word.length <= 22) return [word];
  const pieces = word.split(/(?<=[/&?=.:_,;-])/);
  const out: string[] = [];
  for (const piece of pieces) {
    for (let i = 0; i < piece.length; i += 16) out.push(piece.slice(i, i + 16));
  }
  return out;
}

export const SANS = ["Sans", "Fallback"];
export const MONO = ["Mono", "Fallback"];
export const DISPLAY = ["Display", "Fallback"];

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
