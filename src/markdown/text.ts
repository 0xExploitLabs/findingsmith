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

/** True when a Markdown field has visible content once rendered. */
export function hasContent(markdown: string): boolean {
  return markdown.replace(/<!--[\s\S]*?-->/g, "").trim().length > 0;
}
