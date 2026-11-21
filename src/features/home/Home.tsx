import { Download, FileUp, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ORG_URL } from "../../brand";
import * as db from "../../data/db";
import { download, exportProject, importProject, safeFilename } from "../../data/transfer";
import { createProject } from "../../domain/factories";
import type { Finding, Project } from "../../domain/types";
import { href, navigate } from "../../state/router";
import { useConfirm } from "../../ui/Confirm";
import { Button, Dialog, Field, IconButton, Menu, TextInput } from "../../ui/primitives";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
import { ThemeToggle } from "../../ui/ThemeToggle";
import { toast } from "../../ui/toast";
import { Wordmark } from "../../ui/Wordmark";
import { ReportPlate } from "./ReportPlate";

interface Row {
  project: Project;
  findings: Finding[];
}

function relative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function Home() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    const projects = await db.listProjects();
    setRows(
      await Promise.all(
        projects.map(async (project) => ({ project, findings: await db.listFindings(project.id) })),
      ),
    );
  }, []);

  useEffect(() => {
    document.title = "Debrief - pentest report writer";
    void load();
  }, [load]);

  const importFile = async (file: File) => {
    try {
      const project = await importProject(await file.text());
      toast(`Imported “${project.name}”`);
      navigate({ name: "project", projectId: project.id, view: "overview" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import failed", "error");
    }
  };

  const actions = (
    <>
      <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
        New project
      </Button>
      <Button icon={<FileUp />} onClick={() => fileInput.current?.click()}>
        Import project file
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }}
      />
    </>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a file drop target; "Import project file" is the accessible route to the same action
    <div
      className="flex h-full flex-col overflow-y-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) void importFile(file);
      }}
    >
      <header className="sticky top-0 z-10 border-b border-line bg-bar backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center px-6">
          <a
            href={href({ name: "home" })}
            aria-label="Debrief, all projects"
            className="rounded-md"
          >
            <Wordmark />
          </a>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        {rows === null ? null : rows.length === 0 ? (
          <Intro actions={actions} />
        ) : (
          <section className="mx-auto max-w-[1200px] px-6 pb-24 pt-12">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <div className="min-w-[16rem] flex-1">
                <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
                  Projects
                </h1>
                <p className="mt-1 text-[13.5px] text-ink-muted">
                  One project per engagement. Drop a project file anywhere on this page to import
                  it.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">{actions}</div>
            </div>
            <div className="-mx-3 mt-8">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[12.5px] text-ink-faint">
                    <th className="py-2.5 pl-3 pr-4 font-medium">Project</th>
                    <th className="w-[38%] py-2.5 pr-4 font-medium">Findings</th>
                    <th className="hidden w-[16%] py-2.5 pr-4 font-medium sm:table-cell">
                      Last edited
                    </th>
                    <th className="w-12 py-2.5 pr-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ project, findings }) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      findings={findings}
                      onExport={async () =>
                        download(
                          await exportProject(project),
                          `${safeFilename(project.name)}.debrief.json`,
                        )
                      }
                      onDelete={() =>
                        confirm({
                          title: "Delete this project?",
                          body: `“${project.name || "Untitled project"}”, its ${findings.length} findings and all screenshots will be removed from this browser.`,
                          action: "Delete project",
                          onConfirm: async () => {
                            await db.deleteProject(project.id);
                            await load();
                            toast("Project deleted");
                          },
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-6 py-5 text-[12.5px] text-ink-faint">
          <span>Your data is stored in this browser’s IndexedDB and never leaves this device.</span>
          <a href={ORG_URL} target="_blank" rel="noreferrer" className="rounded-sm hover:text-ink">
            Made by <span className="[font-feature-settings:'zero']">0xExploitLabs</span>
          </a>
        </div>
      </footer>

      <NewProjectDialog open={creating} onClose={() => setCreating(false)} />
      {dialog}
    </div>
  );
}

const FACTS: [string, string][] = [
  ["Evidence", "Screenshots and HTTP requests paste straight into the finding."],
  ["Severity", "Follows the CVSS score, so a 5.3 is always Medium."],
  ["Storage", "Everything stays in this browser: no account, no server."],
];

/** What a first visit shows: what Debrief is, and two real pages it rendered. */
function Intro({ actions }: { actions: ReactNode }) {
  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-x-16 gap-y-12 px-6 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:pt-16">
      <div>
        <h1 className="max-w-[14ch] text-[40px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[48px]">
          Pentest reports, written like notes
        </h1>
        <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed text-ink-muted">
          Write each finding in Markdown and download a typeset PDF your client can read.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">{actions}</div>
        <p className="mt-3 text-[13px] text-ink-faint">
          Or drop a project file anywhere on this page.
        </p>
        <dl className="mt-12 max-w-[520px] border-t border-line text-[14px]">
          {FACTS.map(([term, text]) => (
            <div
              key={term}
              className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-line py-3"
            >
              <dt className="text-ink-faint">{term}</dt>
              <dd className="text-ink">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ReportPlate />
    </section>
  );
}

function ProjectRow({
  project,
  findings,
  onExport,
  onDelete,
}: {
  project: Project;
  findings: Finding[];
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
      <td className="hidden py-4 pr-4 align-top text-[13px] tabular-nums text-ink-muted sm:table-cell">
        <time dateTime={project.updatedAt}>{relative(project.updatedAt)}</time>
      </td>
      <td className="relative z-[1] py-3 pr-2 text-right align-top">
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
      </td>
    </tr>
  );
}

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setClient("");
    }
  }, [open]);
  const create = async () => {
    const project = { ...createProject(name.trim() || "Untitled project"), client: client.trim() };
    await db.putProject(project);
    onClose();
    navigate({ name: "project", projectId: project.id, view: "overview" });
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={460}
      title="New project"
      description="One project per engagement. Everything else can be filled in later."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create}>
            Create project
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Field label="Project name">
          {(id) => (
            <TextInput
              id={id}
              data-autofocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="External web application test"
            />
          )}
        </Field>
        <Field label="Client">
          {(id) => (
            <TextInput
              id={id}
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Northwind Traders"
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
