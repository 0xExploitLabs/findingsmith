import {
  ArrowDownWideNarrow,
  BookOpen,
  Check,
  ChevronLeft,
  CircleAlert,
  FileDown,
  FilePlus2,
  GripVertical,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatScore } from "../../domain/cvss";
import { compareFindings, rate } from "../../domain/severity";
import { type Finding, type Project, SEVERITIES } from "../../domain/types";
import { href, type Route } from "../../state/router";
import { cx, IconButton, Menu, SEVERITY_CLASS } from "../../ui/primitives";
import { ThemeToggle } from "../../ui/ThemeToggle";
import { Wordmark } from "../../ui/Wordmark";

export type SortMode = "severity" | "manual";

export function Sidebar({
  project,
  findings,
  refs,
  route,
  onNewFinding,
  onOpenLibrary,
  onReorder,
  saveState,
}: {
  project: Project;
  findings: Finding[];
  refs: Map<string, string>;
  route: Route;
  onNewFinding: () => void;
  onOpenLibrary: () => void;
  onReorder: (ids: string[]) => void;
  saveState: "saved" | "saving" | "error";
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("severity");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const ordered = useMemo(
    () =>
      sort === "severity"
        ? [...findings].sort(compareFindings)
        : [...findings].sort((a, b) => a.order - b.order),
    [findings, sort],
  );
  const visible = query
    ? ordered.filter((f) =>
        `${f.title} ${refs.get(f.id) ?? ""} ${f.cwe} ${f.affected}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : ordered;

  const counts = useMemo(() => {
    const c = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
      (typeof SEVERITIES)[number],
      number
    >;
    for (const f of findings) c[rate(f).severity]++;
    return c;
  }, [findings]);

  const activeFinding = route.name === "finding" ? route.findingId : null;
  const view = route.name === "project" ? route.view : null;
  const canDrag = sort === "manual" && !query;

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = ordered.map((f) => f.id).filter((id) => id !== dragId);
    const at = ids.indexOf(targetId);
    const from = ordered.findIndex((f) => f.id === dragId);
    const to = ordered.findIndex((f) => f.id === targetId);
    ids.splice(from < to ? at + 1 : at, 0, dragId);
    onReorder(ids);
  };

  return (
    <aside className="flex h-full w-[296px] shrink-0 flex-col border-r border-line bg-surface-1">
      <div className="flex h-14 items-center gap-1 border-b border-line px-3">
        <a
          href={href({ name: "home" })}
          className="flex h-8 items-center gap-1 rounded-lg pl-1 pr-2 text-[13px] text-ink-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <ChevronLeft className="size-4" />
          Projects
        </a>
        <div className="flex-1" />
        <Wordmark compact />
      </div>

      <div className="space-y-0.5 px-2 pt-3">
        <a
          href={href({ name: "project", projectId: project.id, view: "overview" })}
          aria-current={view === "overview" ? "page" : undefined}
          className={cx(
            "block rounded-lg px-2.5 py-2 transition-colors",
            view === "overview" ? "bg-surface-3" : "hover:bg-hover",
          )}
        >
          <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">
            {project.name || "Untitled project"}
          </span>
          <span className="block truncate text-[12.5px] text-ink-faint">
            {project.client || "Summary, scope and details"}
          </span>
        </a>
        <a
          href={href({ name: "project", projectId: project.id, view: "report" })}
          aria-current={view === "report" ? "page" : undefined}
          className={cx(
            "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors [&_svg]:size-4",
            view === "report"
              ? "bg-surface-3 text-ink"
              : "text-ink-muted hover:bg-hover hover:text-ink",
          )}
        >
          <FileDown />
          Export PDF
        </a>
      </div>

      <div className="mt-5 flex items-center gap-1 px-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
          Findings
        </span>
        <span className="font-mono text-[11px] text-ink-faint">{findings.length}</span>
        <div className="flex-1" />
        <Menu
          align="end"
          width={190}
          value={sort}
          heading="Sort"
          items={[
            { value: "severity", label: "By severity" },
            { value: "manual", label: "Manual order", hint: "Drag findings to reorder" },
          ]}
          onSelect={setSort}
          trigger={({ toggle, ref, open }) => (
            <IconButton
              ref={ref}
              label="Sort findings"
              onClick={toggle}
              aria-expanded={open}
              className="size-7"
            >
              <ArrowDownWideNarrow />
            </IconButton>
          )}
        />
        <Menu
          align="end"
          width={230}
          items={[
            {
              value: "blank",
              label: "Blank finding",
              icon: <FilePlus2 />,
              hint: "Start from scratch",
            },
            {
              value: "library",
              label: "From library",
              icon: <BookOpen />,
              hint: "Pre-written, with a CVSS vector",
            },
          ]}
          onSelect={(v) => (v === "blank" ? onNewFinding() : onOpenLibrary())}
          trigger={({ toggle, ref, open }) => (
            <IconButton
              ref={ref}
              label="Add finding"
              onClick={toggle}
              aria-expanded={open}
              className="size-7 text-accent hover:text-accent"
            >
              <Plus />
            </IconButton>
          )}
        />
      </div>

      {findings.length > 3 ? (
        <div className="px-3 pt-2">
          <div className="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 focus-within:border-accent">
            <Search className="size-3.5 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter findings"
              spellCheck={false}
              aria-label="Filter findings"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
        </div>
      ) : null}

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {findings.length === 0 ? (
          <div className="mx-2 mt-2 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center">
            <p className="text-[13px] text-ink-muted">No findings yet.</p>
            <div className="mt-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onOpenLibrary}
                className="text-[13px] font-medium text-accent hover:underline"
              >
                Browse the library
              </button>
              <button
                type="button"
                onClick={onNewFinding}
                className="text-[13px] text-ink-muted hover:text-ink"
              >
                or start blank
              </button>
            </div>
          </div>
        ) : null}
        <ul className="space-y-0.5">
          {visible.map((f) => {
            const r = rate(f);
            const active = activeFinding === f.id;
            return (
              <li
                key={f.id}
                draggable={canDrag}
                onDragStart={(e) => {
                  setDragId(f.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOverId(f.id);
                }}
                onDragLeave={() => setOverId((o) => (o === f.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(f.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className={cx(
                  "group/item relative",
                  dragId === f.id && "opacity-40",
                  overId === f.id &&
                    dragId !== f.id &&
                    "before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded before:bg-accent",
                )}
              >
                <a
                  href={href({ name: "finding", projectId: project.id, findingId: f.id })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex gap-2.5 rounded-lg py-2 pl-3 pr-2.5 transition-colors",
                    active ? "bg-surface-3" : "hover:bg-hover",
                  )}
                >
                  <span
                    className={cx(
                      "absolute bottom-2 left-0 top-2 w-[3px] rounded-r",
                      SEVERITY_CLASS[r.severity].dot,
                      !active && "opacity-80",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "line-clamp-2 text-[13px] leading-snug",
                        f.title ? "text-ink" : "italic text-ink-faint",
                      )}
                    >
                      {f.title || "Untitled finding"}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-faint">
                      <span className="font-mono">{refs.get(f.id)}</span>
                      <span className={SEVERITY_CLASS[r.severity].text}>{r.severity}</span>
                      {r.cvss ? (
                        <span className="font-mono">{formatScore(r.cvss.score)}</span>
                      ) : null}
                      {f.status !== "Open" ? <span className="truncate">· {f.status}</span> : null}
                    </span>
                  </span>
                  {canDrag ? (
                    <GripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab text-ink-faint opacity-0 group-hover/item:opacity-100" />
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-line px-4 py-3">
        {findings.length > 0 ? (
          <div className="mb-3">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-3">
              {SEVERITIES.filter((s) => counts[s] > 0).map((s) => (
                <div
                  key={s}
                  className={cx(
                    "h-full border-r border-surface-1 last:border-r-0",
                    SEVERITY_CLASS[s].dot,
                  )}
                  style={{ flex: counts[s] }}
                  title={`${counts[s]} ${s}`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11.5px]">
              {SEVERITIES.map((s) => (
                <span key={s} title={s} className="flex items-center gap-1.5">
                  <span
                    className={cx(
                      "size-1.5 rounded-[2px]",
                      SEVERITY_CLASS[s].dot,
                      counts[s] === 0 && "opacity-35",
                    )}
                  />
                  <span className={cx("font-mono", counts[s] > 0 ? "text-ink" : "text-ink-faint")}>
                    {counts[s]}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span
            role="status"
            className={cx(
              "flex items-center gap-1.5 text-[11.5px] [&_svg]:size-3.5",
              saveState === "error" ? "text-danger" : "text-ink-faint",
            )}
          >
            {saveState === "saving" ? (
              <LoaderCircle className="animate-spin" />
            ) : saveState === "error" ? (
              <CircleAlert />
            ) : (
              <Check />
            )}
            {saveState === "error" ? "Not saved, check storage" : "Saved in this browser"}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
