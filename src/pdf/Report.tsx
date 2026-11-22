import { Document, Image, Link, Page, Text, View } from "@react-pdf/renderer";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { formatScore, RATING_SCALE } from "../domain/cvss";
import { compareFindings, type Rating, rate, SEVERITY_HEX } from "../domain/severity";
import { type Finding, type Project, SEVERITIES, type Severity, STATUSES } from "../domain/types";
import { findSection, splitSections } from "../markdown/sections";
import { hasContent } from "../markdown/text";
import { Flow, keepWithStart, MarkdownPdf, type MdContext, type PdfImage } from "./markdown";
import {
  coverPixels,
  DISPLAY,
  FAINT,
  INK,
  isHexColor,
  MEDIUM_TEXT,
  MONO,
  MUTED,
  onColor,
  PAPER,
  RULE,
  SANS,
  tint,
  WASH,
} from "./theme";

/** react-pdf turns `bookmark` on any node into a PDF outline entry; its types only allow it on Page. */
const Marked = View as unknown as ComponentType<
  ComponentProps<typeof View> & { bookmark?: string }
>;

export const PAGE = { width: 595.28, height: 841.89, marginX: 56, top: 70, bottom: 64 };
const COLUMN = PAGE.width - PAGE.marginX * 2;

export interface ReportInput {
  project: Project;
  findings: Finding[];
  images: Map<string, PdfImage>;
  logo: PdfImage | null;
}

/** Page numbers of anchors, collected while laying out the first pass. */
export type PageMap = Record<string, number>;

interface Section {
  id: string;
  title: string;
  render: (num: string) => ReactNode;
}

