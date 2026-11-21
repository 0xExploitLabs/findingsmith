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
 * How a set of findings splits by severity: one quiet chip per severity that
 * is present, tinted in its colour, with the count and the name in words so
 * colour is never the only signal.
 */
export function SeverityMix({
  counts,
  compact,
  className,
}: {
  counts: SeverityCounts;
  /** Smaller chips, for the sidebar. */
  compact?: boolean;
  className?: string;
}) {
  const present = SEVERITIES.filter((s) => counts[s] > 0);
  if (present.length === 0) return null;
  return (
    <ul className={cx("flex min-w-0 flex-wrap gap-1.5", className)}>
      {present.map((s) => (
        <li
          key={s}
          className={cx(
            "flex items-center whitespace-nowrap rounded-full border tabular-nums",
            compact ? "h-[22px] gap-1 px-2 text-[11.5px]" : "h-6 gap-1.5 px-2.5 text-[12.5px]",
            SEVERITY_CLASS[s].soft,
          )}
        >
          <span className={cx("font-semibold", SEVERITY_CLASS[s].text)}>{counts[s]}</span>
          <span className="text-ink-muted">{s}</span>
        </li>
      ))}
    </ul>
  );
}
