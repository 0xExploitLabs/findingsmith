import type { CSSProperties, ReactNode } from "react";
import { rate } from "../domain/severity";
import { type Finding, SEVERITIES, type Severity } from "../domain/types";
import { cx, SEVERITY_CLASS } from "./primitives";

export type SeverityCounts = Record<Severity, number>;

export function countSeverities(findings: Finding[]): SeverityCounts {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as SeverityCounts;
  for (const f of findings) counts[rate(f).severity]++;
  return counts;
}

/**
 * Shares `cells` pixels between the severities in proportion to their counts.
 * Every severity that is present keeps at least one, so a single Critical
 * among forty Lows is still seen.
 */
export function shareCells(counts: SeverityCounts, cells: number): SeverityCounts {
  const present = SEVERITIES.filter((s) => counts[s] > 0);
  const share = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as SeverityCounts;
  const total = present.reduce((sum, s) => sum + counts[s], 0);
  if (total === 0 || cells < present.length) return share;
  for (const s of present) share[s] = 1;
  let left = cells - present.length;
  const exact = present.map((s) => ({ s, want: (counts[s] / total) * cells - 1 }));
  for (const e of exact) {
    const whole = Math.max(0, Math.min(left, Math.floor(e.want)));
    share[e.s] += whole;
    left -= whole;
    e.want -= whole;
  }
  // What rounding left over goes to the largest remainders, the gravest first on a tie.
  for (const e of [...exact].sort((a, b) => b.want - a.want)) {
    if (left <= 0) break;
    share[e.s]++;
    left--;
  }
  return share;
}

/**
 * How a set of findings splits by severity, drawn the way the rest of Debrief
 * draws: a row of pixels, each severity taking its share of them, and the same
 * counts in words, so colour is never the only signal.
 */
export function SeverityMix({
  counts,
  bar = true,
  labels = true,
  cells = 24,
  className,
}: {
  counts: SeverityCounts;
  bar?: boolean;
  labels?: boolean;
  /** How many pixels the row is made of. */
  cells?: number;
  className?: string;
}) {
  const present = SEVERITIES.filter((s) => counts[s] > 0);
  if (present.length === 0) return null;
  const share = shareCells(counts, cells);
  const summary = present.map((s) => `${counts[s]} ${s}`).join(", ");
  // One element per pixel, in severity order; its place in the row times its entrance.
  const pixels: ReactNode[] = [];
  for (const s of present) {
    for (let n = 0; n < share[s]; n++) {
      const place = pixels.length;
      pixels.push(
        <i
          key={place}
          className={cx("pixel-meter-cell", SEVERITY_CLASS[s].dot)}
          style={{ "--i": place } as CSSProperties}
        />,
      );
    }
  }
  return (
    <div className={cx("min-w-0", className)}>
      {bar ? (
        <div
          role="img"
          aria-label={summary}
          className="pixel-meter grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}
        >
          {pixels}
        </div>
      ) : null}
      {labels ? (
        <ul
          className={cx(
            "flex flex-wrap gap-x-3.5 gap-y-0.5 text-[12.5px] tabular-nums",
            bar && "mt-2",
          )}
        >
          {present.map((s) => (
            <li key={s} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={cx("size-[7px] rounded-[2px]", SEVERITY_CLASS[s].dot)} />
              <span className="font-semibold text-ink">{counts[s]}</span>
              <span className="text-ink-muted">{s}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="sr-only">{summary}</span>
      )}
    </div>
  );
}