interface Numbered {
  finding: Finding;
  rating: Rating;
  ref: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function period(p: Project): string {
  if (p.startDate && p.endDate && p.startDate !== p.endDate) {
    return `${formatDate(p.startDate)} to ${formatDate(p.endDate)}`;
  }
  return formatDate(p.startDate || p.endDate);
}

export function ReportDocument({
  input,
  pages,
  collect,
}: {
  input: ReportInput;
  pages: PageMap;
  collect: PageMap;
}) {
  const { project } = input;
  const accent = isHexColor(project.accent) ? project.accent : "#036877";
  const ctx: MdContext = { accent, images: input.images, columnWidth: COLUMN };
  const numbered: Numbered[] = [...input.findings].sort(compareFindings).map((finding, i) => ({
    finding,
    rating: rate(finding),
    ref: `${project.idPrefix || "F"}-${pad(i + 1)}`,
  }));

  // The project document: its "summary" section leads (with the risk overview),
  // a "conclusion" section closes after the findings, the rest keep their order.
  const docSections = splitSections(project.body);
  const intro = docSections.find((d) => d.title === "");
  const summary = findSection(docSections, /summary|overview/i);
  const conclusion = findSection(docSections, /conclusion|closing/i);
  const middle = docSections.filter((d) => d !== intro && d !== summary && d !== conclusion);
  const slug = (title: string, i: number) =>
    `s-${i}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

  const sections: Section[] = [];
  const summarySource = [intro?.markdown, summary?.markdown].filter(Boolean).join("\n\n");
  sections.push({
    id: "summary",
    title: summary?.title || "Executive summary",
    render: (n) => (
      <ExecutiveSummary
        num={n}
        title={summary?.title || "Executive summary"}
        source={summarySource}
        items={numbered}
        ctx={ctx}
      />
    ),
  });
  middle.forEach((d, i) => {
    sections.push({
      id: slug(d.title, i),
      title: d.title,
      render: (n) => (
        <Prose num={n} id={slug(d.title, i)} title={d.title} source={d.markdown} ctx={ctx} />
      ),
    });
  });
  sections.push({
    id: "overview",
    title: "Findings overview",
    render: (n) => <Overview num={n} items={numbered} ctx={ctx} />,
  });

  const findingsNum = String(sections.length + 1);
  const closing: Section[] = [];
  if (conclusion) {
    closing.push({
      id: "conclusion",
      title: conclusion.title,
      render: (n) => (
        <Prose
          num={n}
          id="conclusion"
          title={conclusion.title}
          source={conclusion.markdown}
          ctx={ctx}
        />
      ),
    });
  }

  const chrome = <PageChrome project={project} accent={accent} />;
  const anchor = (id: string) => (
    <View
      render={({ pageNumber }) => {
        collect[id] = pageNumber;
        return null;
      }}
    />
  );

  const toc: { id: string; label: string; num: string; level: 0 | 1 }[] = [
    ...sections.map((s, i) => ({
      id: s.id,
      label: s.title,
      num: String(i + 1),
      level: 0 as const,
    })),
  ];
  if (numbered.length > 0) {
    toc.push({ id: "findings", label: "Detailed findings", num: findingsNum, level: 0 });
    for (const item of numbered) {
      toc.push({
        id: `f-${item.finding.id}`,
        label: item.finding.title || "Untitled finding",
        num: item.ref,
        level: 1,
      });
    }
  }
  const closingStart = numbered.length > 0 ? sections.length + 2 : sections.length + 1;
  closing.forEach((s, i) => {
    toc.push({ id: s.id, label: s.title, num: String(closingStart + i), level: 0 });
  });
  toc.push({ id: "appendix", label: "Appendix A. Severity rating", num: "A", level: 0 });

  return (
    <Document
      title={project.name || "Penetration test report"}
      author={project.preparedBy || project.assessors || undefined}
      subject={
        project.client ? `Penetration test report for ${project.client}` : "Penetration test report"
      }
      creator={project.preparedBy || " "}
      producer={project.preparedBy || " "}
      language="en"
      pageMode="useOutlines"
    >
      <Cover project={project} accent={accent} logo={input.logo} items={numbered} />

      <Page size="A4" style={pageStyle} bookmark="Contents">
        {chrome}
        <SectionTitle num="" title="Contents" accent={accent} />
        <View style={{ marginTop: 6 }}>
          {toc.map((entry) => (
            <Link
              key={`${entry.id}`}
              src={`#${entry.id}`}
              style={{ textDecoration: "none", color: INK }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  paddingVertical: entry.level === 0 ? 5 : 3,
                  paddingLeft: entry.level === 0 ? 0 : 24,
                  marginTop: entry.level === 0 ? 4 : 0,
                }}
              >
                <Text
                  style={{
                    fontFamily: entry.level === 0 ? SANS : MONO,
                    fontSize: entry.level === 0 ? 10.5 : 7.8,
                    fontWeight: 700,
                    color: entry.level === 0 ? accent : MUTED,
                    width: entry.level === 0 ? 24 : 40,
                  }}
                >
                  {entry.num}
                </Text>
                <Text
                  style={{
                    fontFamily: SANS,
                    fontSize: entry.level === 0 ? 10.5 : 9,
                    fontWeight: entry.level === 0 ? 600 : 400,
                    color: entry.level === 0 ? INK : MUTED,
                    maxWidth: COLUMN - 110,
                  }}
                >
                  {entry.label}
                </Text>
                <View
                  style={{
                    flex: 1,
                    borderBottomWidth: 0.6,
                    borderBottomColor: RULE,
                    borderBottomStyle: "dotted",
                    marginHorizontal: 6,
                    marginBottom: 3,
                  }}
                />
                <Text
                  style={{ fontFamily: SANS, fontSize: entry.level === 0 ? 10 : 8.6, color: MUTED }}
                >
                  {pages[entry.id] ?? " "}
                </Text>
              </View>
            </Link>
          ))}
        </View>
      </Page>

      {/* The summary gets its own page; the sections after it flow on, as in a printed report. */}
      {sections.slice(0, 1).map((s) => (
        <Page key={s.id} size="A4" style={pageStyle} bookmark={s.title}>
          {chrome}
          <View id={s.id}>{anchor(s.id)}</View>
          {s.render("1")}
        </Page>
      ))}
      <Page size="A4" style={pageStyle}>
        {chrome}
        {sections.slice(1).map((s, i) => (
          <Marked key={s.id} id={s.id} bookmark={s.title} style={{ marginTop: i === 0 ? 0 : 30 }}>
            {anchor(s.id)}
            {s.render(String(i + 2))}
          </Marked>
        ))}
      </Page>

      {numbered.length > 0 ? (
        <Page size="A4" style={pageStyle} bookmark="Detailed findings">
          {chrome}
          <View id="findings">{anchor("findings")}</View>
          <SectionTitle num={findingsNum} title="Detailed findings" accent={accent} />
          <Text
            style={{
              fontFamily: SANS,
              fontSize: 9.6,
              lineHeight: 1.55,
              color: MUTED,
              marginBottom: 14,
            }}
          >
            Findings are ordered by severity. Each one gives the evidence for the issue, its impact
            and the recommended fix.
          </Text>
          {numbered.map((item, i) => (
            <FindingDetail
              key={item.finding.id}
              item={item}
              ctx={ctx}
              breakBefore={i > 0}
              anchor={anchor}
            />
          ))}
        </Page>
      ) : null}

      <Page size="A4" style={pageStyle}>
        {chrome}
        {closing.map((s, i) => (
          <Marked key={s.id} id={s.id} bookmark={s.title} style={{ marginBottom: 30 }}>
            {anchor(s.id)}
            {s.render(String(closingStart + i))}
          </Marked>
        ))}
        <Marked id="appendix" bookmark="Appendix A. Severity rating">
          {anchor("appendix")}
          <Appendix accent={accent} />
        </Marked>
      </Page>
    </Document>
  );
}

