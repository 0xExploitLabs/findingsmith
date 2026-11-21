import type { Element, ElementContent, Properties, Root } from "hast";
import { describe, expect, it } from "vitest";
import { hastToMarkdown } from "./pasteHtml";

/** An HTML element, for the trees a browser would parse from the clipboard. */
function h(
  tagName: string,
  properties: Properties,
  ...children: (ElementContent | string)[]
): Element {
  return {
    type: "element",
    tagName,
    properties,
    children: children.map((c) => (typeof c === "string" ? { type: "text", value: c } : c)),
  };
}

function paste(...children: Element[]) {
  const tree: Root = { type: "root", children: [h("body", {}, ...children)] };
  return hastToMarkdown(tree);
}

describe("pasting HTML as Markdown", () => {
  it("keeps inline code, and joins the line it lands in", () => {
    expect(paste(h("p", {}, "Send ", h("code", {}, "X-Forwarded-Host"), " to it."))).toEqual({
      markdown: "Send `X-Forwarded-Host` to it.",
      inline: true,
    });
  });

  it("leaves HTML without formatting to the plain text", () => {
    expect(
      paste(h("p", {}, "SELECT * FROM users"), h("div", {}, h("span", {}, "plain"))),
    ).toBeNull();
    // Google Docs wraps every copy in a <b> that is not bold.
    expect(paste(h("b", { id: "docs-internal-guid-1234" }, h("p", {}, "Just text")))).toBeNull();
  });

  it("puts pasted headings under the section they land in", () => {
    const pasted = paste(h("h1", {}, "Advisory"), h("p", {}, "Text"), h("h2", {}, "Details"));
    expect(pasted?.markdown).toBe("### Advisory\n\nText\n\n#### Details");
    expect(pasted?.inline).toBe(false);
  });

  it("keeps web and mail links, and only the text of any other", () => {
    expect(
      paste(
        h(
          "p",
          {},
          h("a", { href: "https://example.com" }, "web"),
          " ",
          h("a", { href: "mailto:sec@example.com" }, "mail"),
          " ",
          h("a", { href: "javascript:alert(1)" }, "script"),
        ),
      )?.markdown,
    ).toBe("[web](https://example.com) [mail](mailto:sec@example.com) script");
  });

  it("drops images, which a report would have to fetch", () => {
    expect(
      paste(h("p", {}, h("strong", {}, "Proof"), h("img", { src: "https://example.com/a.png" })))
        ?.markdown,
    ).toBe("**Proof**");
  });

  it("writes tables and code blocks the way the editor does", () => {
    const table = h(
      "table",
      {},
      h("tr", {}, h("th", {}, "Host"), h("th", {}, "Port")),
      h("tr", {}, h("td", {}, "app.example.com"), h("td", {}, "443")),
    );
    const code = h("pre", {}, h("code", { className: ["language-bash"] }, "curl -I https://app\n"));
    expect(paste(table, code)?.markdown).toBe(
      "| Host            | Port |\n| --------------- | ---- |\n| app.example.com | 443  |\n\n```bash\ncurl -I https://app\n```",
    );
  });
});
