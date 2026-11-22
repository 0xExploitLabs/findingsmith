import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { type CvssScore, formatScore } from "../../domain/cvss";
import { SEVERITY_HEX } from "../../domain/severity";
import { SEVERITIES, type Severity } from "../../domain/types";
import type { Section } from "../../markdown/sections";
import { coverPixels, MEDIUM_TEXT, onColor, tint } from "../../pdf/palette";
import { cx } from "../../ui/primitives";
import { Preview } from "../editor/Preview";

/* The PDF is laid out in points on A4. Here one point is one CSS pixel and the
   whole page is zoomed to the width it is given, so every size below is the
   number src/pdf/Report.tsx uses. A narrow screen gets a narrower page with
   the same type, because A4 at phone width would be too small to read. */
const A4 = { width: 595.28, height: 841.89, margin: 56 };
const NARROW = { width: 330, height: 467, margin: 22 };
type PageSize = typeof A4;

/* Small labels print in a fainter grey; on screen they take the muted one, which
   reads at this size. */
const LABEL = "text-[6.8px] font-bold uppercase leading-[1.2] tracking-[0.9px] text-ink-muted";

/** Who the sample report is for and by: the same on every page of it. */
export interface ReportParties {
  client: string;
  name: string;
  preparedBy: string;
  classification: string;
}

type Fit = "fit" | "a4";

/**
 * A sheet of the report at the width it is given: paper white, set in the
 * report's own faces, and at least one page tall. "fit" narrows the page on a
 * small screen; "a4" always keeps the full page.
 */
function Sheet({
  as: Tag = "div",
  size = "fit",
  name,
  className,
  sheetClassName,
  children,
}: {
  as?: "article" | "div";
  size?: Fit;
  /** Names the page for styling, as `data-page`. */
  name?: string;
  className?: string;
  sheetClassName?: string;
  children: (page: PageSize) => ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ zoom: 1, page: A4 });

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      if (!width) return;
      const page = size === "fit" && width < 480 ? NARROW : A4;
      setFit((old) => {
        const zoom = Math.round((width / page.width) * 1000) / 1000;
        return old.zoom === zoom && old.page === page ? old : { zoom, page };
      });
    };
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(el);
    return () => resized.disconnect();
  }, [size]);

  const { page, zoom } = fit;
  return (
    <div
      ref={frame}
      data-page={name}
      // Only the finding is read; the pages shown around it are pictures of pages.
      aria-hidden={Tag === "div" ? true : undefined}
      className={cx("w-full", className)}
    >
      <Tag
        className={cx(
          "sheet relative flex flex-col bg-sheet font-report text-[9.6px] leading-[1.55] shadow-page",
          sheetClassName,
        )}
        style={{ zoom, width: page.width, minHeight: `max(${page.height}px, 100%)` }}
      >
        {children(page)}
      </Tag>
    </div>
  );
}

/** The running head and the folio every page after the cover carries. */
function Chrome({
  page,
  parties,
  folio,
}: {
  page: PageSize;
  parties: ReportParties;
  folio: string;
}) {
  return (
    <>
      <div
        className="absolute top-[30px] flex items-baseline justify-between gap-4 border-b-[0.6px] border-line pb-[7px] text-[7.4px] leading-[1.2] text-ink-muted"
        style={{ insetInline: page.margin }}
      >
        <span className="truncate">
          {parties.client}&ensp;/&ensp;{parties.name}
        </span>
        <span className="shrink-0 text-[7px] font-bold uppercase tracking-[1.2px] text-accent">
          {parties.classification}
        </span>
      </div>
      <div
        className="absolute bottom-[28px] flex justify-between gap-4 text-[7.4px] leading-[1.2] text-ink-muted"
        style={{ insetInline: page.margin }}
      >
        <span>{parties.preparedBy}</span>
        <span className="tabular-nums">{folio}</span>
      </div>
    </>
  );
}

function Pill({ severity }: { severity: Severity }) {
  const color = SEVERITY_HEX[severity];
  return (
    <span
      key={severity}
      className="animate-in flex items-center gap-[4.5px] rounded-[2.5px] px-[7px] py-[3px] text-[7.8px] font-bold uppercase leading-[1.2] tracking-[0.4px]"
      style={{
        backgroundColor: tint(color, 0.86),
        color: severity === "Medium" ? MEDIUM_TEXT : color,
      }}
    >
      <span className="size-[5.5px] rounded-[1px]" style={{ backgroundColor: color }} />
      {severity}
    </span>
  );
}

/**
 * One finding as the PDF prints it: the running head, the reference and
 * severity, the score box, the properties, each section and the folio.
 */