const pageStyle = {
  paddingTop: PAGE.top,
  paddingBottom: PAGE.bottom,
  paddingHorizontal: PAGE.marginX,
  fontFamily: SANS,
  fontSize: 9.6,
  color: INK,
  backgroundColor: PAPER,
};

function PageChrome({ project, accent }: { project: Project; accent: string }) {
  return (
    <>
      <View
        fixed
        style={{
          position: "absolute",
          top: 30,
          left: PAGE.marginX,
          right: PAGE.marginX,
          flexDirection: "row",
          justifyContent: "space-between",
          paddingBottom: 7,
          borderBottomWidth: 0.6,
          borderBottomColor: RULE,
        }}
      >
        <Text style={{ fontSize: 7.4, color: MUTED, maxWidth: COLUMN - 120 }}>
          {[project.client, project.name].filter(Boolean).join("  /  ") ||
            "Penetration test report"}
        </Text>
        <Text
          style={{
            fontSize: 7,
            color: accent,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          {project.classification}
        </Text>
      </View>
      <View
        fixed
        style={{
          position: "absolute",
          bottom: 28,
          left: PAGE.marginX,
          right: PAGE.marginX,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 7.4, color: MUTED }}>{project.preparedBy}</Text>
        <Text
          style={{ fontSize: 7.4, color: MUTED }}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </>
  );
}

/** The side of one pixel of the cover's broken edge: 34 of them span the page. */
const COVER_PIXEL = PAGE.width / 34;
const COVER_ROWS = coverPixels(34, 4);

/**
 * The cover: who made the report and how it is classified on white, then a
 * block of the report's colour carrying its title, whose lower edge breaks up
 * into pixels, then what was found and the report's particulars.
 */
function Cover({
  project,
  accent,
  logo,
  items,
}: {
  project: Project;
  accent: string;
  logo: PdfImage | null;
  items: Numbered[];
}) {
  const meta: [string, string][] = [
    ["Prepared for", project.client],
    ["Prepared by", project.preparedBy],
    ["Assessors", project.assessors],
    ["Assessment period", period(project)],
    ["Report date", formatDate(project.reportDate)],
  ].filter((row): row is [string, string] => !!row[1]);
  const logoHeight = logo ? Math.min(44, (180 / logo.width) * logo.height) : 0;
  const on = onColor(accent);
  const counts = SEVERITIES.map((s) => ({
    severity: s,
    count: items.filter((it) => it.rating.severity === s).length,
  })).filter((c) => c.count > 0);
  const label = {
    fontSize: 6.8,
    color: FAINT,
    letterSpacing: 1.1,
    textTransform: "uppercase" as const,
    fontWeight: 700,
  };
  return (
    <Page
      size="A4"
      style={{ backgroundColor: PAPER, fontFamily: SANS, color: INK }}
      bookmark="Cover"
    >
      <View
        style={{
          height: 112,
          paddingHorizontal: PAGE.marginX,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {logo ? (
          <Image
            src={logo.src}
            style={{ height: logoHeight, width: (logoHeight / logo.height) * logo.width }}
          />
        ) : (
          <Text
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: INK,
            }}
          >
            {project.preparedBy}
          </Text>
        )}
        <View
          style={{
            borderWidth: 1,
            borderColor: accent,
            borderRadius: 3,
            paddingVertical: 4,
            paddingHorizontal: 9,
          }}
        >
          <Text
            style={{
              fontSize: 7.4,
              fontWeight: 700,
              color: accent,
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            {project.classification}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: accent,
          minHeight: 372,
          paddingHorizontal: PAGE.marginX,
          paddingTop: 60,
          paddingBottom: 44,
          justifyContent: "flex-end",
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 2.2,
            color: on,
            opacity: 0.78,
            textTransform: "uppercase",
          }}
        >
          Penetration test report
        </Text>
        <Text
          style={{ fontFamily: DISPLAY, fontSize: 36, lineHeight: 1.1, marginTop: 14, color: on }}
        >
          {project.name || "Untitled assessment"}
        </Text>
        {project.client ? (
          <Text style={{ fontSize: 14, color: on, opacity: 0.86, marginTop: 14 }}>
            {project.client}
          </Text>
        ) : null}
      </View>
      {/* The block's edge, broken into pixels that thin out down the page. */}
      <View style={{ height: COVER_PIXEL * COVER_ROWS.length }}>
        {COVER_ROWS.map((row, r) =>
          row.map((inked, c) =>
            inked ? (
              <View
                key={`${r}-${c}`}
                style={{
                  position: "absolute",
                  // Overlapped by a hair, so no seam shows between neighbours.
                  top: r * COVER_PIXEL - 0.3,
                  left: c * COVER_PIXEL - 0.15,
                  width: COVER_PIXEL + 0.3,
                  height: COVER_PIXEL + 0.3,
                  backgroundColor: tint(accent, [0, 0.3, 0.55, 0.72][r] ?? 0.8),
                }}
              />
            ) : null,
          ),
        )}
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: PAGE.marginX,
          paddingBottom: 46,
          justifyContent: "flex-end",
        }}
      >
        {counts.length > 0 ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={label}>
              {items.length} finding{items.length === 1 ? "" : "s"}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 7 }}>
              {counts.map(({ severity, count }) => (
                <View
                  key={severity}
                  style={{ flexDirection: "row", alignItems: "center", marginRight: 18 }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 1.2,
                      backgroundColor: SEVERITY_HEX[severity],
                      marginRight: 6,
                    }}
                  />
                  <Text style={{ fontSize: 10.5, fontWeight: 700, color: INK }}>{count}</Text>
                  <Text style={{ fontSize: 10.5, color: MUTED, marginLeft: 4 }}>{severity}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            borderTopWidth: 0.75,
            borderTopColor: RULE,
          }}
        >
          {meta.map(([name, value]) => (
            <View
              key={name}
              style={{
                width: "50%",
                paddingTop: 10,
                paddingBottom: 10,
                paddingRight: 12,
                borderBottomWidth: 0.75,
                borderBottomColor: RULE,
              }}
            >
              <Text style={label}>{name}</Text>
              <Text style={{ fontSize: 10, marginTop: 3, color: INK }}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 7, color: FAINT, lineHeight: 1.5, marginTop: 14 }}>
          {project.classification === "Public"
            ? "This report may be shared publicly."
            : `This document is ${project.classification.toLowerCase()}. It contains security-sensitive information about ${project.client || "the assessed organisation"} and must be shared only with authorised recipients.`}
        </Text>
      </View>
    </Page>
  );
}

