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
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  X,
} from "lucide-react";
import { memo, type ReactNode, useMemo, useState } from "react";
import { LIBRARY } from "../../data/library";
import { formatScore } from "../../domain/cvss";
import { compareFindings, rate } from "../../domain/severity";
import type { Finding } from "../../domain/types";
import { href, type Route } from "../../state/router";
import { MOD_KEY } from "../../ui/platform";
import { Button, cx, IconButton, Kbd, Menu, SEVERITY_CLASS } from "../../ui/primitives";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
import { ThemeToggle } from "../../ui/ThemeToggle";
import { Cicada } from "../../ui/Wordmark";

export type SortMode = "severity" | "manual";

interface Props {
  projectId: string;
  projectName: string;
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
  /** On a wide screen it folds down to a rail of icons. */
  collapsed: boolean;
  onToggle: () => void;
}

const ADD_ITEMS = [
  {
    value: "library" as const,
    label: "From library",
    icon: <BookOpen />,
    hint: "Pre-written, with a CVSS vector",
  },
  {
    value: "blank" as const,
    label: "Blank finding",
    icon: <FilePlus2 />,
    hint: "Start from scratch",
  },
];

/**
 * The project's panel: its findings, and under them the report's two sides.
 * It floats on the page like the overview's bar, folds to a rail of icons on a
 * wide screen, and is a drawer on a narrow one. It re-renders only when what
 * it lists changes, never while a write-up is being typed.
 */
export const Sidebar = memo(function Sidebar(props: Props) {
  const { open, collapsed } = props;
  return (
    <aside
      id="project-nav"
      data-collapsed={collapsed || undefined}
      className={cx(
        "flex shrink-0 flex-col bg-surface-1 transition-[width] duration-(--dur-medium) ease-(--ease-glide)",
        // Wide: a floating panel. Narrow: a drawer, always at its full width.
        "md:my-2 md:ml-2 md:rounded-2xl md:shadow-page",
        collapsed ? "md:w-[60px]" : "md:w-[288px]",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(320px,calc(100vw-3rem))] max-md:shadow-pop max-md:transition-[translate,visibility] max-md:duration-(--dur-medium) max-md:ease-(--ease-glide)",
        !open && "max-md:invisible max-md:-translate-x-full",
      )}
    >
      {collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col max-md:hidden">
          <Rail {...props} />
        </div>
      ) : null}
      <div className={cx("flex min-h-0 flex-1 flex-col", collapsed && "md:hidden")}>
        <Panel {...props} />
      </div>
    </aside>
  );
});

