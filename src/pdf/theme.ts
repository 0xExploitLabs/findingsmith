import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * The report is set in the brand faces. react-pdf cannot read variable fonts,
 * so these are static instances cut from the variable files (see README,
 * "Fonts"). Noto Sans is the fallback for Greek and Cyrillic, which 0x Sans
 * does not draw. There is no italic master, so italic maps to the upright.
 */
export function registerFonts(root = ""): void {
  if (registered) return;
  registered = true;
  // The site serves the fonts from /fonts; a test reads them from disk.
  const both = (file: string, fontWeight: number) => [
    { src: `${root}${file}`, fontWeight },
    { src: `${root}${file}`, fontWeight, fontStyle: "italic" as const },
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

export * from "./palette";

export const SANS = ["Sans", "Fallback"];
export const MONO = ["Mono", "Fallback"];
export const DISPLAY = ["Display", "Fallback"];
