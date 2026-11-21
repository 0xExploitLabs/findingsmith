import { ChevronLeft, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LIBRARY, LIBRARY_CATEGORIES, type LibraryEntry } from "../../data/library";
import { formatScore, scoreVector } from "../../domain/cvss";
import { SheetMark } from "../../ui/Plot";
import { Button, cx, Dialog, SEVERITY_CLASS, SeverityBadge } from "../../ui/primitives";
import { Preview } from "../editor/Preview";

type Category = (typeof LIBRARY_CATEGORIES)[number] | "All";

function matches(entry: LibraryEntry, q: string): boolean {
  if (!q) return true;
  const hay = [entry.title, entry.category, entry.cwe, entry.owasp, ...entry.tags]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word));
}

export function LibraryDialog({
  open,
  onClose,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  onUse: (entry: LibraryEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A narrow screen shows one pane at a time: the list, then the chosen template.
  const [reading, setReading] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () =>
      LIBRARY.filter((e) => (category === "All" || e.category === category) && matches(e, query)),
    [query, category],
  );
  const selected = results.find((e) => e.id === selectedId) ?? results[0] ?? null;

  useEffect(() => {
    if (open) {
      setQuery("");
      setCategory("All");
      setSelectedId(null);
      setReading(false);
    }
  }, [open]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of LIBRARY) c.set(e.category, (c.get(e.category) ?? 0) + 1);
    return c;
  }, []);

  const move = (delta: number) => {
    if (!selected) return;
    const i = results.indexOf(selected);
    const next = results[Math.min(results.length - 1, Math.max(0, i + delta))];
    if (next) {
      setSelectedId(next.id);
      list.current?.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
    }
  };

  const score = selected ? scoreVector(selected.vector) : null;

  return (
    <Dialog open={open} onClose={onClose} width={1120} bare>
      <div className="flex h-[min(760px,calc(100dvh-2rem))] min-h-0 sm:h-[min(760px,calc(100dvh-4rem))]">
        <nav
          className="hidden w-[210px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface-2/50 p-2 md:flex"
          aria-label="Categories"
        >
          <h2 className="px-2.5 pb-2 pt-2 text-[12.5px] font-medium text-ink-faint">Categories</h2>
          {(["All", ...LIBRARY_CATEGORIES] as Category[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setSelectedId(null);
              }}
              className={cx(
                "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                category === c
                  ? "bg-surface-3 text-ink"
                  : "text-ink-muted hover:bg-hover hover:text-ink",
              )}
            >
              <span className="truncate">{c}</span>
              <span className="text-[12px] tabular-nums text-ink-faint">
                {c === "All" ? LIBRARY.length : (counts.get(c) ?? 0)}
              </span>
            </button>
          ))}
        </nav>

        <div
          className={cx(
            "flex shrink-0 flex-col border-line max-md:w-full md:w-[340px] md:border-r",
            reading && "max-md:hidden",
          )}
        >
          <div className="border-b border-line p-3">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 focus-within:border-accent">
              <Search className="size-4 text-ink-faint" />
              <input
                data-autofocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    move(1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    move(-1);
                  } else if (e.key === "Enter" && selected) {
                    onUse(selected);
                  }
                }}
                placeholder="Search by name, CWE or tag"
                spellCheck={false}
                aria-label="Search the library"
                className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
              />
            </div>
            <div className="-mx-3 mt-2.5 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:hidden">
              {(["All", ...LIBRARY_CATEGORIES] as Category[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(c);
                    setSelectedId(null);
                  }}
                  className={cx(
                    "h-7 shrink-0 rounded-full border px-2.5 text-[12.5px] transition-colors duration-(--dur-micro)",
                    category === c
                      ? "border-line-hover bg-surface-3 text-ink"
                      : "border-line-strong text-ink-muted",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div
            ref={list}
            className="min-h-0 flex-1 overflow-y-auto p-1.5"
            role="listbox"
            aria-label="Templates"
          >
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-ink-faint">
                No templates match.
              </p>
            ) : (
              results.map((e) => {
                const s = scoreVector(e.vector);
                return (
                  <button
                    key={e.id}
                    data-id={e.id}
                    type="button"
                    role="option"
                    aria-selected={selected?.id === e.id}
                    onClick={() => {
                      setSelectedId(e.id);
                      setReading(true);
                    }}
                    onDoubleClick={() => onUse(e)}
                    className={cx(
                      "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      selected?.id === e.id ? "bg-surface-3" : "hover:bg-hover",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-snug text-ink">{e.title}</span>
                      <span className="mt-0.5 flex gap-3 truncate text-[12px] text-ink-faint">
                        <span>{e.category}</span>
                        <span>{e.cwe}</span>
                      </span>
                    </span>
                    <span
                      className={cx(
                        "mt-0.5 font-mono text-[12px] font-semibold tabular-nums",
                        s && SEVERITY_CLASS[s.severity].text,
                      )}
                    >
                      {s ? formatScore(s.score) : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={cx("min-w-0 flex-1 flex-col", reading ? "flex" : "hidden md:flex")}>
          {selected && score ? (
            <>
              <div className="border-b border-line px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
                <button
                  type="button"
                  onClick={() => setReading(false)}
                  className="-ml-2 mb-2 flex h-8 items-center gap-1 rounded-lg pl-1 pr-2.5 text-[13px] text-ink-muted transition-colors hover:bg-hover hover:text-ink md:hidden"
                >
                  <ChevronLeft className="size-4" />
                  All templates
                </button>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-faint">
                  <span>{selected.category}</span>
                  <span className="font-mono text-[12px]">{selected.cwe}</span>
                  <span className="truncate">OWASP {selected.owasp}</span>
                </div>
                <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.015em]">
                  {selected.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <SeverityBadge severity={score.severity} />
                  <span
                    className={cx(
                      "font-mono text-[13px] font-semibold",
                      SEVERITY_CLASS[score.severity].text,
                    )}
                  >
                    {formatScore(score.score)}
                  </span>
                  <span className="break-all font-mono text-[11px] text-ink-faint">
                    {selected.vector}
                  </span>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {(
                  [
                    ["Description", selected.description],
                    ["Impact", selected.impact],
                    ["Remediation", selected.remediation],
                    ["References", selected.references],
                  ] as const
                ).map(([label, md]) => (
                  <div key={label} className="border-b border-line last:border-b-0">
                    <h3 className="px-5 pt-4 text-[14px] font-semibold text-ink sm:px-6">
                      {label}
                    </h3>
                    <Preview source={md} className="px-5 pb-4 pt-2 sm:px-6" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3.5 sm:px-6">
                <p className="mr-auto text-[12px] text-ink-faint max-sm:hidden">
                  Edit the text to fit what you found. The vector sets the severity.
                </p>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" icon={<Plus />} onClick={() => onUse(selected)}>
                  Add finding
                </Button>
              </div>
            </>
          ) : (
            <div className="m-auto flex flex-col items-center gap-3 text-[13px] text-ink-faint">
              <SheetMark />
              Select a template to preview it.
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
