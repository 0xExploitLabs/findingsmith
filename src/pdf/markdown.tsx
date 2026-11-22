import { Image, Link, Text, View } from "@react-pdf/renderer";
import type { RootContent as HastContent, Element as HastElement } from "hast";
import type {
  Code,
  List,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
} from "mdast";
import type { ComponentProps, ReactNode } from "react";
import { highlightCode } from "../markdown/highlight";
import { parseMarkdown } from "../markdown/parse";
import { htmlAsText } from "../markdown/text";
import { CODE_BG, FAINT, INK, MONO, MUTED, PAPER, RULE, SANS, STRIPE, SYNTAX, WASH } from "./theme";

export interface PdfImage {
  src: string;
  width: number;
  height: number;
}

export interface MdContext {
  accent: string;
  images: Map<string, PdfImage>;
  /** Width of the text column in points, used to size screenshots. */
  columnWidth: number;
}

const BODY = { fontFamily: SANS, fontSize: 9.6, lineHeight: 1.55, color: INK };

/**
 * A box of report content that can run across pages. It opens with an empty
 * marker so that react-pdf never sees its first real part as the first thing
 * on the page. react-pdf decides that by looking only at the parts before it
 * in its own box, and then gets two things wrong: a box whose parts all go to
 * the next page is kept on this one instead, hanging off the bottom, so a
 * screenshot at a page break was lost; and a heading may not move down to
 * stay with what follows it.
 */
export function Flow({
  children,
  style,
}: {
  children: ReactNode;
  style?: ComponentProps<typeof View>["style"];
}) {
  return (
    <View style={style}>
      <View />
      {children}
    </View>
  );
}

/** Renders Markdown as typeset PDF content. Raw Markdown syntax never reaches the page. */
export function MarkdownPdf({ source, ctx }: { source: string; ctx: MdContext }) {
  const tree: Root = parseMarkdown(source);
  return <Flow>{blocks(tree.children, ctx, "r")}</Flow>;
}

/**
 * How much of the page a heading over this Markdown keeps with it, at least
 * `min`. A screenshot never splits, so a heading over one keeps all of it and
 * goes to the next page with it rather than stay behind alone.
 */
export function keepWithStart(source: string, ctx: MdContext, min: number): number {
  return Math.max(min, leadHeight(parseMarkdown(source).children[0], ctx));
}

/** The height of the screenshot a block opens with, margins included, or 0. */
function leadHeight(node: RootContent | undefined, ctx: MdContext): number {
  if (node?.type !== "paragraph") return 0;
  const lead = node.children.find((n) => n.type !== "text" || n.value.trim());
  if (lead?.type !== "image") return 0;
  const img = lead.url.startsWith("asset:") ? ctx.images.get(lead.url.slice(6)) : undefined;
  if (!img) return 0;
  // Its margin, frame and padding, and the caption under it.
  return 6 + 7.5 + imageSize(img, ctx).height + (lead.alt ? 16 : 0);
}

function blocks(nodes: RootContent[], ctx: MdContext, key: string): ReactNode[] {
  return nodes.map((node, i) => block(node, ctx, `${key}.${i}`, i === 0, nodes[i + 1]));
}

function block(
  node: RootContent,
  ctx: MdContext,
  key: string,
  first: boolean,
  next?: RootContent,
): ReactNode {
  const top = first ? 0 : 7;
  switch (node.type) {
    case "paragraph":
      return paragraph(node.children, ctx, key, top);
    case "heading": {
      const size = [14, 12.5, 11, 10, 9.6, 9.6][node.depth - 1] ?? 10;
      return (
        <Text
          key={key}
          minPresenceAhead={Math.max(40, leadHeight(next, ctx) + 7)}
          style={{
            ...BODY,
            fontSize: size,
            fontWeight: 700,
            lineHeight: 1.3,
            marginTop: first ? 0 : 12,
            marginBottom: 2,
          }}
        >
          {inlines(node.children, ctx, key)}
        </Text>
      );
    }
    case "list":
      return list(node, ctx, key, top);
    case "code":
      return codeBlock(node, key, top);
    case "blockquote":
      return (
        <View
          key={key}
          style={{
            marginTop: top,
            borderLeftWidth: 2.5,
            borderLeftColor: ctx.accent,
            backgroundColor: WASH,
            paddingVertical: 6,
            paddingHorizontal: 10,
          }}
        >
          {blocks(node.children, ctx, key)}
        </View>
      );
    case "table":
      return table(node, ctx, key, top);
    case "thematicBreak":
      return (
        <View
          key={key}
          style={{ marginVertical: 10, borderBottomWidth: 0.75, borderBottomColor: RULE }}
        />
      );
    case "html":
      return htmlAsText(node.value) ? (
        <Text key={key} style={{ ...BODY, marginTop: top }}>
          {htmlAsText(node.value)}
        </Text>
      ) : null;
    case "footnoteDefinition":
      return (
        <View key={key} style={{ flexDirection: "row", marginTop: top }}>
          <Text style={{ ...BODY, fontSize: 8, color: MUTED, width: 16 }}>{node.label}.</Text>
          <View style={{ flex: 1 }}>{blocks(node.children, ctx, key)}</View>
        </View>
      );
    default:
      return null;
  }
}

