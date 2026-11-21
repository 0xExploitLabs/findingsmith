import {
  ArrowDownWideNarrow,
  BookOpen,
  Check,
  ChevronLeft,
  CircleAlert,
  FileDown,
  FilePlus2,
  FileText,
  GripVertical,
  LoaderCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LIBRARY } from "../../data/library";
import { formatScore } from "../../domain/cvss";
import { compareFindings, rate } from "../../domain/severity";
import type { Finding, Project } from "../../domain/types";
import { href, type Route } from "../../state/router";
import { MOD_KEY } from "../../ui/platform";
import { cx, IconButton, Kbd, Menu, SEVERITY_CLASS } from "../../ui/primitives";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
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
  onOpenSwitcher,
  saveState,
  open,
  onClose,
}: {
  project: Project;
  findings: Finding[];
  refs: Map<string, string>;
  route: Route;
  onNewFinding: () => void;
  onOpenLibrary: () => void;
  onReorder: (ids: string[]) => void;
  onOpenSwitcher: () => void;
  saveState: "saved" | "saving" | "error";
  /** On a narrow screen the sidebar is a drawer; this is whether it is out. */
  open: boolean;
  onClose: () => void;
}) {
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

  const counts = useMemo(() => countSeverities(findings), [findings]);

  const activeFinding = route.name === "finding" ? route.findingId : null;
  const view = route.name === "project" ? route.view : null;
  const canDrag = sort === "manual";

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
    <aside
      id="project-nav"
      className={cx(
        "flex h-full w-[296px] shrink-0 flex-col border-r border-line bg-surface-1 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(320px,calc(100vw-3rem))] max-md:shadow-pop max-md:transition-[translate,visibility] max-md:duration-(--dur-medium) max-md:ease-(--ease-glide)",
        !open && "max-md:invisible max-md:-translate-x-full",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-3">
        <a
          href={href({ name: "projects" })}
          className="flex h-8 items-center gap-1 rounded-lg pl-1 pr-2 text-[13px] text-ink-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <ChevronLeft className="size-4" />
          Projects
        </a>
        <div className="flex-1" />
        <Wordmark compact className="max-md:hidden" />
        <IconButton label="Close project menu" onClick={onClose} className="md:hidden">
          <X />
        </IconButton>
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onOpenSwitcher}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink-muted"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          <Kbd>{MOD_KEY} K</Kbd>
        </button>
      </div>

      <a
        href={href({ name: "project", projectId: project.id, view: "overview" })}
        aria-current={view === "overview" ? "page" : undefined}
        title="Project overview"
        className={cx(
          "mx-2 mt-3 block truncate rounded-lg px-2 py-1.5 text-[15px] font-semibold tracking-[-0.01em] transition-colors duration-(--dur-micro)",
          view === "overview" ? "bg-surface-3" : "hover:bg-hover",
        )}
      >
        {project.name || "Untitled project"}
      </a>

      <div className="mt-2 flex items-center gap-1.5 pl-4 pr-3">
        <h2 className="text-[13px] font-semibold text-ink">Findings</h2>
        <span className="text-[13px] tabular-nums text-ink-faint">{findings.length}</span>
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

      <SeverityMix counts={counts} bar={false} className="px-4 pb-1 pt-0.5" />

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {findings.length === 0 ? (
          <div className="mx-2 mt-1 rounded-xl bg-surface-2 p-4">
            <div aria-hidden="true" className="relative mb-4 ml-1 h-[58px] w-[112px]">
              {(["Critical", "High", "Medium"] as const).map((severity, i) => (
                <span
                  key={severity}
                  className="absolute top-0 block h-[58px] w-[76px] rounded-md border border-line-strong bg-surface-1 p-2 shadow-[0_6px_14px_-8px_rgb(var(--brand-shadow)/0.5)]"
                  style={{ left: i * 18, rotate: `${(i - 1) * 5}deg` }}
                >
                  <span
                    className={cx("block h-1.5 w-6 rounded-full", SEVERITY_CLASS[severity].dot)}
                  />
                  <span className="mt-2 block h-1 w-full rounded-full bg-line-strong" />
                  <span className="mt-1.5 block h-1 w-4/5 rounded-full bg-line-strong" />
                  <span className="mt-1.5 block h-1 w-3/5 rounded-full bg-line-strong" />
                </span>
              ))}
            </div>
            <p className="text-[13.5px] font-medium text-ink">No findings yet</p>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">
              {LIBRARY.length} findings are already written, each with its remediation and a CVSS
              vector. Start from one.
            </p>
            <div className="mt-3.5 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onOpenLibrary}
                className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-ink-inverse transition-colors duration-(--dur-micro) hover:bg-accent-deep active:translate-y-px [&_svg]:size-3.5"
              >
                <BookOpen />
                Browse the library
              </button>
              <button
                type="button"
                onClick={onNewFinding}
                className="flex h-8 items-center justify-center rounded-lg border border-line-strong px-2.5 text-[13px] text-ink-muted transition-colors duration-(--dur-micro) hover:border-line-hover hover:bg-hover hover:text-ink"
              >
                Start blank
              </button>
            </div>
          </div>
        ) : null}
        <ul className="space-y-0.5">
          {ordered.map((f) => {
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
                    "relative flex gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-(--dur-micro)",
                    active ? "bg-surface-3" : "hover:bg-hover",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "line-clamp-2 text-[13px] leading-snug",
                        f.title ? "text-ink" : "text-ink-muted",
                      )}
                    >
                      {f.title || "Untitled finding"}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[12px] tabular-nums text-ink-faint">
                      <span className="font-mono text-[11.5px]">{refs.get(f.id)}</span>
                      <span className={cx("font-medium", SEVERITY_CLASS[r.severity].text)}>
                        {r.severity}
                        {r.cvss ? ` ${formatScore(r.cvss.score)}` : ""}
                      </span>
                      {f.status !== "Open" ? <span className="truncate">{f.status}</span> : null}
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

      <nav aria-label="Report" className="border-t border-line px-2 pb-2 pt-3">
        <p className="px-2 pb-1 text-[12px] text-ink-faint">Report</p>
        {(
          [
            ["details", "Report details", <FileText key="i" />],
            ["report", "Export PDF", <FileDown key="i" />],
          ] as const
        ).map(([to, label, icon]) => (
          <a
            key={to}
            href={href({ name: "project", projectId: project.id, view: to })}
            aria-current={view === to ? "page" : undefined}
            className={cx(
              "flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13.5px] transition-colors duration-(--dur-micro) [&_svg]:size-4",
              view === to
                ? "bg-surface-3 text-ink"
                : "text-ink-muted hover:bg-hover hover:text-ink",
            )}
          >
            {icon}
            {label}
          </a>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-2.5">
        <div className="flex items-center justify-between">
          <span
            role="status"
            className={cx(
              "flex items-center gap-1.5 text-[12px] [&_svg]:size-3.5",
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
