import { useLayoutEffect, useRef, useState } from "react";
import { type CvssScore, formatScore } from "../../domain/cvss";
import { SEVERITY_HEX } from "../../domain/severity";
import type { Section } from "../../markdown/sections";
import { MEDIUM_TEXT, tint } from "../../pdf/palette";
import { cx } from "../../ui/primitives";
import { Preview } from "../editor/Preview";

/* The PDF is laid out in points on A4. Here one point is one CSS pixel and the
   whole page is zoomed to the width it is given, so every size below is the
   number src/pdf/Report.tsx uses. A narrow screen gets a narrower page with
   the same type, because A4 at phone width would be too small to read. */
const A4 = { width: 595.28, height: 841.89, margin: 56 };
const NARROW = { width: 330, height: 467, margin: 22 };

const LABEL = "text-[6.8px] font-bold uppercase leading-[1.2] tracking-[0.9px] text-ink-muted";

/**
 * One page of the report as the PDF prints it: the running head, a finding
 * with its score box and sections, and the folio. Always paper white.
 */
export function ReportSheet({
  title,
  score,
  sections,
  className,
}: {
  title: string;
  score: CvssScore | null;
  sections: Section[];
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ zoom: 1, page: A4 });

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      if (!width) return;
      const page = width < 480 ? NARROW : A4;
      setFit((old) => {
        const zoom = Math.round((width / page.width) * 1000) / 1000;
        return old.zoom === zoom && old.page === page ? old : { zoom, page };
      });
    };
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(el);
    return () => resized.disconnect();
  }, []);

  const { page, zoom } = fit;
  const color = score ? SEVERITY_HEX[score.severity] : "";
  return (
    <div ref={frame} className={cx("w-full", className)}>
      <article
        className="sheet relative flex flex-col bg-sheet pb-[64px] pt-[70px] font-report text-[9.6px] leading-[1.55] shadow-page"
        style={{
          zoom,
          width: page.width,
          minHeight: page.height,
          paddingInline: page.margin,
        }}
      >
        <div
          className="absolute top-[30px] flex items-baseline justify-between gap-4 border-b-[0.6px] border-line pb-[7px] text-[7.4px] leading-[1.2] text-ink-muted"
          style={{ insetInline: page.margin }}
        >
          <span className="truncate">
            Northwind Traders&ensp;/&ensp;External web application test
          </span>
          <span className="shrink-0 text-[7px] font-bold uppercase tracking-[1.2px] text-accent">
            Confidential
          </span>
        </div>

        <div className="mb-[8px] flex items-center gap-[8px]">
          <span className="font-mono text-[8.6px] font-bold leading-none text-accent">F-01</span>
          {score ? (
            <span
              key={score.severity}
              className="animate-in flex items-center gap-[4.5px] rounded-[2.5px] px-[7px] py-[3px] text-[7.8px] font-bold uppercase leading-[1.2] tracking-[0.4px]"
              style={{
                backgroundColor: tint(color, 0.86),
                color: score.severity === "Medium" ? MEDIUM_TEXT : color,
              }}
            >
              <span className="size-[5.5px] rounded-[1px]" style={{ backgroundColor: color }} />
              {score.severity}
            </span>
          ) : null}
        </div>
        <h3 className="font-report-display text-[17px] font-bold leading-[1.22] text-ink">
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
                className="animate-rise mt-[3px] font-report-display text-[22px] font-bold leading-[1.2] tabular-nums"
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

        <div
          className="absolute bottom-[28px] flex justify-between gap-4 text-[7.4px] leading-[1.2] text-sheet-faint"
          style={{ insetInline: page.margin }}
        >
          <span>Kestrel Security&ensp;/&ensp;Version 1.0</span>
          <span className="tabular-nums text-ink-muted">6 / 12</span>
        </div>
      </article>
    </div>
  );
}
