import type { Element, ElementContent, Root as HastRoot } from "hast";
import { fromDom } from "hast-util-from-dom";
import { toMdast } from "hast-util-to-mdast";
import type { Nodes, Parent, Root, RootContent } from "mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

/**
 * What a paste from a web page or a chat answer becomes: the Markdown of its
 * HTML, so inline code, bold, links, lists, tables and code blocks survive.
 */
export interface PastedMarkdown {
  markdown: string;
  /** Whether it starts with running text, which can join the line it lands in. */
  inline: boolean;
}

/** Elements that make HTML worth converting; anything else pastes as its plain text. */
const FORMATTING = new Set([
  "code",
  "pre",
  "strong",
  "b",
  "em",
  "i",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "table",
  "blockquote",
  "del",
  "s",
]);

/** Pasted headings start here, so they fall under the section they land in. */
const TOP_HEADING = 3;

/** Reads clipboard HTML in the browser. */
export function htmlToMarkdown(html: string): PastedMarkdown | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return hastToMarkdown({ type: "root", children: [fromDom(doc.body) as Element] });
}

/**
 * The Markdown for pasted HTML, or null when the HTML carries no formatting
 * and the plain text says it all. Images and links that are not web or mail
 * addresses are dropped: a report never fetches anything.
 */
export function hastToMarkdown(tree: HastRoot): PastedMarkdown | null {
  unwrapGoogleDocs(tree);
  if (!hasFormatting(tree)) return null;
  const mdast = toMdast(tree, { handlers: { img: () => undefined } }) as Root;
  tidy(mdast);
  demoteHeadings(mdast);
  const markdown = toMarkdown(mdast, {
    // The same markers the editor writes itself.
    bullet: "-",
    emphasis: "_",
    strong: "*",
    fence: "`",
    rule: "-",
    listItemIndent: "one",
    extensions: [gfmToMarkdown()],
  }).trim();
  if (!markdown) return null;
  return { markdown, inline: mdast.children[0]?.type === "paragraph" };
}

/** Google Docs wraps a copy in a <b> that is not bold. */
function unwrapGoogleDocs(node: HastRoot | Element): void {
  node.children = node.children.flatMap((child): ElementContent[] => {
    if (child.type !== "element") return [child as ElementContent];
    unwrapGoogleDocs(child);
    const id = child.properties.id;
    return child.tagName === "b" && typeof id === "string" && id.startsWith("docs-internal-guid")
      ? child.children
      : [child];
  });
}

function hasFormatting(node: HastRoot | Element): boolean {
  return node.children.some(
    (child) =>
      child.type === "element" &&
      ((FORMATTING.has(child.tagName) &&
        (child.tagName !== "a" || typeof child.properties.href === "string")) ||
        hasFormatting(child)),
  );
}

/** Drops images, and keeps the text of links that do not lead to the web or a mailbox. */
function tidy(node: Parent): void {
  node.children = node.children.flatMap((child): RootContent[] => {
    if (child.type === "image" || child.type === "imageReference") return [];
    if ("children" in child) tidy(child);
    if (child.type === "link" && !/^(https?:|mailto:)/i.test(child.url)) return child.children;
    return [child];
  }) as typeof node.children;
}

function demoteHeadings(root: Root): void {
  const headings: Extract<Nodes, { type: "heading" }>[] = [];
  const collect = (node: Nodes) => {
    if (node.type === "heading") headings.push(node);
    if ("children" in node) for (const child of node.children) collect(child);
  };
  collect(root);
  if (headings.length === 0) return;
  const shift = Math.max(0, TOP_HEADING - Math.min(...headings.map((h) => h.depth)));
  for (const h of headings) h.depth = Math.min(6, h.depth + shift) as typeof h.depth;
}
