import {
  ArrowRight,
  BookOpen,
  CircleAlert,
  CircleCheck,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { LIBRARY, LIBRARY_CATEGORIES, type LibraryEntry } from "../../data/library";
import { download, exportProject, safeFilename } from "../../data/transfer";
import { findingGaps, listInWords } from "../../domain/completeness";
import { formatScore, scoreVector } from "../../domain/cvss";
import { compareFindings, rate } from "../../domain/severity";
import type { Finding, Project } from "../../domain/types";
import { href } from "../../state/router";
import { PixelCorner } from "../../ui/motion";
import { MOD_KEY } from "../../ui/platform";
import { Button, cx, IconButton, Kbd, Menu, SEVERITY_CLASS } from "../../ui/primitives";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
import { toast } from "../../ui/toast";
import { Title } from "../doc/DocParts";
import { STATUS_DOT } from "../finding/FindingEditor";
import type { LibraryStart } from "../library/LibraryDialog";
import { reportChecks } from "../report/checks";

/** The findings most engagements open with, offered by name on an empty project. */
const STARTERS = ["sqli", "xss-stored", "idor", "csrf", "no-lockout", "security-headers"]
  .map((id) => LIBRARY.find((e) => e.id === id))
  .filter((e): e is LibraryEntry => !!e);

/**
 * A project's home: its findings at a glance, or, before there are any, the
 * library that most of them can start from. The report's own text and the PDF
 * are one step away at the foot.
 */
export function ProjectHome({
  project,
  findings,
  refs,
  onChange,
  onDelete,
  onNewFinding,
  onOpenLibrary,
}: {
  project: Project;
  findings: Finding[];
  refs: Map<string, string>;
  onChange: (patch: Partial<Project>) => void;
  onDelete: () => void;
  onNewFinding: () => void;
  onOpenLibrary: (start?: LibraryStart) => void;
}) {
  const ordered = useMemo(() => [...findings].sort(compareFindings), [findings]);
  const checks = useMemo(() => reportChecks(project, findings, refs), [project, findings, refs]);
  const issues = checks.filter((c) => !c.ok).length;
  const summary = checks.find((c) => c.label.startsWith("Executive summary"))?.ok;

  return (
    <article className="mx-auto w-full max-w-[920px] px-6 pb-16 pt-10 sm:px-10">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Title
            value={project.name}
            onChange={(name) => onChange({ name })}
            placeholder="Untitled project"
          />
        </div>
        <Menu
          align="end"
          width={230}
          trigger={({ toggle, ref, open }) => (
            <IconButton
              ref={ref}
              label="Project actions"
              onClick={toggle}
              aria-expanded={open}
              className="mt-1"
            >
              <MoreHorizontal />
            </IconButton>
          )}
          items={[
            { value: "export", label: "Export project file", icon: <Download /> },
            { value: "delete", label: "Delete project", icon: <Trash2 />, danger: true },
          ]}
          onSelect={async (v) => {
            if (v === "delete") return onDelete();
            download(await exportProject(project), `${safeFilename(project.name)}.debrief.json`);
            toast("Project exported");
          }}
        />
      </div>

      {findings.length === 0 ? (
        <FirstFinding onNewFinding={onNewFinding} onOpenLibrary={onOpenLibrary} />
      ) : (
        <section aria-labelledby="findings-title" className="mt-6">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-[14rem] flex-1">
              <h2 id="findings-title" className="text-[13px] text-ink-faint">
                {findings.length} finding{findings.length === 1 ? "" : "s"}
              </h2>
              <SeverityMix counts={countSeverities(findings)} className="mt-2 max-w-[420px]" />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                icon={<BookOpen />}
                onClick={() => onOpenLibrary()}
              >
                Add from library
              </Button>
              <Button size="sm" icon={<FilePlus2 />} onClick={onNewFinding}>
                Blank finding
              </Button>
            </div>
          </div>
          <ul className="mt-5 overflow-hidden rounded-2xl bg-surface-1">
            {ordered.map((f) => {
              const r = rate(f);
              const gaps = findingGaps(f);
              return (
                <li key={f.id} className="border-b border-line last:border-b-0">
                  <a
                    href={href({ name: "finding", projectId: project.id, findingId: f.id })}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors sm:px-5 duration-(--dur-micro) hover:bg-hover"
                  >
                    <span className="w-11 shrink-0 font-mono text-[12px] text-ink-faint max-sm:hidden">
                      {refs.get(f.id)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cx(
                          "line-clamp-2 text-[14px] font-medium leading-snug sm:line-clamp-1",
                          !f.title && "text-ink-muted",
                        )}
                      >
                        {f.title || "Untitled finding"}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-faint">
                        {gaps.length > 0
                          ? `Needs ${listInWords(gaps)}`
                          : [f.method, f.endpoint || f.host, f.cwe].filter(Boolean).join(" ") ||
                            "Complete"}
                      </span>
                    </span>
                    {f.status !== "Open" ? (
                      <span className="flex shrink-0 items-center gap-2 text-[12.5px] text-ink-muted max-sm:hidden">
                        <span className={cx("size-2 rounded-full", STATUS_DOT[f.status])} />
                        {f.status}
                      </span>
                    ) : null}
                    <span className="flex w-[92px] shrink-0 items-center gap-2 text-[13px]">
                      <span className={cx("size-2 rounded-full", SEVERITY_CLASS[r.severity].dot)} />
                      {r.severity}
                      {r.cvss ? (
                        <span className="ml-auto font-mono text-[12px] text-ink-faint">
                          {formatScore(r.cvss.score)}
                        </span>
                      ) : null}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="report-title" className="mt-10">
        <h2 id="report-title" className="text-[13px] text-ink-faint">
          {findings.length === 0 ? "Then, the report" : "The report"}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ReportCard
            href={href({ name: "project", projectId: project.id, view: "details" })}
            icon={<FileText />}
            title="Report details"
            text="What the report says before the findings: its title, the dates, the executive summary, scope and methodology."
            ok={!!summary}
            status={summary ? "Executive summary written" : "Executive summary to write"}
          />
          <ReportCard
            href={href({ name: "project", projectId: project.id, view: "report" })}
            icon={<FileDown />}
            title="Export PDF"
            text="The typeset report, as it will be sent: preview it, set its colour and logo, and download it."
            ok={issues === 0}
            status={issues === 0 ? "Ready to send" : `${issues} to review`}
          />
        </div>
      </section>
    </article>
  );
}

function ReportCard({
  href: to,
  icon,
  title,
  text,
  ok,
  status,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  text: string;
  ok: boolean;
  status: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-surface-1 p-5 transition-[translate,box-shadow] duration-(--dur-medium) ease-(--ease-out) hover:-translate-y-0.5 hover:shadow-page">
      <PixelCorner />
      <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-ink-muted [&_svg]:size-[18px]">
        {icon}
      </span>
      <a
        href={to}
        className="mt-4 flex items-center gap-1.5 rounded-sm text-[15px] font-semibold tracking-[-0.01em] after:absolute after:inset-0 after:rounded-2xl [&_svg]:size-4 [&_svg]:text-ink-faint [&_svg]:transition-transform [&_svg]:duration-(--dur-short) [&_svg]:ease-(--ease-out) group-hover:[&_svg]:translate-x-0.5"
      >
        {title}
        <ArrowRight />
      </a>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{text}</p>
      <p
        className={cx(
          "mt-4 flex items-center gap-1.5 text-[12.5px] [&_svg]:size-3.5",
          ok ? "text-ok" : "text-warn",
        )}
      >
        {ok ? <CircleCheck /> : <CircleAlert />}
        {status}
      </p>
    </div>
  );
}

/**
 * The empty project. Most findings have been written before, so the library
 * leads: what an entry holds, six to start from by name, and every category.
 */
function FirstFinding({
  onNewFinding,
  onOpenLibrary,
}: {
  onNewFinding: () => void;
  onOpenLibrary: (start?: LibraryStart) => void;
}) {
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of LIBRARY) c.set(e.category, (c.get(e.category) ?? 0) + 1);
    return c;
  }, []);
  return (
    <section aria-labelledby="first-title" className="mt-7">
      <div className="group relative overflow-hidden rounded-2xl bg-surface-1 px-6 py-8 sm:px-9 sm:py-10">
        <PixelCorner />
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_248px]">
          <div>
            <p className="text-[13px] text-ink-faint">No findings yet</p>
            <h2
              id="first-title"
              className="mt-2 font-display text-[40px] italic leading-[1.02] tracking-[-0.02em] sm:text-[52px]"
            >
              Start from a finding that is already written
            </h2>
            <p className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-ink-muted">
              The library holds {LIBRARY.length} findings, each with its description, impact,
              remediation, references and a CVSS vector. Add one, then change what is different on
              this engagement.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Button variant="primary" icon={<BookOpen />} onClick={() => onOpenLibrary()}>
                Browse the library
              </Button>
              <Button icon={<FilePlus2 />} onClick={onNewFinding}>
                Start blank
              </Button>
              <span className="ml-1 flex items-center gap-1.5 text-[12px] text-ink-faint max-sm:hidden">
                <Kbd>{MOD_KEY} Alt L</Kbd> opens the library anywhere
              </span>
            </div>
          </div>
          <LibraryFan />
        </div>
      </div>

      <h3 className="mt-8 text-[13px] text-ink-faint">Where most reports begin</h3>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {STARTERS.map((entry) => {
          const score = scoreVector(entry.vector);
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onOpenLibrary({ entryId: entry.id })}
                className="group flex h-full w-full flex-col rounded-xl bg-surface-1 px-4 py-3.5 text-left transition-[translate,box-shadow] duration-(--dur-short) ease-(--ease-out) hover:-translate-y-0.5 hover:shadow-page"
              >
                <span className="text-[14px] font-medium leading-snug">{entry.title}</span>
                <span className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-faint">
                  {score ? (
                    <>
                      <span
                        className={cx("size-2 rounded-full", SEVERITY_CLASS[score.severity].dot)}
                      />
                      <span className="text-ink-muted">{score.severity}</span>
                      <span className="font-mono text-[12px]">{formatScore(score.score)}</span>
                    </>
                  ) : null}
                  <span className="ml-auto font-mono text-[12px]">{entry.cwe}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Library categories">
        {LIBRARY_CATEGORIES.filter((c) => counts.get(c)).map((category) => (
          <li key={category}>
            <button
              type="button"
              onClick={() => onOpenLibrary({ category })}
              className="flex h-7 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-[12.5px] text-ink-muted transition-colors duration-(--dur-micro) hover:border-line-hover hover:bg-hover hover:text-ink"
            >
              {category}
              <span className="tabular-nums text-ink-faint">{counts.get(category)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Three library entries as a fanned hand of cards: what "already written" looks like. */
function LibraryFan() {
  const cards = STARTERS.slice(0, 3);
  const pose = [
    "-rotate-[7deg] -translate-x-9 translate-y-2 group-hover:-rotate-[11deg] group-hover:-translate-x-14",
    "rotate-[1deg] -translate-y-1 group-hover:-translate-y-3",
    "rotate-[8deg] translate-x-9 translate-y-3 group-hover:rotate-[12deg] group-hover:translate-x-14",
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto h-[196px] w-[168px] max-md:hidden">
      {cards.map((entry, i) => {
        const score = scoreVector(entry.vector);
        return (
          <div
            key={entry.id}
            className={cx(
              "sheet absolute inset-0 rounded-[10px] bg-sheet p-3.5 shadow-page transition-transform duration-(--dur-medium) ease-(--ease-out)",
              pose[i],
            )}
            style={{ zIndex: i === 1 ? 2 : 1 }}
          >
            <span
              className={cx(
                "inline-flex h-[18px] items-center rounded px-1.5 font-report text-[9px] font-bold text-white",
                score && SEVERITY_CLASS[score.severity].dot,
              )}
            >
              {score?.severity} {score ? formatScore(score.score) : ""}
            </span>
            <p className="mt-2 font-report text-[12.5px] font-extrabold leading-[1.2] text-sheet-ink">
              {entry.title}
            </p>
            <p className="mt-1 font-mono text-[8.5px] text-sheet-muted">{entry.cwe}</p>
            {["Description", "Impact", "Remediation"].map((label, n) => (
              <div key={label} className="mt-2.5">
                <p className="font-report text-[7px] font-bold uppercase tracking-[0.8px] text-sheet-accent">
                  {label}
                </p>
                <span className="mt-1 block h-[3px] rounded-full bg-sheet-rule" />
                <span
                  className="mt-1 block h-[3px] rounded-full bg-sheet-rule"
                  style={{ width: `${[72, 54, 86][n]}%` }}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