/** A paragraph may hold screenshots, which PDF text cannot contain inline, so it is split around them. */
function paragraph(children: PhrasingContent[], ctx: MdContext, key: string, top: number) {
  const runs: ReactNode[] = [];
  let buffer: PhrasingContent[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    const onlyWhitespace = buffer.every(
      (n) => (n.type === "text" && !n.value.trim()) || n.type === "break",
    );
    if (!onlyWhitespace) {
      runs.push(
        <Text key={`${key}.t${runs.length}`} style={BODY}>
          {inlines(buffer, ctx, `${key}.t${runs.length}`)}
        </Text>,
      );
    }
    buffer = [];
  };
  for (const child of children) {
    if (child.type === "image") {
      flush();
      runs.push(image(child.url, child.alt ?? "", ctx, `${key}.i${runs.length}`));
    } else {
      buffer.push(child);
    }
  }
  flush();
  return (
    <View key={key} style={{ marginTop: top }}>
      {runs}
    </View>
  );
}

/** A screenshot's size on the page. */
function imageSize(img: PdfImage, ctx: MdContext): { width: number; height: number } {
  // Points at 144 dpi keep retina screenshots sharp without blowing past the column.
  const natural = img.width * 0.5;
  const width = Math.min(ctx.columnWidth, natural);
  const height = Math.min(520, (width / img.width) * img.height);
  return { width: (height / img.height) * img.width, height };
}

function image(url: string, alt: string, ctx: MdContext, key: string): ReactNode {
  const img = url.startsWith("asset:") ? ctx.images.get(url.slice(6)) : undefined;
  if (!img) {
    return (
      <Text key={key} style={{ ...BODY, color: FAINT, fontStyle: "italic" }}>
        [Image not available{alt ? `: ${alt}` : ""}]
      </Text>
    );
  }
  const { width: finalWidth, height } = imageSize(img, ctx);
  return (
    <View key={key} wrap={false} style={{ marginVertical: 6 }}>
      <View
        style={{
          borderWidth: 0.75,
          borderColor: RULE,
          borderRadius: 3,
          padding: 3,
          alignSelf: "flex-start",
        }}
      >
        <Image src={img.src} style={{ width: finalWidth, height }} />
      </View>
      {alt ? <Text style={{ ...BODY, fontSize: 8, color: MUTED, marginTop: 4 }}>{alt}</Text> : null}
    </View>
  );
}

function inlines(nodes: PhrasingContent[], ctx: MdContext, key: string): ReactNode[] {
  return nodes.map((n, i) => inline(n, ctx, `${key}.${i}`));
}

function inline(node: PhrasingContent, ctx: MdContext, key: string): ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "strong":
      return (
        <Text key={key} style={{ fontWeight: 700 }}>
          {inlines(node.children, ctx, key)}
        </Text>
      );
    case "emphasis":
      return (
        <Text key={key} style={{ fontStyle: "italic", color: MUTED }}>
          {inlines(node.children, ctx, key)}
        </Text>
      );
    case "delete":
      return (
        <Text key={key} style={{ textDecoration: "line-through", color: MUTED }}>
          {inlines(node.children, ctx, key)}
        </Text>
      );
    case "inlineCode":
      return (
        <Text
          key={key}
          style={{ fontFamily: MONO, fontSize: 8.4, backgroundColor: CODE_BG, color: INK }}
        >
          {` ${node.value} `}
        </Text>
      );
    case "link":
      return (
        <Link
          key={key}
          src={node.url}
          style={{
            color: ctx.accent,
            textDecoration: "underline",
            textDecorationColor: ctx.accent,
          }}
        >
          {inlines(node.children, ctx, key)}
        </Link>
      );
    case "break":
      return "\n";
    case "html":
      return htmlAsText(node.value);
    case "image":
      return `[${node.alt || "image"}]`;
    case "footnoteReference":
      return (
        <Text key={key} style={{ fontSize: 7, color: ctx.accent }}>
          [{node.label}]
        </Text>
      );
    default:
      return null;
  }
}

