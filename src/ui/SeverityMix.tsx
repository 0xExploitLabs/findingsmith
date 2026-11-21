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
 * How a set of findings splits by severity: a bar whose segments are the
 * counts, and the same counts in words, so colour is never the only signal.
 */
export function SeverityMix({
  counts,
  bar = true,
  className,
}: {
  counts: SeverityCounts;
  bar?: boolean;
  className?: string;
}) {
  const present = SEVERITIES.filter((s) => counts[s] > 0);
  if (present.length === 0) return null;
  return (
    <div className={cx("min-w-0", className)}>
      {bar ? (
        <div
          role="img"
          aria-label={present.map((s) => `${counts[s]} ${s}`).join(", ")}
          className="grow-x flex h-1.5 gap-px overflow-hidden rounded-full"
        >
          {present.map((s) => (
            <span key={s} className={SEVERITY_CLASS[s].dot} style={{ flex: counts[s] }} />
          ))}
        </div>
      ) : null}
      <ul
        className={cx(
          "flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] tabular-nums",
          bar && "mt-1.5",
        )}
      >
        {present.map((s) => (
          <li key={s} className="whitespace-nowrap">
            <span className="font-semibold text-ink">{counts[s]}</span>{" "}
            <span className={SEVERITY_CLASS[s].text}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