function SectionTitle({ num, title, accent }: { num: string; title: string; accent: string }) {
  return (
    <View style={{ marginBottom: 16 }} minPresenceAhead={80}>
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        {num ? (
          <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: accent, marginRight: 10 }}>
            {num}
          </Text>
        ) : null}
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: INK }}>{title}</Text>
      </View>
      <View style={{ width: 36, height: 2, backgroundColor: accent, marginTop: 9 }} />
    </View>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return (
    <Text
      minPresenceAhead={60}
      style={{ fontSize: 11.5, fontWeight: 700, marginTop: 20, marginBottom: 8, color: INK }}
    >
      {children}
    </Text>
  );
}

export function SeverityPill({ severity, small }: { severity: Severity; small?: boolean }) {
  const color = SEVERITY_HEX[severity];
  return (
    <View
      style={{
        backgroundColor: tint(color, 0.86),
        borderRadius: 2.5,
        paddingVertical: small ? 2 : 3,
        paddingHorizontal: small ? 5 : 7,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
      }}
    >
      <View
        style={{
          width: small ? 4.5 : 5.5,
          height: small ? 4.5 : 5.5,
          borderRadius: 1,
          backgroundColor: color,
          marginRight: small ? 3.5 : 4.5,
        }}
      />
      <Text
        style={{
          fontSize: small ? 7 : 7.8,
          fontWeight: 700,
          color: severity === "Medium" ? MEDIUM_TEXT : color,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {severity}
      </Text>
    </View>
  );
}

function ExecutiveSummary({
  num,
  title,
  source,
  items,
  ctx,
}: {
  num: string;
  title: string;
  source: string;
  items: Numbered[];
  ctx: MdContext;
}) {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  const statuses = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    (typeof STATUSES)[number],
    number
  >;
  for (const it of items) {
    counts[it.rating.severity]++;
    statuses[it.finding.status]++;
  }
  const total = items.length;
  return (
    <Flow>
      <SectionTitle num={num} title={title} accent={ctx.accent} />
      {hasContent(source) ? <MarkdownPdf source={source} ctx={ctx} /> : null}

      <SubTitle>Risk overview</SubTitle>
      <View wrap={false}>
        <View style={{ flexDirection: "row", marginHorizontal: -3 }}>
          {SEVERITIES.map((s) => (
            <View
              key={s}
              style={{
                flex: 1,
                marginHorizontal: 3,
                borderTopWidth: 3,
                borderTopColor: SEVERITY_HEX[s],
                backgroundColor: WASH,
                paddingVertical: 10,
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{ fontFamily: DISPLAY, fontSize: 22, color: counts[s] > 0 ? INK : FAINT }}
              >
                {counts[s]}
              </Text>
              <Text
                style={{
                  fontSize: 7.4,
                  color: MUTED,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                {s}
              </Text>
            </View>
          ))}
        </View>
        {total > 0 ? (
          <View style={{ flexDirection: "row", height: 8, marginTop: 12, borderRadius: 2 }}>
            {SEVERITIES.filter((s) => counts[s] > 0).map((s) => (
              <View
                key={s}
                style={{ flex: counts[s], backgroundColor: SEVERITY_HEX[s], marginRight: 1.5 }}
              />
            ))}
          </View>
        ) : null}
        <Text style={{ fontSize: 8.6, color: MUTED, marginTop: 10 }}>
          {total === 0
            ? "No findings were recorded during this assessment."
            : `${total} finding${total === 1 ? "" : "s"} in total. ${STATUSES.filter(
                (s) => statuses[s] > 0,
              )
                .map((s) => `${statuses[s]} ${s.toLowerCase()}`)
                .join(", ")}.`}
        </Text>
      </View>
    </Flow>
  );
}

function Prose({
  num,
  title,
  source,
  ctx,
}: {
  num: string;
  id: string;
  title: string;
  source: string;
  ctx: MdContext;
}) {
  return (
    <Flow>
      <SectionTitle num={num} title={title} accent={ctx.accent} />
      <MarkdownPdf source={source} ctx={ctx} />
    </Flow>
  );
}

function Overview({ num, items, ctx }: { num: string; items: Numbered[]; ctx: MdContext }) {
  return (
    <Flow>
      <SectionTitle num={num} title="Findings overview" accent={ctx.accent} />
      {items.length === 0 ? (
        <Text style={{ fontSize: 9.6, color: MUTED }}>
          No findings were recorded during this assessment.
        </Text>
      ) : (
        <Grid
          widths={[0.1, 0.5, 0.15, 0.1, 0.15]}
          head={["ID", "Finding", "Severity", "CVSS", "Status"]}
          rows={items.map((it) => [
            <Link key="id" src={`#f-${it.finding.id}`} style={{ textDecoration: "none" }}>
              <Text style={{ fontFamily: MONO, fontSize: 7.8, color: ctx.accent, fontWeight: 700 }}>
                {it.ref}
              </Text>
            </Link>,
            <Link
              key="t"
              src={`#f-${it.finding.id}`}
              style={{ textDecoration: "none", color: INK }}
            >
              <Text style={{ fontSize: 8.8 }}>{it.finding.title || "Untitled finding"}</Text>
            </Link>,
            <SeverityPill key="s" severity={it.rating.severity} small />,
            <Text
              key="c"
              style={{ fontFamily: MONO, fontSize: 8, color: it.rating.cvss ? INK : FAINT }}
            >
              {it.rating.cvss ? formatScore(it.rating.cvss.score) : "n/a"}
            </Text>,
            <Text key="st" style={{ fontSize: 8.4, color: MUTED }}>
              {it.finding.status}
            </Text>,
          ])}
        />
      )}
    </Flow>
  );
}

function Grid({ widths, head, rows }: { widths: number[]; head: string[]; rows: ReactNode[][] }) {
  return (
    <View style={{ borderTopWidth: 1.2, borderTopColor: INK }}>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: WASH,
          borderBottomWidth: 0.75,
          borderBottomColor: RULE,
        }}
      >
        {head.map((h, i) => (
          <View
            key={h}
            style={{
              width: `${(widths[i] ?? 0) * 100}%`,
              paddingVertical: 6,
              paddingRight: 8,
              paddingLeft: i === 0 ? 6 : 0,
            }}
          >
            <Text
              style={{
                fontSize: 6.8,
                color: MUTED,
                fontWeight: 700,
                letterSpacing: 0.9,
                textTransform: "uppercase",
              }}
            >
              {h}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row, r) => (
        <View
          key={r}
          wrap={false}
          style={{
            flexDirection: "row",
            borderBottomWidth: 0.75,
            borderBottomColor: RULE,
            alignItems: "center",
          }}
        >
          {row.map((cell, c) => (
            <View
              key={c}
              style={{
                width: `${(widths[c] ?? 0) * 100}%`,
                paddingVertical: 6.5,
                paddingRight: 8,
                paddingLeft: c === 0 ? 6 : 0,
              }}
            >
              {cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 5,
        borderBottomWidth: 0.6,
        borderBottomColor: RULE,
      }}
      wrap={false}
    >
      <Text
        style={{
          width: 92,
          fontSize: 7,
          color: FAINT,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          paddingTop: 1.5,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function FindingDetail({
  item,
  ctx,
  breakBefore,
  anchor,
}: {
  item: Numbered;
  ctx: MdContext;
  breakBefore: boolean;
  anchor: (id: string) => ReactNode;
}) {
  const { finding: f, rating, ref } = item;
  const sevColor = SEVERITY_HEX[rating.severity];
  const affected = f.affected
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const sections = splitSections(f.body);
  const mono = { fontFamily: MONO, fontSize: 8, color: INK };
  return (
    <View break={breakBefore} id={`f-${f.id}`}>
      {anchor(`f-${f.id}`)}
      <View wrap={false}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 8.6,
              fontWeight: 700,
              color: ctx.accent,
              marginRight: 8,
            }}
          >
            {ref}
          </Text>
          <SeverityPill severity={rating.severity} />
        </View>
        <Text style={{ fontFamily: DISPLAY, fontSize: 17, lineHeight: 1.22, color: INK }}>
          {f.title || "Untitled finding"}
        </Text>

        <View
          style={{
            flexDirection: "row",
            marginTop: 14,
            borderWidth: 0.75,
            borderColor: RULE,
            borderRadius: 3,
          }}
        >
          <View
            style={{
              width: 96,
              padding: 10,
              backgroundColor: tint(sevColor, 0.9),
              borderRightWidth: 0.75,
              borderRightColor: RULE,
            }}
          >
            <Text
              style={{
                fontSize: 6.8,
                color: MUTED,
                fontWeight: 700,
                letterSpacing: 0.9,
                textTransform: "uppercase",
              }}
            >
              {rating.cvss ? rating.cvss.nomenclature : "Severity"}
            </Text>
            <Text style={{ fontFamily: DISPLAY, fontSize: 22, color: sevColor, marginTop: 3 }}>
              {rating.cvss ? formatScore(rating.cvss.score) : rating.severity}
            </Text>
          </View>
          <View style={{ flex: 1, padding: 10, justifyContent: "center" }}>
            {rating.cvss?.vector ? (
              <>
                <Text
                  style={{
                    fontSize: 6.8,
                    color: MUTED,
                    fontWeight: 700,
                    letterSpacing: 0.9,
                    textTransform: "uppercase",
                  }}
                >
                  Vector
                </Text>
                <Text style={{ ...mono, fontSize: 7.6, marginTop: 3 }}>{rating.cvss.vector}</Text>
              </>
            ) : (
              <Text style={{ fontSize: 8.4, color: MUTED }}>
                {rating.cvss
                  ? "CVSS base score as reported by the assessor."
                  : "Rated by the assessor without a CVSS score."}
              </Text>
            )}
            <Text style={{ fontSize: 8, color: MUTED, marginTop: 6 }}>
              Status: <Text style={{ color: INK, fontWeight: 600 }}>{f.status}</Text>
            </Text>
          </View>
        </View>
        {rating.source === "override" && rating.cvssSeverity ? (
          <View
            style={{
              marginTop: 8,
              padding: 9,
              backgroundColor: WASH,
              borderLeftWidth: 2.5,
              borderLeftColor: sevColor,
            }}
          >
            <Text style={{ fontSize: 8.4, color: INK, lineHeight: 1.5 }}>
              <Text style={{ fontWeight: 700 }}>Severity adjusted </Text>
              from {rating.cvssSeverity} (CVSS {formatScore(rating.cvss?.score ?? 0)}) to{" "}
              {rating.severity}.{f.override?.reason ? ` ${f.override.reason}` : ""}
            </Text>
          </View>
        ) : null}
      </View>

      {affected.length > 0 ||
      f.endpoint ||
      f.method ||
      f.parameter ||
      f.host ||
      f.port ||
      f.cwe ||
      f.cve ? (
        <View style={{ marginTop: 14 }}>
          {f.endpoint || f.method ? (
            <MetaRow label="Endpoint">
              <Text style={mono}>
                {f.method ? (
                  <Text style={{ fontWeight: 700, color: ctx.accent }}>{`${f.method} `}</Text>
                ) : null}
                {f.endpoint}
              </Text>
            </MetaRow>
          ) : null}
          {f.parameter ? (
            <MetaRow label="Parameter">
              <Text style={mono}>{f.parameter}</Text>
            </MetaRow>
          ) : null}
          {f.host ? (
            <MetaRow label="Host">
              <Text style={mono}>{f.port ? `${f.host}:${f.port}` : f.host}</Text>
            </MetaRow>
          ) : f.port ? (
            <MetaRow label="Port">
              <Text style={mono}>{f.port}</Text>
            </MetaRow>
          ) : null}
          {affected.length > 0 ? (
            <MetaRow label="Affected">
              {affected.map((a) => (
                <Text key={a} style={mono}>
                  {a}
                </Text>
              ))}
            </MetaRow>
          ) : null}
          {f.cwe ? (
            <MetaRow label="Weakness">
              <Link
                src={cweUrl(f.cwe)}
                style={{ ...mono, color: ctx.accent, textDecoration: "none" }}
              >
                {f.cwe}
              </Link>
            </MetaRow>
          ) : null}
          {f.cve ? (
            <MetaRow label="CVE">
              <Text style={mono}>{f.cve}</Text>
            </MetaRow>
          ) : null}
        </View>
      ) : null}

      {sections.map(({ title, markdown: md }, i) => (
        <Flow key={`${i}-${title}`} style={{ marginTop: 16 }}>
          {title ? (
            <Text
              minPresenceAhead={keepWithStart(md, ctx, 50)}
              style={{
                fontSize: 7.4,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: ctx.accent,
                marginBottom: 7,
              }}
            >
              {title}
            </Text>
          ) : null}
          <MarkdownPdf source={md} ctx={ctx} />
        </Flow>
      ))}
    </View>
  );
}

function cweUrl(cwe: string): string {
  const id = /(\d+)/.exec(cwe)?.[1];
  return id ? `https://cwe.mitre.org/data/definitions/${id}.html` : "https://cwe.mitre.org/";
}

const GUIDANCE: Record<Severity, string> = {
  Critical: "Easily exploited with severe impact. Fix immediately.",
  High: "Likely to be exploited with significant impact. Fix as a priority.",
  Medium: "Exploitable under some conditions or with moderate impact. Plan a fix.",
  Low: "Limited impact or hard to exploit. Fix as part of normal maintenance.",
  Info: "No direct security impact. Recorded as good-practice advice.",
};

function Appendix({ accent }: { accent: string }) {
  return (
    <Flow>
      <SectionTitle num="A" title="Severity rating" accent={accent} />
      <Text style={{ fontSize: 9.6, lineHeight: 1.55, color: INK }}>
        Each finding’s severity is the qualitative rating of its CVSS base score, using the scale
        defined in the CVSS v3.1 and v4.0 specifications published by FIRST. Where the assessor
        rated a finding differently from its score, for example because of compensating controls or
        business context, the finding says so and gives the reason. Findings without a CVSS vector
        are rated by the assessor.
      </Text>
      <View style={{ marginTop: 16 }}>
        <Grid
          widths={[0.2, 0.2, 0.6]}
          head={["Severity", "CVSS score", "Guidance"]}
          rows={RATING_SCALE.map((r) => [
            <SeverityPill key="s" severity={r.severity} />,
            <Text key="r" style={{ fontFamily: MONO, fontSize: 8.6 }}>
              {r.range}
            </Text>,
            <Text key="e" style={{ fontSize: 8.4, color: MUTED, lineHeight: 1.45 }}>
              {GUIDANCE[r.severity]}
            </Text>,
          ])}
        />
      </View>
      <Text style={{ fontSize: 8.4, lineHeight: 1.55, color: MUTED, marginTop: 14 }}>
        CVSS (Common Vulnerability Scoring System) is maintained by FIRST: first.org/cvss.
      </Text>
    </Flow>
  );
}