function list(node: List, ctx: MdContext, key: string, top: number): ReactNode {
  const start = node.start ?? 1;
  // Items left empty while writing are not printed.
  const items = node.children.filter((item) => item.children.length > 0);
  if (items.length === 0) return null;
  return (
    <View key={key} style={{ marginTop: top }}>
      {items.map((item: ListItem, i) => {
        const marker = node.ordered ? `${start + i}.` : "•";
        return (
          <View
            key={`${key}.${i}`}
            style={{ flexDirection: "row", marginTop: i === 0 ? 0 : 3 }}
            wrap={item.children.length > 1}
          >
            {item.checked === null || item.checked === undefined ? (
              <Text
                style={{
                  ...BODY,
                  width: node.ordered ? 16 : 11,
                  color: node.ordered ? MUTED : ctx.accent,
                  fontWeight: node.ordered ? 600 : 700,
                }}
              >
                {marker}
              </Text>
            ) : (
              <View style={{ width: 14, paddingTop: 3 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderWidth: 0.9,
                    borderColor: item.checked ? ctx.accent : FAINT,
                    backgroundColor: item.checked ? ctx.accent : PAPER,
                    borderRadius: 1.5,
                  }}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>{blocks(item.children, ctx, `${key}.${i}`)}</View>
          </View>
        );
      })}
    </View>
  );
}

function table(node: Table, ctx: MdContext, key: string, top: number): ReactNode {
  const align = node.align ?? [];
  return (
    <View
      key={key}
      style={{ marginTop: top, borderWidth: 0.75, borderColor: RULE, borderRadius: 2 }}
    >
      {node.children.map((row, r) => (
        <View
          key={`${key}.${r}`}
          wrap={false}
          style={{
            flexDirection: "row",
            backgroundColor: r === 0 ? WASH : r % 2 === 0 ? STRIPE : PAPER,
            borderTopWidth: r === 0 ? 0 : 0.75,
            borderTopColor: RULE,
          }}
        >
          {row.children.map((cell: TableCell, c) => (
            <View
              key={`${key}.${r}.${c}`}
              style={{
                flex: 1,
                paddingVertical: 4,
                paddingHorizontal: 6,
                borderLeftWidth: c === 0 ? 0 : 0.75,
                borderLeftColor: RULE,
              }}
            >
              <Text
                style={{
                  ...BODY,
                  fontSize: 8.6,
                  fontWeight: r === 0 ? 700 : 400,
                  textAlign: align[c] ?? "left",
                }}
              >
                {inlines(cell.children, ctx, `${key}.${r}.${c}`)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

interface Run {
  text: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
}

function syntaxColor(classes: string[]): Partial<Run> | null {
  for (const cls of classes) {
    const name = cls.replace(/^hljs-/, "");
    if (["keyword", "selector-tag", "built_in", "section", "meta-keyword"].includes(name))
      return { color: SYNTAX.keyword };
    if (["string", "attr", "attribute", "template-variable", "regexp"].includes(name))
      return { color: SYNTAX.string };
    if (["number", "literal", "symbol"].includes(name)) return { color: SYNTAX.number };
    if (["title", "name", "type", "variable"].includes(name))
      return { color: SYNTAX.title, bold: true };
    if (["comment", "meta", "quote"].includes(name)) return { color: SYNTAX.comment, italic: true };
    if (name === "addition") return { color: SYNTAX.addition };
    if (name === "deletion") return { color: SYNTAX.deletion };
  }
  return null;
}

function flatten(nodes: HastContent[], inherited: Run, out: Run[]): void {
  for (const node of nodes) {
    if (node.type === "text") out.push({ ...inherited, text: node.value });
    else if (node.type === "element") {
      const el = node as HastElement;
      const style = syntaxColor((el.properties.className as string[] | undefined) ?? []);
      flatten(el.children, { ...inherited, ...style }, out);
    }
  }
}

function codeBlock(node: Code, key: string, top: number): ReactNode {
  const value = node.value.replace(/\t/g, "    ");
  const runs: Run[] = [];
  const base: Run = { text: "", color: INK };
  const tree = highlightCode(value, node.lang);
  if (tree) {
    flatten(tree.children as HastContent[], base, runs);
  } else {
    runs.push({ ...base, text: value });
  }
  // Split the runs into lines so a long block can break across pages between lines.
  const lines: Run[][] = [[]];
  for (const run of runs) {
    const parts = run.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1]?.push({ ...run, text: part });
    });
  }
  // The PDF layout collapses leading spaces, so indentation is kept with no-break spaces.
  for (const line of lines) {
    for (const run of line) {
      const indent = /^ +/.exec(run.text)?.[0].length ?? 0;
      run.text = "\u00a0".repeat(indent) + run.text.slice(indent);
      if (run.text.trim()) break;
    }
  }
  return (
    <View
      key={key}
      // Short blocks move whole to the next page; long ones break between lines.
      wrap={lines.length > 16}
      minPresenceAhead={40}
      style={{
        marginTop: top,
        backgroundColor: CODE_BG,
        borderWidth: 0.75,
        borderColor: RULE,
        borderRadius: 3,
        paddingVertical: 7,
        paddingHorizontal: 9,
      }}
    >
      {node.lang ? (
        <Text
          style={{
            fontFamily: SANS,
            fontSize: 6.6,
            color: FAINT,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 3,
          }}
        >
          {node.lang}
        </Text>
      ) : null}
      {lines.map((line, i) => (
        <Text key={i} style={{ fontFamily: MONO, fontSize: 7.6, lineHeight: 1.5, color: INK }}>
          {line.length === 0
            ? " "
            : line.map((run, j) => (
                <Text
                  key={j}
                  style={{
                    color: run.color,
                    fontWeight: run.bold ? 700 : 400,
                    fontStyle: run.italic ? "italic" : "normal",
                  }}
                >
                  {run.text}
                </Text>
              ))}
        </Text>
      ))}
    </View>
  );
}
