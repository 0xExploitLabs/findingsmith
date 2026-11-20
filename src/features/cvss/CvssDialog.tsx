import { Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildVector,
  carryOver31to40,
  DEFAULT_SELECTION,
  formatScore,
  type MetricSelection,
  metricsFor,
  parseVector,
  RATING_SCALE,
  scoreVector,
} from "../../domain/cvss";
import type { CvssVersion } from "../../domain/types";
import { Button, cx, Dialog, SEVERITY_CLASS, SeverityBadge, TextArea } from "../../ui/primitives";
import { toast } from "../../ui/toast";

export function CvssDialog({
  open,
  onClose,
  vector,
  defaultVersion,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  vector: string;
  defaultVersion: CvssVersion;
  onApply: (vector: string) => void;
}) {
  const [version, setVersion] = useState<CvssVersion>(defaultVersion);
  const [selection, setSelection] =
    useState<Record<CvssVersion, MetricSelection>>(DEFAULT_SELECTION);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const parsed = parseVector(vector);
    if (parsed.ok) {
      setVersion(parsed.version);
      setSelection({ ...DEFAULT_SELECTION, [parsed.version]: parsed.metrics });
    } else {
      setVersion(defaultVersion);
      setSelection(DEFAULT_SELECTION);
    }
    setDraftError(null);
  }, [open, vector, defaultVersion]);

  const current = buildVector(version, selection[version]);
  const score = useMemo(() => scoreVector(current), [current]);
  useEffect(() => setDraft(current), [current]);

  const metrics = metricsFor(version);
  const groups = [...new Set(metrics.map((m) => m.group))];

  const set = (key: string, code: string) =>
    setSelection((s) => {
      const next = { ...s[version] };
      if (next[key] === code && metrics.find((m) => m.key === key)?.optional) delete next[key];
      else next[key] = code;
      return { ...s, [version]: next };
    });

  const switchTo = (v: CvssVersion) => {
    setDraftError(null);
    setVersion(v);
    const isDefault = (ver: CvssVersion) =>
      buildVector(ver, selection[ver]) === buildVector(ver, DEFAULT_SELECTION[ver]);
    if (v === "4.0" && isDefault("4.0") && !isDefault("3.1")) {
      setSelection((s) => ({ ...s, "4.0": carryOver31to40(s["3.1"]) }));
    }
  };

  const applyDraft = (text: string) => {
    const parsed = parseVector(text);
    if (!parsed.ok) {
      setDraftError(parsed.error);
      return;
    }
    setDraftError(null);
    setVersion(parsed.version);
    setSelection((s) => ({ ...s, [parsed.version]: parsed.metrics }));
  };

  const sev = score?.severity ?? "Info";

  return (
    <Dialog open={open} onClose={onClose} width={880} bare>
      <div className="flex max-h-[calc(100vh-4rem)] min-h-0 flex-col md:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold tracking-[-0.01em]">CVSS calculator</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                Base metrics. Severity follows the score.
              </p>
            </div>
            <div
              className="flex rounded-lg border border-line-strong bg-surface-2 p-0.5"
              role="tablist"
              aria-label="CVSS version"
            >
              {(["3.1", "4.0"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={version === v}
                  onClick={() => switchTo(v)}
                  className={cx(
                    "h-7 rounded-md px-3 text-[12.5px] font-semibold transition-colors",
                    version === v ? "bg-accent text-ink-inverse" : "text-ink-muted hover:text-ink",
                  )}
                >
                  v{v}
                </button>
              ))}
            </div>
          </div>

          {groups.map((group) => (
            <section key={group} className="mt-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
                {group}
              </h3>
              <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                {metrics
                  .filter((m) => m.group === group)
                  .map((m) => {
                    const selected = selection[version][m.key];
                    const selectedValue = m.values.find((v) => v.code === selected);
                    return (
                      <div key={m.key}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <span className="text-[12.5px] font-medium" title={m.help}>
                            {m.label}
                            <span className="ml-1.5 font-mono text-[11px] text-ink-faint">
                              {m.key}
                            </span>
                          </span>
                        </div>
                        <fieldset className="flex min-w-0 gap-1">
                          <legend className="sr-only">{m.label}</legend>
                          {m.values.map((v) => (
                            <button
                              key={v.code}
                              type="button"
                              aria-pressed={selected === v.code}
                              title={v.help}
                              onClick={() => set(m.key, v.code)}
                              className={cx(
                                "h-8 min-w-0 flex-1 truncate rounded-lg border px-1.5 text-[12.5px] font-medium transition-colors",
                                selected === v.code
                                  ? "border-[rgb(var(--brand-accent)/0.6)] bg-[rgb(var(--brand-accent)/0.14)] text-ink"
                                  : "border-line-strong text-ink-muted hover:border-[rgb(var(--brand-ink)/0.22)] hover:text-ink",
                              )}
                            >
                              {v.label}
                            </button>
                          ))}
                        </fieldset>
                        <p className="mt-1 min-h-[1.2em] text-[11.5px] leading-snug text-ink-faint">
                          {selectedValue
                            ? selectedValue.help
                            : m.optional
                              ? "Not set: base score only."
                              : m.help}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>

        <aside className="flex w-full shrink-0 flex-col border-t border-line bg-surface-2/60 px-6 pb-5 pt-5 md:w-[300px] md:border-l md:border-t-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
            {score?.nomenclature ?? `CVSS ${version}`}
          </div>
          <div className="mt-2 flex items-end gap-3">
            <span
              className={cx(
                "text-[56px] font-semibold leading-none tracking-[-0.04em]",
                SEVERITY_CLASS[sev].text,
              )}
            >
              {score ? formatScore(score.score) : "-"}
            </span>
            <SeverityBadge severity={sev} className="mb-1.5" />
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cx(
                "h-full rounded-full transition-[width] duration-300",
                SEVERITY_CLASS[sev].dot,
              )}
              style={{ width: `${(score?.score ?? 0) * 10}%` }}
            />
          </div>

          <label className="mt-6 text-[12px] font-medium text-ink-muted" htmlFor="cvss-vector">
            Vector
          </label>
          <TextArea
            id="cvss-vector"
            rows={3}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftError(null);
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text").trim();
              e.preventDefault();
              setDraft(text);
              applyDraft(text);
            }}
            onBlur={() => draft !== current && applyDraft(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyDraft(draft);
              }
            }}
            className="mt-1.5 resize-none break-all font-mono text-[11.5px] leading-relaxed"
          />
          <p className={cx("mt-1.5 text-[11.5px]", draftError ? "text-danger" : "text-ink-faint")}>
            {draftError ?? "Paste a full CVSS 3.1 or 4.0 vector to load it."}
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(current).then(() => toast("Vector copied"));
            }}
            className="mt-1 inline-flex w-fit items-center gap-1.5 text-[12px] text-ink-muted hover:text-ink [&_svg]:size-3.5"
          >
            <Copy /> Copy vector
          </button>

          <div className="mt-6 rounded-lg border border-line px-3 py-2.5">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
              Rating scale
            </div>
            {RATING_SCALE.map((r) => (
              <div
                key={r.severity}
                className={cx(
                  "flex justify-between py-0.5 text-[12px]",
                  r.severity === sev ? "text-ink" : "text-ink-faint",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cx("size-1.5 rounded-[2px]", SEVERITY_CLASS[r.severity].dot)} />
                  {r.severity}
                </span>
                <span className="font-mono">{r.range}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
            {vector ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 />}
                onClick={() => {
                  onApply("");
                  onClose();
                }}
              >
                Remove
              </Button>
            ) : null}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              data-autofocus
              disabled={!score}
              onClick={() => {
                onApply(current);
                onClose();
              }}
            >
              Apply
            </Button>
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
