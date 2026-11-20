import type { Heading } from "mdast";
import { toString as mdToString } from "mdast-util-to-string";
import { parseMarkdown } from "./parse";
import { hasContent } from "./text";

export interface Section {
  /** The `##` heading text, or "" for content before the first heading. */
  title: string;
  /** The section's Markdown, without its heading. */
  markdown: string;
}

/**
 * Splits a document at its level-2 headings. Headings inside code blocks are
 * ignored because the split follows the parsed tree, not the raw text. Empty
 * sections (a heading with nothing under it yet) are dropped.
 */
export function splitSections(markdown: string): Section[] {
  const tree = parseMarkdown(markdown);
  const heads = tree.children.filter((n): n is Heading => n.type === "heading" && n.depth === 2);
  const sections: Section[] = [];
  const intro = markdown.slice(0, heads[0]?.position?.start.offset ?? markdown.length);
  if (hasContent(intro)) sections.push({ title: "", markdown: intro.trim() });
  heads.forEach((h, i) => {
    const start = h.position?.end.offset ?? 0;
    const end = heads[i + 1]?.position?.start.offset ?? markdown.length;
    const body = markdown.slice(start, end).trim();
    if (hasContent(body)) sections.push({ title: mdToString(h).trim(), markdown: body });
  });
  return sections;
}

/** The section whose title matches, for checks such as "has a remediation". */
export function findSection(sections: Section[], pattern: RegExp): Section | undefined {
  return sections.find((s) => pattern.test(s.title));
}
