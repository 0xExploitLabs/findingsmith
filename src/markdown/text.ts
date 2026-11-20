/** Inline HTML in Markdown is shown as its text content, never as tags. */
export function htmlAsText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * True when Markdown has visible content once rendered. A list marker with
 * nothing after it, such as the "1. " a template leaves, does not count.
 */
export function hasContent(markdown: string): boolean {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .some((line) => line.trim() && !/^\s*([-*+]|\d+[.)])(\s+\[[ xX]\])?\s*$/.test(line));
}
