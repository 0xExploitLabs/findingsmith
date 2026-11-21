import {
  ArrowUpRight,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
  PencilLine,
  Search,
  Trash2,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import * as db from "../../data/db";
import { download, exportProject, importProject, safeFilename } from "../../data/transfer";
import { compareFindings, rate, SEVERITY_HEX } from "../../domain/severity";
import type { Project } from "../../domain/types";
import { isHexColor, onColor } from "../../pdf/palette";
import { href } from "../../state/router";
import { useConfirm } from "../../ui/Confirm";
import { PixelCorner } from "../../ui/motion";
import { SheetMark } from "../../ui/Plot";
import { Button, Dialog, Field, IconButton, Menu, TextInput } from "../../ui/primitives";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
import { toast } from "../../ui/toast";
import { type ProjectRow, relative, SiteShell, useProjectActions, useProjects } from "./shared";

/** Every project in this browser: open one to write, or go straight to its report. */
export function Projects() {
  const { rows, reload } = useProjects();
  const actions = useProjectActions();
  const { confirm, dialog } = useConfirm();
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<Project | null>(null);

  useEffect(() => {
    document.title = "Projects - Debrief";
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows || !q) return rows;
    return rows.filter(({ project }) =>
      `${project.name} ${project.client}`.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const remove = ({ project, findings }: ProjectRow) =>
    confirm({
      title: "Delete this project?",
      body: `“${project.name || "Untitled project"}”, its ${findings.length} findings and all screenshots will be removed from this browser.`,
      action: "Delete project",
      onConfirm: async () => {
        await db.deleteProject(project.id);
        await reload();
        toast("Project deleted");
      },
    });

  /** A copy with ids of its own, made the way a project file is imported. */
  const duplicate = async (project: Project) => {
    try {
      const copy = await importProject(await (await exportProject(project)).text());
      await db.putProject({ ...copy, name: `${project.name || "Untitled project"} (copy)` });
      await reload();
      toast("Project duplicated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not duplicate the project", "error");
    }
  };

  return (
    <SiteShell current="projects" projectCount={rows?.length ?? null} onNewProject={actions.create}>
      <section className="mx-auto max-w-[1240px] animate-rise px-6 pb-24 pt-8 sm:pt-12">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="min-w-[16rem] flex-1">
            <h1 className="font-display text-[56px] italic leading-none tracking-[-0.02em] sm:text-[72px]">
              Projects
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-muted">
              One project per report. Open one to write, or go straight to its PDF.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {actions.newButton}
            {actions.importButton}
          </div>
        </div>

        {rows === null ? null : rows.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl bg-surface-1 px-6 py-16 text-center">
            <SheetMark className="size-20" />
            <h2 className="mt-4 text-[16px] font-semibold">No projects yet</h2>
            <p className="mt-1 max-w-[44ch] text-[13.5px] text-ink-muted">
              A project holds one engagement: its scope, its findings and the report. Create one, or
              drop a project file anywhere on this page.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">{actions.newButton}</div>
          </div>
        ) : (
          <>
            {rows.length > 4 ? (
              <label className="mt-8 flex h-9 max-w-[320px] items-center gap-2 rounded-lg border border-line-strong bg-surface-1 px-3 text-ink-faint focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-accent">
                <Search className="size-4 shrink-0" />
                <span className="sr-only">Filter projects</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by name or client"
                  spellCheck={false}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
                />
              </label>
            ) : null}
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown?.map((row) => (
                <Card
                  key={row.project.id}
                  row={row}
                  onRename={() => setRenaming(row.project)}
                  onDuplicate={() => void duplicate(row.project)}
                  onDelete={() => remove(row)}
                  onExport={async () =>
                    download(
                      await exportProject(row.project),
                      `${safeFilename(row.project.name)}.debrief.json`,
                    )
                  }
                />
              ))}
            </ul>
            {shown?.length === 0 ? (
              <p className="py-10 text-[13.5px] text-ink-faint">
                No project matches “{query.trim()}”.
              </p>
            ) : null}
          </>
        )}
      </section>
      {actions.dialog}
      {dialog}
      <RenameDialog project={renaming} onClose={() => setRenaming(null)} onDone={reload} />
    </SiteShell>
  );
}

/** How many finding pages show behind a cover, however many findings there are. */
const STACK = 3;

/**
 * One project as the report it will become: its cover in miniature with a
 * page behind it for each of its gravest findings, then its name, what it
 * holds and the way to its PDF. The pages fan out under the pointer and shift
 * with it, the far ones most.
 */
function Card({
  row: { project, findings },
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}: {
  row: ProjectRow;
  onRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const name = project.name || "Untitled project";
  const accent = isHexColor(project.accent) ? project.accent : "#036877";
  const pages = useMemo(() => [...findings].sort(compareFindings).slice(0, STACK), [findings]);
  const prefix = project.idPrefix || "F";
  return (
    <li
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-surface-1 transition-[translate,box-shadow] duration-(--dur-medium) ease-(--ease-out) hover:-translate-y-1 hover:shadow-page"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches)
          return;
        const box = e.currentTarget.getBoundingClientRect();
        const style = e.currentTarget.style;
        style.setProperty("--mx", (((e.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
        style.setProperty("--my", (((e.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.removeProperty("--mx");
        e.currentTarget.style.removeProperty("--my");
      }}
    >
      <div
        aria-hidden="true"
        data-pages={pages.length}
        className="relative h-[164px] overflow-hidden bg-surface-2"
      >
        {[...pages].reverse().map((finding, i) => {
          const depth = pages.length - i;
          const severity = rate(finding).severity;
          return (
            <div
              key={finding.id}
              className="stack-page sheet absolute left-7 top-7 h-[240px] overflow-hidden bg-sheet shadow-page"
              style={{ "--k": depth, right: 28 + pages.length * 10 } as CSSProperties}
            >
              <span
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: SEVERITY_HEX[severity] }}
              />
              <p className="flex items-center justify-end gap-1.5 pr-2.5 pt-3 font-mono text-[7px] font-bold leading-none text-sheet-muted">
                {severity}
                <span style={{ color: SEVERITY_HEX[severity] }}>
                  {prefix}-{String(pages.indexOf(finding) + 1).padStart(2, "0")}
                </span>
              </p>
              <div className="ml-auto mt-3 w-2/5 space-y-[5px] pr-2.5">
                {[100, 82, 94, 60].map((width) => (
                  <span
                    key={width}
                    className="ml-auto block h-[3px] rounded-full bg-sheet-rule"
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <div
          className="stack-cover sheet absolute left-7 top-7 h-[240px] overflow-hidden bg-sheet shadow-page"
          style={{ right: 28 + pages.length * 10 }}
        >
          {/* The cover in miniature: a white head, then the block of colour with the title. */}
          <div className="flex h-[22px] items-center justify-between px-4">
            <span className="h-[3px] w-10 rounded-full bg-sheet-rule" />
            <span className="h-[7px] w-9 rounded-[2px] border" style={{ borderColor: accent }} />
          </div>
          <div className="h-full px-4 pt-7" style={{ background: accent, color: onColor(accent) }}>
            <p className="font-report text-[6.5px] font-bold uppercase leading-none tracking-[1.4px] opacity-80">
              Penetration test report
            </p>
            <p className="mt-2 line-clamp-2 font-report text-[15px] font-extrabold leading-[1.15]">
              {name}
            </p>
            {project.client ? (
              <p className="mt-1.5 truncate font-report text-[8.5px] opacity-85">
                {project.client}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <PixelCorner corner="br" />

      <div className="flex flex-1 flex-col p-5">
        <a
          href={href({ name: "project", projectId: project.id, view: "overview" })}
          className="flex items-center gap-1.5 rounded-sm text-[16px] font-semibold tracking-[-0.01em] text-ink after:absolute after:inset-0 after:rounded-2xl"
        >
          <span className="truncate">{name}</span>
          <ArrowUpRight className="size-4 shrink-0 -translate-x-1 text-ink-faint opacity-0 transition-[opacity,translate] duration-(--dur-short) ease-(--ease-out) group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100" />
        </a>
        <p className="mt-0.5 truncate text-[13px] text-ink-faint">
          {project.client ? `${project.client} · ` : ""}
          {findings.length === 0
            ? "No findings yet"
            : `${findings.length} finding${findings.length === 1 ? "" : "s"}`}
          {" · edited "}
          <time dateTime={project.updatedAt}>{relative(project.updatedAt)}</time>
        </p>
        <div className="mt-4 min-h-9 flex-1">
          {findings.length === 0 ? (
            <span className="text-[13px] text-ink-faint">
              Open it to add the first from the library.
            </span>
          ) : (
            <SeverityMix counts={countSeverities(findings)} />
          )}
        </div>
        <div className="relative z-[1] mt-4 flex items-center justify-between gap-2">
          <a
            href={href({ name: "project", projectId: project.id, view: "report" })}
            aria-label={`Report for ${name}`}
            className="btn btn-raised flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-line-strong bg-surface-1 px-2.5 text-[13px] text-ink hover:border-line-hover [&_svg]:size-4"
          >
            <FileText />
            Report
          </a>
          <Menu
            align="end"
            width={190}
            items={[
              { value: "rename", label: "Rename", icon: <PencilLine /> },
              { value: "duplicate", label: "Duplicate", icon: <Copy /> },
              { value: "export", label: "Export file", icon: <Download /> },
              { value: "delete", label: "Delete", icon: <Trash2 />, danger: true },
            ]}
            onSelect={(v) =>
              v === "rename"
                ? onRename()
                : v === "duplicate"
                  ? onDuplicate()
                  : v === "export"
                    ? onExport()
                    : onDelete()
            }
            trigger={({ toggle, ref, open }) => (
              <IconButton
                ref={ref}
                label={`Actions for ${name}`}
                aria-expanded={open}
                onClick={toggle}
              >
                <MoreHorizontal />
              </IconButton>
            )}
          />
        </div>
      </div>
    </li>
  );
}

function RenameDialog({
  project,
  onClose,
  onDone,
}: {
  project: Project | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (project) setName(project.name);
  }, [project]);
  const save = async () => {
    if (!project) return;
    await db.putProject({
      ...project,
      name: name.trim() || "Untitled project",
      updatedAt: new Date().toISOString(),
    });
    onClose();
    onDone();
  };
  return (
    <Dialog
      open={!!project}
      onClose={onClose}
      width={440}
      title="Rename project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Rename
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Project name">
          {(id) => (
            <TextInput
              id={id}
              data-autofocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