export function ReportSheet({
  title,
  score,
  sections,
  parties,
  properties = [],
  reference = "F-01",
  folio = "6 / 12",
  size = "fit",
  className,
}: {
  title: string;
  score: CvssScore | null;
  sections: Section[];
  parties: ReportParties;
  /** The finding's properties, as rows of a label and a value set in the code face. */
  properties?: { label: string; value: ReactNode }[];
  reference?: string;
  folio?: string;
  size?: Fit;
  className?: string;
}) {
  const color = score ? SEVERITY_HEX[score.severity] : "";
  return (
    <Sheet as="article" size={size} className={className} sheetClassName="pb-[64px] pt-[70px]">
      {(page) => (
        <div style={{ paddingInline: page.margin }}>
          <Chrome page={page} parties={parties} folio={folio} />
          <div className="mb-[8px] flex items-center gap-[8px]">
            <span className="font-mono text-[8.6px] font-bold leading-none text-accent">
              {reference}
            </span>
            {score ? <Pill severity={score.severity} /> : null}
          </div>
          <h3 className="font-report text-[17px] font-extrabold leading-[1.22] text-ink">
            {title || "Untitled finding"}
          </h3>

          {score ? (
            <div className="mt-[14px] flex overflow-hidden rounded-[3px] border-[0.75px] border-line">
              <div
                className="w-[96px] shrink-0 border-r-[0.75px] border-line p-[10px] transition-colors duration-(--dur-short)"
                style={{ backgroundColor: tint(color, 0.9) }}
              >
                <div className={LABEL}>{score.nomenclature}</div>
                <div
                  key={score.score}
                  className="animate-rise mt-[3px] font-report text-[22px] font-extrabold leading-[1.2] tabular-nums"
                  style={{ color }}
                >
                  {formatScore(score.score)}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center p-[10px]">
                {score.vector ? (
                  <>
                    <div className={LABEL}>Vector</div>
                    <div className="mt-[3px] break-all font-mono text-[7.6px] leading-[1.3] text-ink">
                      {score.vector}
                    </div>
                  </>
                ) : (
                  <div className="text-[8.4px] leading-[1.4] text-ink-muted">
                    CVSS base score as reported by the assessor.
                  </div>
                )}
                <div className="mt-[6px] text-[8px] leading-[1.3] text-ink-muted">
                  Status: <span className="font-semibold text-ink">Open</span>
                </div>
              </div>
            </div>
          ) : null}

          {properties.length > 0 ? (
            <dl className="mt-[14px]">
              {properties.map(({ label, value }) => (
                <div key={label} className="flex border-b-[0.6px] border-line py-[5px]">
                  <dt className="w-[92px] shrink-0 pt-[1.5px] text-[7px] font-bold uppercase leading-[1.2] tracking-[0.8px] text-ink-muted">
                    {label}
                  </dt>
                  <dd className="min-w-0 flex-1 break-all font-mono text-[8px] leading-[1.35] text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {sections.map((s) => (
            <section key={s.title} className="animate-rise mt-[16px]">
              {s.title ? (
                <h4 className="mb-[7px] text-[7.4px] font-bold uppercase leading-[1.2] tracking-[1.2px] text-accent">
                  {s.title}
                </h4>
              ) : null}
              <Preview source={s.markdown} className="sheet-prose" />
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}

const COVER_ROWS = coverPixels(34, 4);
const COVER_TINTS = [0, 0.3, 0.55, 0.72];
const COVER_LABEL =
  "text-[6.8px] font-bold uppercase leading-[1.2] tracking-[1.1px] text-ink-muted";

/**
 * The report's cover as the PDF prints it: who made it and how it is
 * classified, a block of the report's colour carrying its title, whose lower
 * edge breaks up into pixels, then what was found and the particulars.
 */
export function ReportCover({
  parties,
  accent,
  counts,
  particulars,
  page,
  size = "fit",
  className,
}: {
  parties: ReportParties;
  accent: string;
  counts: Partial<Record<Severity, number>>;
  particulars: [string, string][];
  /** Names the page for styling, as `data-page`. */
  page?: string;
  size?: Fit;
  className?: string;
}) {
  const on = onColor(accent);
  const found = SEVERITIES.map((severity) => ({ severity, count: counts[severity] ?? 0 })).filter(
    (c) => c.count > 0,
  );
  const total = found.reduce((sum, c) => sum + c.count, 0);
  return (
    <Sheet size={size} name={page} className={className}>
      {(page) => (
        <>
          <div
            className="flex h-[112px] shrink-0 items-center justify-between gap-4"
            style={{ paddingInline: page.margin }}
          >
            <span className="text-[9.5px] font-bold uppercase leading-[1.2] tracking-[1.6px] text-ink">
              {parties.preparedBy}
            </span>
            <span
              className="rounded-[3px] border px-[9px] py-[4px] text-[7.4px] font-bold uppercase leading-[1.2] tracking-[1.4px]"
              style={{ borderColor: accent, color: accent }}
            >
              {parties.classification}
            </span>
          </div>
          <div
            className="flex min-h-[372px] shrink-0 flex-col justify-end pb-[44px] pt-[60px]"
            style={{ backgroundColor: accent, color: on, paddingInline: page.margin }}
          >
            <span className="text-[9px] font-bold uppercase leading-[1.2] tracking-[2.2px] opacity-[0.78]">
              Penetration test report
            </span>
            <span className="mt-[14px] font-report text-[36px] font-extrabold leading-[1.1]">
              {parties.name}
            </span>
            <span className="mt-[14px] text-[14px] leading-[1.2] opacity-[0.86]">
              {parties.client}
            </span>
          </div>
          {/* The block's edge, broken into pixels that thin out down the page. */}
          <svg
            viewBox={`0 0 34 ${COVER_ROWS.length}`}
            preserveAspectRatio="none"
            shapeRendering="crispEdges"
            aria-hidden="true"
            className="block w-full shrink-0"
            style={{ height: (page.width / 34) * COVER_ROWS.length }}
          >
            {COVER_ROWS.map((row, r) =>
              row.map((inked, c) =>
                inked ? (
                  <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, never reordered
                    key={`${r}-${c}`}
                    x={c - 0.01}
                    y={r - 0.01}
                    width={1.02}
                    height={1.02}
                    fill={tint(accent, COVER_TINTS[r] ?? 0.8)}
                  />
                ) : null,
              ),
            )}
          </svg>
          <div
            className="flex flex-1 flex-col justify-end pb-[46px]"
            style={{ paddingInline: page.margin }}
          >
            <div className="mb-[20px]">
              <div className={COVER_LABEL}>{total} findings</div>
              <div className="mt-[7px] flex flex-wrap gap-x-[18px] gap-y-[4px]">
                {found.map(({ severity, count }) => (
                  <span
                    key={severity}
                    className="flex items-center text-[10.5px] leading-[1.2] text-ink-muted"
                  >
                    <span
                      className="mr-[6px] size-[7px] rounded-[1.2px]"
                      style={{ backgroundColor: SEVERITY_HEX[severity] }}
                    />
                    <span className="mr-[4px] font-bold text-ink">{count}</span>
                    {severity}
                  </span>
                ))}
              </div>
            </div>
            <dl className="flex flex-wrap border-t-[0.75px] border-line">
              {particulars.map(([name, value]) => (
                <div key={name} className="w-1/2 border-b-[0.75px] border-line py-[10px] pr-[12px]">
                  <dt className={COVER_LABEL}>{name}</dt>
                  <dd className="mt-[3px] text-[10px] leading-[1.2] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-[14px] text-[7px] leading-[1.5] text-ink-muted">
              This document is {parties.classification.toLowerCase()}. It contains
              security-sensitive information about {parties.client} and must be shared only with
              authorised recipients.
            </p>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** One line of the contents: a section, or a finding listed under "Detailed findings". */
export interface ContentsEntry {
  num: string;
  label: string;
  page: number;
  finding?: boolean;
}

/** The contents page as the PDF prints it: every section and finding with its page number. */
export function ReportContents({
  parties,
  entries,
  folio = "2 / 12",
  page,
  size = "fit",
  className,
}: {
  parties: ReportParties;
  entries: ContentsEntry[];
  folio?: string;
  /** Names the page for styling, as `data-page`. */
  page?: string;
  size?: Fit;
  className?: string;
}) {
  return (
    <Sheet size={size} name={page} className={className} sheetClassName="pb-[64px] pt-[70px]">
      {(page) => (
        <div style={{ paddingInline: page.margin }}>
          <Chrome page={page} parties={parties} folio={folio} />
          <div className="mb-[16px]">
            <div className="font-report text-[20px] font-extrabold leading-[1.2] text-ink">
              Contents
            </div>
            <div className="mt-[9px] h-[2px] w-[36px] bg-accent" />
          </div>
          <ol className="mt-[6px]">
            {entries.map((entry) => (
              <li
                key={entry.num}
                className={cx(
                  "flex items-end",
                  entry.finding ? "py-[3px] pl-[24px]" : "mt-[4px] py-[5px]",
                )}
              >
                <span
                  className={cx(
                    "shrink-0 font-bold leading-[1.2]",
                    entry.finding
                      ? "w-[40px] font-mono text-[7.8px] text-ink-muted"
                      : "w-[24px] text-[10.5px] text-accent",
                  )}
                >
                  {entry.num}
                </span>
                <span
                  className={cx(
                    "leading-[1.2]",
                    entry.finding
                      ? "text-[9px] text-ink-muted"
                      : "text-[10.5px] font-semibold text-ink",
                  )}
                >
                  {entry.label}
                </span>
                <span className="mx-[6px] mb-[3px] min-w-[12px] flex-1 border-b-[0.6px] border-dotted border-line" />
                <span
                  className={cx(
                    "shrink-0 leading-[1.2] text-ink-muted tabular-nums",
                    entry.finding ? "text-[8.6px]" : "text-[10px]",
                  )}
                >
                  {entry.page}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Sheet>
  );
}
