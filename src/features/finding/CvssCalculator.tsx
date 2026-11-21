import { useEffect, useState } from "react";
import { formatScore, scoreVector } from "../../domain/cvss";
import { Button, cx, Dialog, SEVERITY_CLASS, SeverityBadge } from "../../ui/primitives";

/* The CVSS 3.1 base metrics, in the order the vector lists them. */
const METRICS = [
  {
    key: "AV",
    name: "Attack vector",
    hint: "Where the attacker has to be",
    values: [
      ["N", "Network"],
      ["A", "Adjacent"],
      ["L", "Local"],
      ["P", "Physical"],
    ],
  },
  {
    key: "AC",
    name: "Attack complexity",
    hint: "Conditions outside the attacker's control",
    values: [
      ["L", "Low"],
      ["H", "High"],
    ],
  },
  {
    key: "PR",
    name: "Privileges required",
    hint: "Access needed before the attack",
    values: [
      ["N", "None"],
      ["L", "Low"],
      ["H", "High"],
    ],
  },
  {
    key: "UI",
    name: "User interaction",
    hint: "Whether someone else has to act",
    values: [
      ["N", "None"],
      ["R", "Required"],
    ],
  },
  {
    key: "S",
    name: "Scope",
    hint: "Whether it reaches beyond the vulnerable component",
    values: [
      ["U", "Unchanged"],
      ["C", "Changed"],
    ],
  },
  {
    key: "C",
    name: "Confidentiality",
    hint: "Data the attacker can read",
    values: [
      ["N", "None"],
      ["L", "Low"],
      ["H", "High"],
    ],
  },
  {
    key: "I",
    name: "Integrity",
    hint: "Data the attacker can change",
    values: [
      ["N", "None"],
      ["L", "Low"],
      ["H", "High"],
    ],
  },
  {
    key: "A",
    name: "Availability",
    hint: "Service the attacker can deny",
    values: [
      ["N", "None"],
      ["L", "Low"],
      ["H", "High"],
    ],
  },
] as const;

type Picks = Record<string, string>;

const START: Picks = { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "N" };

/** The metric choices in a 3.1 vector; anything else starts from the defaults. */
function read(vector: string): Picks {
  if (!vector.startsWith("CVSS:3.1/")) return START;
  const picks = { ...START };
  for (const part of vector.split("/").slice(1)) {
    const [key, value] = part.split(":");
    const metric = METRICS.find((m) => m.key === key);
    if (metric && value && metric.values.some(([v]) => v === value)) picks[metric.key] = value;
  }
  return picks;
}

/**
 * Builds a CVSS 3.1 base vector from eight plain questions, showing the score
 * and its rating as the answers change.
 */
export function CvssCalculator({
  open,
  vector,
  onClose,
  onUse,
}: {
  open: boolean;
  /** The finding's current vector, to start from. */
  vector: string;
  onClose: () => void;
  onUse: (vector: string) => void;
}) {
  const [picks, setPicks] = useState<Picks>(START);
  useEffect(() => {
    if (open) setPicks(read(vector.trim()));
  }, [open, vector]);

  const built = `CVSS:3.1/${METRICS.map((m) => `${m.key}:${picks[m.key]}`).join("/")}`;
  const score = scoreVector(built);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={600}
      title="CVSS 3.1 calculator"
      description="Answer for the finding as it was found. The severity follows the score."
      footer={
        <>
          <div className="mr-auto flex min-w-0 items-center gap-2.5">
            {score ? (
              <>
                <span
                  className={cx(
                    "font-mono text-[18px] font-semibold tabular-nums",
                    SEVERITY_CLASS[score.severity].text,
                  )}
                >
                  {formatScore(score.score)}
                </span>
                <SeverityBadge severity={score.severity} />
              </>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onUse(built)}>
            Use this score
          </Button>
        </>
      }
    >
      <div className="divide-y divide-line">
        {METRICS.map((m) => (
          <fieldset
            key={m.key}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
          >
            <legend className="float-left min-w-0">
              <span className="block text-[13.5px] font-medium text-ink">{m.name}</span>
              <span className="block text-[12px] text-ink-faint">{m.hint}</span>
            </legend>
            <div className="flex rounded-lg border border-line-strong bg-surface-2 p-0.5">
              {m.values.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={picks[m.key] === value}
                  onClick={() => setPicks((p) => ({ ...p, [m.key]: value }))}
                  className={cx(
                    "h-7 rounded-md px-2.5 text-[12.5px] transition-colors duration-(--dur-micro)",
                    picks[m.key] === value
                      ? "bg-surface-1 font-medium text-ink shadow-[0_0_0_1px_rgb(var(--brand-ink)/0.14)]"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="mt-3 break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-ink-muted">
        {built}
      </p>
    </Dialog>
  );
}
