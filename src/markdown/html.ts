import type { Element, ElementContent, Root as HastRoot } from "hast";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { assetIdsIn, assetUrl } from "../data/assets";
import { canHighlight, lowlight } from "./highlight";

const schema = {
  ...defaultSchema,
  // GitHub's schema prefixes ids to avoid clobbering; the preview has no anchors to keep.
  clobberPrefix: "md-",
  protocols: { ...defaultSchema.protocols, src: ["http", "https", "asset"] },
};

function walk(node: HastRoot | Element, fn: (el: Element) => void): void {
  for (const child of node.children) {
    if (child.type === "element") {
      fn(child);
      walk(child, fn);
    }
  }
}

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/** Runs after sanitising, so it only ever adds highlighter spans and resolved image URLs. */
function rehypeFinish(urls: Map<string, string>) {
  return () => (tree: HastRoot) => {
    walk(tree, (el) => {
      if (el.tagName === "a") {
        el.properties.target = "_blank";
        el.properties.rel = ["noopener", "noreferrer"];
      }
      if (el.tagName === "img") {
        const src = String(el.properties.src ?? "");
        if (src.startsWith("asset:")) {
          el.properties.src = urls.get(src.slice(6)) ?? "";
          if (!urls.has(src.slice(6))) el.properties.dataMissing = "true";
        }
        el.properties.loading = "lazy";
      }
      if (el.tagName === "pre") {
        const code = el.children.find(
          (c): c is Element => c.type === "element" && c.tagName === "code",
        );
        if (!code) return;
        const cls = (code.properties.className as string[] | undefined) ?? [];
        const lang = cls.find((c) => c.startsWith("language-"))?.slice(9);
        // Named so a printed-page preview can label the block, as the PDF does.
        if (lang) el.properties.dataLang = lang;
        if (canHighlight(lang)) {
          const highlighted = lowlight.highlight(lang, code.children.map(textOf).join(""));
          code.children = highlighted.children as ElementContent[];
          code.properties.className = [...cls, "hljs"];
        }
      }
    });
  };
}

/** Markdown to sanitised HTML for the in-app preview, with screenshots resolved. */
export async function renderMarkdownHtml(markdown: string): Promise<string> {
  const urls = new Map<string, string>();
  await Promise.all(
    assetIdsIn(markdown).map(async (id) => {
      const url = await assetUrl(id);
      if (url) urls.set(id, url);
    }),
  );
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(rehypeFinish(urls))
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}
