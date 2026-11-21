import { Download, FileText, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as db from "../../data/db";
import { download, exportProject, safeFilename } from "../../data/transfer";
import { href } from "../../state/router";
import { useConfirm } from "../../ui/Confirm";
import { SheetMark } from "../../ui/Plot";
import { IconButton, Menu } from "../../ui/primitives";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
import { toast } from "../../ui/toast";
import { type ProjectRow, relative, SiteShell, useProjectActions, useProjects } from "./shared";

/** Every project in this browser: open one to write, or go straight to its report. */
export function Projects() {
  const { rows, reload } = useProjects();
  const actions = useProjectActions();
  const { confirm, dialog } = useConfirm();
  const [query, setQuery] = useState("");

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

  return (
    <SiteShell current="projects" projectCount={rows?.length ?? null} onNewProject={actions.create}>
      <section className="mx-auto max-w-[1240px] animate-rise px-6 pb-24 pt-10">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="min-w-[16rem] flex-1">
            <h1 className="font-display text-[56px] italic leading-none tracking-[-0.02em]">
              Projects
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              One project per engagement. Open one to write, or go straight to its report.
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
            <div className="-mx-3 mt-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[12.5px] text-ink-faint">
                    <th className="py-2.5 pl-3 pr-4 font-medium">Project</th>
                    <th className="w-[32%] py-2.5 pr-4 font-medium">Findings</th>
                    <th className="hidden w-[14%] py-2.5 pr-4 font-medium md:table-cell">
                      Last edited
                    </th>
                    <th className="w-[1%] py-2.5 pr-2">
                      <span className="sr-only">Report and actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown?.map((row) => (
                    <Row
                      key={row.project.id}
                      row={row}
                      onDelete={() => remove(row)}
                      onExport={async () =>
                        download(
                          await exportProject(row.project),
                          `${safeFilename(row.project.name)}.debrief.json`,
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
              {shown?.length === 0 ? (
                <p className="px-3 py-10 text-[13.5px] text-ink-faint">
                  No project matches “{query.trim()}”.
                </p>
              ) : null}
            </div>
          </>
        )}
      </section>
      {actions.dialog}
      {dialog}
    </SiteShell>
  );
}

function Row({
  row: { project, findings },
  onExport,
  onDelete,
}: {
  row: ProjectRow;
  onExport: () => void;
  onDelete: () => void;
}) {
  const name = project.name || "Untitled project";
  return (
    <tr className="group relative border-b border-line transition-colors duration-(--dur-micro) hover:bg-hover">
      <td className="py-4 pl-3 pr-4 align-top">
        <a
          href={href({ name: "project", projectId: project.id, view: "overview" })}
          className="block rounded-sm text-[15px] font-semibold tracking-[-0.01em] text-ink after:absolute after:inset-0"
        >
          {name}
        </a>
        <span className="mt-0.5 block truncate text-[13px] text-ink-faint">
          {project.client || "No client"}
        </span>
      </td>
      <td className="py-4 pr-4 align-top">
        {findings.length === 0 ? (
          <span className="text-[13px] text-ink-faint">No findings yet</span>
        ) : (
          <SeverityMix counts={countSeverities(findings)} className="max-w-[280px] pt-1.5" />
        )}
      </td>
      <td className="hidden py-4 pr-4 align-top text-[13px] tabular-nums text-ink-muted md:table-cell">
        <time dateTime={project.updatedAt}>{relative(project.updatedAt)}</time>
      </td>
      <td className="relative z-[1] py-3 pr-2 align-top">
        <div className="flex items-center justify-end gap-1">
          <a
            href={href({ name: "project", projectId: project.id, view: "report" })}
            aria-label={`Report for ${name}`}
            className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-strong bg-surface-2 px-2.5 text-[13px] text-ink transition-colors duration-(--dur-micro) hover:border-line-hover hover:bg-surface-3 [&_svg]:size-4"
          >
            <FileText />
            Report
          </a>
          <Menu
            align="end"
            width={180}
            items={[
              { value: "export", label: "Export file", icon: <Download /> },
              { value: "delete", label: "Delete", icon: <Trash2 />, danger: true },
            ]}
            onSelect={(v) => (v === "export" ? onExport() : onDelete())}
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
      </td>
    </tr>
  );
}