function Panel({
  projectId,
  projectName,
  findings,
  refs,
  route,
  onNewFinding,
  onOpenLibrary,
  onReorder,
  onOpenSwitcher,
  saveState,
  onClose,
  onToggle,
}: Props) {
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
    <>
      <div className="flex h-[52px] shrink-0 items-center gap-1 pl-2.5 pr-2">
        <a
          href={href({ name: "projects" })}
          className="group/back flex h-8 items-center gap-1 rounded-full pl-1.5 pr-3 text-[13px] text-ink-muted transition-colors duration-(--dur-short) hover:bg-hover hover:text-ink"
        >
          <ChevronLeft className="size-4 transition-transform duration-(--dur-short) ease-(--ease-out) group-hover/back:-translate-x-0.5" />
          Projects
        </a>
        <div className="flex-1" />
        <IconButton
          label="Collapse sidebar"
          onClick={onToggle}
          aria-expanded="true"
          aria-controls="project-nav"
          className="max-md:hidden"
        >
          <PanelLeftClose />
        </IconButton>
        <IconButton label="Close project menu" onClick={onClose} className="md:hidden">
          <X />
        </IconButton>
      </div>

      <a
        href={href({ name: "project", projectId, view: "overview" })}
        aria-current={view === "overview" ? "page" : undefined}
        title="Project overview"
        className={cx(
          "mx-2 block rounded-xl px-2.5 pb-2 pt-1.5 font-display text-[25px] italic leading-[1.08] tracking-[-0.01em] transition-colors duration-(--dur-short)",
          view === "overview" ? "bg-surface-2" : "hover:bg-hover",
        )}
      >
        <span className="line-clamp-2">{projectName || "Untitled project"}</span>
      </a>

      <div className="px-3 pt-2.5">
        <button
          type="button"
          onClick={onOpenSwitcher}
          className="flex h-9 w-full items-center gap-2 rounded-full bg-surface-2 pl-3.5 pr-2 text-[13px] text-ink-faint transition-[background-color,color] duration-(--dur-short) hover:bg-surface-3 hover:text-ink-muted"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          <Kbd>{MOD_KEY} K</Kbd>
        </button>
      </div>

      <div className="mt-4 flex items-center gap-1.5 pl-4 pr-2.5">
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
          items={ADD_ITEMS}
          onSelect={(v) => (v === "blank" ? onNewFinding() : onOpenLibrary())}
          trigger={({ toggle, ref, open }) => (
            <IconButton
              ref={ref}
              label="Add finding"
              onClick={toggle}
              aria-expanded={open}
              className="size-7 text-accent enabled:hover:text-accent"
            >
              <Plus />
            </IconButton>
          )}
        />
      </div>

      {findings.length > 0 ? (
        <SeverityMix counts={counts} cells={18} labels={false} className="px-4 pt-1.5" />
      ) : null}

      <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {findings.length === 0 ? (
          <div className="mx-1 mt-1 rounded-2xl bg-surface-2 p-4">
            <div aria-hidden="true" className="relative mb-4 ml-1 h-[58px] w-[112px]">
              {(["Critical", "High", "Medium"] as const).map((severity, i) => (
                <span
                  key={severity}
                  className="absolute top-0 block h-[58px] w-[76px] rounded-md border border-line-strong bg-surface-1 p-2 shadow-[0_6px_14px_-8px_rgb(var(--brand-shadow)/0.5)]"
                  style={{ left: i * 18, rotate: `${(i - 1) * 5}deg` }}
                >
                  <span
                    className={cx("block size-2 rounded-[2px]", SEVERITY_CLASS[severity].dot)}
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
              <Button size="sm" variant="primary" icon={<BookOpen />} onClick={onOpenLibrary}>
                Browse the library
              </Button>
              <Button size="sm" onClick={onNewFinding}>
                Start blank
              </Button>
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
                  href={href({ name: "finding", projectId, findingId: f.id })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-(--dur-short)",
                    active ? "bg-surface-2" : "hover:bg-hover",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "mt-[5px] size-2 shrink-0 rounded-[2px] transition-transform duration-(--dur-short) ease-(--ease-out) group-hover/item:scale-125",
                      SEVERITY_CLASS[r.severity].dot,
                      active && "scale-125",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "line-clamp-2 text-[13px] leading-snug",
                        f.title ? "text-ink" : "text-ink-muted",
                        active && "font-medium",
                      )}
                    >
                      {f.title || "Untitled finding"}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[12px] tabular-nums text-ink-faint">
                      <span className="font-mono text-[11.5px]">{refs.get(f.id)}</span>
                      <span className={SEVERITY_CLASS[r.severity].text}>
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

      <nav aria-label="Report" className="mx-2 rounded-xl bg-surface-2 p-1.5">
        <p className="px-2 pb-1 pt-1 text-[12px] text-ink-faint">Report</p>
        {REPORT_LINKS.map(([to, label, icon]) => (
          <a
            key={to}
            href={href({ name: "project", projectId, view: to })}
            aria-current={view === to ? "page" : undefined}
            className={cx(
              "flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13.5px] transition-colors duration-(--dur-short) [&_svg]:size-4",
              view === to
                ? "bg-surface-1 text-ink shadow-sm"
                : "text-ink-muted hover:bg-hover hover:text-ink",
            )}
          >
            {icon}
            {label}
          </a>
        ))}
      </nav>

      <div className="flex h-12 shrink-0 items-center gap-2 pl-4 pr-2.5">
        <Cicada className="h-[10px] shrink-0 text-ink-faint" />
        <SaveState state={saveState} />
        <div className="flex-1" />
        <ThemeToggle />
      </div>
    </>
  );
}

const REPORT_LINKS = [
  ["details", "Report details", <FileText key="i" />],
  ["report", "Export PDF", <FileDown key="i" />],
] as const;

function SaveState({ state }: { state: Props["saveState"] }) {
  return (
    <span
      role="status"
      className={cx(
        "flex min-w-0 items-center gap-1.5 text-[12px] [&_svg]:size-3.5 [&_svg]:shrink-0",
        state === "error" ? "text-danger" : "text-ink-faint",
      )}
    >
      {state === "saving" ? (
        <LoaderCircle className="animate-spin" />
      ) : state === "error" ? (
        <CircleAlert />
      ) : (
        <Check />
      )}
      <span className="truncate">
        {state === "error" ? "Not saved, check storage" : "Saved in this browser"}
      </span>
    </span>
  );
}

/** The folded sidebar: the same places as icons, and each finding as its severity pixel. */
function Rail({
  projectId,
  projectName,
  findings,
  refs,
  route,
  onNewFinding,
  onOpenLibrary,
  onOpenSwitcher,
  saveState,
  onToggle,
}: Props) {
  const ordered = useMemo(() => [...findings].sort(compareFindings), [findings]);
  const activeFinding = route.name === "finding" ? route.findingId : null;
  const view = route.name === "project" ? route.view : null;
  const link = (to: "overview" | "details" | "report", label: string, icon: ReactNode) => (
    <a
      href={href({ name: "project", projectId, view: to })}
      aria-label={label}
      aria-current={view === to ? "page" : undefined}
      title={label}
      className={cx(
        "flex size-9 items-center justify-center rounded-xl transition-colors duration-(--dur-short) [&_svg]:size-4",
        view === to ? "bg-surface-2 text-ink" : "text-ink-muted hover:bg-hover hover:text-ink",
      )}
    >
      {icon}
    </a>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-1 py-2.5">
      <IconButton
        label="Expand sidebar"
        onClick={onToggle}
        aria-expanded="false"
        aria-controls="project-nav"
        className="size-9"
      >
        <PanelLeftOpen />
      </IconButton>
      {link(
        "overview",
        `${projectName || "Untitled project"}, overview`,
        <span className="font-display text-[19px] italic leading-none">
          {(projectName.trim()[0] ?? "U").toUpperCase()}
        </span>,
      )}
      <IconButton label={`Search (${MOD_KEY} K)`} onClick={onOpenSwitcher} className="size-9">
        <Search />
      </IconButton>
      <Menu
        width={230}
        items={ADD_ITEMS}
        onSelect={(v) => (v === "blank" ? onNewFinding() : onOpenLibrary())}
        trigger={({ toggle, ref, open }) => (
          <IconButton
            ref={ref}
            label="Add finding"
            onClick={toggle}
            aria-expanded={open}
            className="size-9 text-accent enabled:hover:text-accent"
          >
            <Plus />
          </IconButton>
        )}
      />
      <ul className="my-1 flex min-h-0 w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto border-y border-line py-2 [scrollbar-width:none]">
        {ordered.map((f) => {
          const severity = rate(f).severity;
          const label = `${refs.get(f.id) ?? ""} ${f.title || "Untitled finding"}`;
          return (
            <li key={f.id}>
              <a
                href={href({ name: "finding", projectId, findingId: f.id })}
                aria-label={label}
                aria-current={activeFinding === f.id ? "page" : undefined}
                title={label}
                className={cx(
                  "group/dot flex size-8 items-center justify-center rounded-lg transition-colors duration-(--dur-short)",
                  activeFinding === f.id ? "bg-surface-2" : "hover:bg-hover",
                )}
              >
                <span
                  className={cx(
                    "size-2.5 rounded-[3px] transition-transform duration-(--dur-short) ease-(--ease-out) group-hover/dot:scale-125",
                    SEVERITY_CLASS[severity].dot,
                  )}
                />
              </a>
            </li>
          );
        })}
      </ul>
      {link("details", "Report details", <FileText />)}
      {link("report", "Export PDF", <FileDown />)}
      <span
        role="status"
        title={saveState === "error" ? "Not saved, check storage" : "Saved in this browser"}
        className={cx(
          "flex size-7 items-center justify-center [&_svg]:size-3.5",
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
      </span>
      <ThemeToggle />
    </div>
  );
}
