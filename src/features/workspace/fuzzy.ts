/**
 * Fuzzy search for the quick switcher. Each word of the query must be found
 * in the text, in one of these ways, best first:
 *
 * - as it is written ("ssrf" in "(SSRF)", "board" in "Bull Board");
 * - as pieces that each start a word ("ssrf" in "Server-Side Request
 *   Forgery", "bbq" in "Bull Board Queue", "xfwd" in "X-Forwarded");
 * - with one slip, a wrong, missing, extra or swapped letter, against the
 *   start of a word ("forgrey" for "forgery"). Only for words of five letters
 *   or more whose first letter is right: shorter ones would match too much.
 *
 * Letters picked one by one from the middle of words do not count, so a query
 * never matches text that merely happens to hold its letters in order.
 * Punctuation is ignored on both sides, so "f05" finds "F-05".
 */

interface Prepared {
  /** The text in lower case, letters and digits only. */
  chars: string;
  /** Whether each of those characters starts a word. */
  starts: boolean[];
  /** The words, for matching with a slip. */
  words: string[];
}

function prepare(text: string): Prepared {
  let chars = "";
  const starts: boolean[] = [];
  const words: string[] = [];
  let prev = "";
  for (const ch of text) {
    if (!/[\p{L}\p{N}]/u.test(ch)) {
      prev = "";
      continue;
    }
    const lower = ch.toLowerCase();
    const start =
      prev === "" ||
      // camelCase and letter-digit boundaries start words too.
      (ch !== lower && prev === prev.toLowerCase() && prev !== prev.toUpperCase()) ||
      /\p{N}/u.test(ch) !== /\p{N}/u.test(prev);
    if (start) words.push(lower);
    else words[words.length - 1] += lower;
    chars += lower;
    starts.push(start);
    prev = ch;
  }
  return { chars, starts, words };
}

/** Scores of the three ways to match, far enough apart that they never mix. */
const WRITTEN = 3000;
const PIECES = 2000;
const SLIP = 1000;

/** How well one query word matches, or null when it does not. */
function scoreWord(text: Prepared, word: string): number | null {
  const at = text.chars.indexOf(word);
  if (at !== -1) {
    // Prefer a match at the start of a word, then one early in the text.
    let best = WRITTEN - at;
    for (let i = at; i !== -1; i = text.chars.indexOf(word, i + 1)) {
      if (text.starts[i]) {
        best = WRITTEN + 500 + (i === 0 ? 100 : 0) - i;
        break;
      }
    }
    return best;
  }
  const pieces = matchPieces(text, word);
  if (pieces !== null) return PIECES + pieces;
  if (
    word.length >= 5 &&
    text.words.some((w) => w[0] === word[0] && oneSlip(w.slice(0, word.length + 1), word))
  ) {
    return SLIP;
  }
  return null;
}

/**
 * The best split of the word into pieces that each start a word of the text,
 * in order: fewer, longer pieces score higher. Null when there is none.
 */
function matchPieces({ chars, starts }: Prepared, word: string): number | null {
  const memo = new Map<number, number | null>();
  const best = (q: number, from: number): number | null => {
    if (q === word.length) return 0;
    const key = q * (chars.length + 1) + from;
    if (memo.has(key)) return memo.get(key) ?? null;
    let top: number | null = null;
    for (let s = from; s < chars.length; s++) {
      if (!starts[s] || chars[s] !== word[q]) continue;
      let len = 0;
      while (q + len < word.length && chars[s + len] === word[q + len]) len++;
      for (; len > 0; len--) {
        const rest = best(q + len, s + len);
        if (rest === null) continue;
        const score = rest + len * 10 - 30;
        if (top === null || score > top) top = score;
      }
    }
    memo.set(key, top);
    return top;
  };
  return best(0, 0);
}

/**
 * Whether the start of a word is the query with one slip. The start is taken
 * one letter longer than the query, so a missing letter still lines up.
 */
function oneSlip(start: string, query: string): boolean {
  for (const candidate of [start.slice(0, query.length), start]) {
    if (candidate.length < query.length - 1) continue;
    if (editDistance(candidate, query) <= 1) return true;
  }
  return false;
}

/** Edits between two short strings, a swap of neighbours counting as one. */
function editDistance(a: string, b: string): number {
  const w = b.length + 1;
  const d = new Array<number>((a.length + 1) * w).fill(0);
  const at = (i: number, j: number) => d[i * w + j] ?? 0;
  for (let i = 0; i <= a.length; i++) d[i * w] = i;
  for (let j = 0; j <= b.length; j++) d[j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      d[i * w + j] = best;
    }
  }
  return at(a.length, b.length);
}

/** How well the query matches the text, higher is better, or null when it does not. */
export function fuzzyScore(text: string, query: string): number | null {
  const words = prepare(query).words.length > 0 ? query.split(/\s+/) : [];
  const prepared = prepare(text);
  let total = 0;
  for (const raw of words) {
    const word = prepare(raw).chars;
    if (!word) continue;
    const score = scoreWord(prepared, word);
    if (score === null) return null;
    total += score;
  }
  return total;
}

/** The items that match the query, best first; ties keep their order. */
export function fuzzyFilter<T>(items: T[], query: string, text: (item: T) => string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(text(item), query) }))
    .filter((r): r is { item: T; index: number; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}
