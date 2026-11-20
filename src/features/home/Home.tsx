import { Download, FileUp, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ORG_URL } from "../../brand";
import * as db from "../../data/db";
import { download, exportProject, importProject, safeFilename } from "../../data/transfer";
import { createProject } from "../../domain/factories";
import { rate } from "../../domain/severity";
import { type Finding, type Project, SEVERITIES } from "../../domain/types";
import { href, navigate } from "../../state/router";
import { useConfirm } from "../../ui/Confirm";
import {
  Button,
  cx,
  Dialog,
  Field,
  IconButton,
  Menu,
  SEVERITY_CLASS,
  TextInput,
} from "../../ui/primitives";
import { ThemeToggle } from "../../ui/ThemeToggle";
import { toast } from "../../ui/toast";
import { Wordmark } from "../../ui/Wordmark";
import { ReportSketch } from "./ReportSketch";

interface Card {
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
  const [cards, setCards] = useState<Card[] | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    const projects = await db.listProjects();
    setCards(
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
      toast(`Imported "${project.name}"`);
      navigate({ name: "project", projectId: project.id, view: "overview" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import failed", "error");
    }
  };

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
      <header className="sticky top-0 z-10 border-b border-line bg-[rgb(var(--brand-bg)/0.86)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center px-6">
          <Wordmark />
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <div className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--brand-glow)/0.13),transparent)]"
        />
        <div className="relative mx-auto max-w-[1120px] px-6 pb-24 pt-16">
          <div className="flex items-center justify-between gap-10">
            <div className="max-w-[600px]">
              <h1 className="text-balance text-[40px] font-semibold leading-[1.08] tracking-[-0.03em]">
                Pentest reports, written like notes<span className="text-accent">.</span>
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                Write each finding in Markdown, paste in screenshots and requests, and download a
                typeset PDF your client can read. Severity follows the CVSS score. Everything stays
                in this browser: no account, no server.
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
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
              </div>
            </div>
            <ReportSketch />
          </div>

          <div className="mt-16 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
              Projects
            </h2>
            {cards && cards.length > 0 ? (
              <span className="font-mono text-[12px] text-ink-faint">{cards.length}</span>
            ) : null}
          </div>

          {cards === null ? null : cards.length === 0 ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center transition-colors hover:border-[rgb(var(--brand-accent)/0.5)] hover:bg-hover"
            >
              <span className="text-[15px] font-medium">Create your first project</span>
              <span className="mt-1.5 text-[13px] text-ink-faint">
                One project per engagement. You can also drop a project file anywhere on this page.
              </span>
            </button>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map(({ project, findings }) => (
                <ProjectCard
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
                      body: `"${project.name || "Untitled project"}", its ${findings.length} findings and all screenshots will be removed from this browser.`,
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
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-2 px-6 py-5 text-[12px] text-ink-faint">
          <span>Your data is stored in this browser's IndexedDB and never leaves this device.</span>
          <a href={ORG_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
            Made by <span className="[font-feature-settings:'zero']">0xExploitLabs</span>
          </a>
        </div>
      </footer>

      <NewProjectDialog open={creating} onClose={() => setCreating(false)} />
      {dialog}
    </div>
  );
}

function ProjectCard({
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
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
    (typeof SEVERITIES)[number],
    number
  >;
  for (const f of findings) counts[rate(f).severity]++;
  return (
    <div className="group relative flex flex-col rounded-2xl border border-line bg-surface-1 p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop">
      <a
        href={href({ name: "project", projectId: project.id, view: "overview" })}
        className="absolute inset-0 rounded-2xl"
      >
        <span className="sr-only">Open {project.name || "Untitled project"}</span>
      </a>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em]">
            {project.name || "Untitled project"}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-ink-faint">
            {project.client || "No client"}
          </p>
        </div>
        <div className="relative z-[1] -mr-2 -mt-1">
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
                label="Project actions"
                aria-expanded={open}
                onClick={toggle}
                className="opacity-60 group-hover:opacity-100"
              >
                <MoreHorizontal />
              </IconButton>
            )}
          />
        </div>
      </div>
      <div className="mt-6 flex h-1.5 overflow-hidden rounded-full bg-surface-3">
        {SEVERITIES.filter((s) => counts[s] > 0).map((s) => (
          <div
            key={s}
            className={cx(
              "h-full border-r border-surface-1 last:border-r-0",
              SEVERITY_CLASS[s].dot,
            )}
            style={{ flex: counts[s] }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px] text-ink-faint">
        <span>
          {findings.length} finding{findings.length === 1 ? "" : "s"}
          {counts.Critical + counts.High > 0 ? (
            <span className="text-sev-high">
              {" "}
              · {counts.Critical + counts.High} high or critical
            </span>
          ) : null}
        </span>
        <span>{relative(project.updatedAt)}</span>
      </div>
    </div>
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
              placeholder="Acme Corp"
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
