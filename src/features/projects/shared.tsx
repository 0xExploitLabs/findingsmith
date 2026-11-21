import { FileUp, Plus } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ORG_URL } from "../../brand";
import * as db from "../../data/db";
import { importProject } from "../../data/transfer";
import { createProject } from "../../domain/factories";
import type { Finding, Project } from "../../domain/types";
import { href, navigate, type Route } from "../../state/router";
import { Button, cx, Dialog, Field, TextInput } from "../../ui/primitives";
import { ThemeToggle } from "../../ui/ThemeToggle";
import { toast } from "../../ui/toast";
import { Wordmark } from "../../ui/Wordmark";

export interface ProjectRow {
  project: Project;
  findings: Finding[];
}

/** Every project with its findings, newest first; null while loading. */
export function useProjects() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const reload = useCallback(async () => {
    const projects = await db.listProjects();
    setRows(
      await Promise.all(
        projects.map(async (project) => ({ project, findings: await db.listFindings(project.id) })),
      ),
    );
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, reload };
}

export function relative(iso: string): string {
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

async function importFile(file: File) {
  try {
    const project = await importProject(await file.text());
    toast(`Imported “${project.name}”`);
    navigate({ name: "project", projectId: project.id, view: "overview" });
  } catch (err) {
    toast(err instanceof Error ? err.message : "Import failed", "error");
  }
}

/** The two ways to start a project, and the dialog the first one opens. */
export function useProjectActions() {
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  return {
    create: () => setCreating(true),
    newButton: (
      <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
        New project
      </Button>
    ),
    importButton: (
      <>
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
    ),
    dialog: <NewProjectDialog open={creating} onClose={() => setCreating(false)} />,
  };
}

/**
 * The frame both top-level pages share: the bar with its two destinations, the
 * footer, and a page-wide drop target for project files.
 */
export function SiteShell({
  current,
  projectCount,
  children,
}: {
  current: Extract<Route, { name: "home" | "projects" }>["name"];
  projectCount: number | null;
  children: ReactNode;
}) {
  const link = (name: "home" | "projects", label: ReactNode) => (
    <a
      href={href({ name })}
      aria-current={current === name ? "page" : undefined}
      className={cx(
        "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] transition-colors duration-(--dur-micro)",
        current === name ? "bg-surface-3 text-ink" : "text-ink-muted hover:bg-hover hover:text-ink",
      )}
    >
      {label}
    </a>
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
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-1 px-6">
          <a
            href={href({ name: "home" })}
            aria-label="Debrief, home"
            className="mr-2 rounded-md sm:mr-4"
          >
            <Wordmark className="max-sm:hidden" />
            <Wordmark compact className="sm:hidden" />
          </a>
          <nav aria-label="Main" className="flex items-center gap-1">
            {link("home", "Overview")}
            {link(
              "projects",
              <>
                Projects
                {projectCount ? (
                  <span className="text-[12.5px] tabular-nums text-ink-faint">{projectCount}</span>
                ) : null}
              </>,
            )}
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-2 px-6 py-5 text-[12.5px] text-ink-faint">
          <span>Your data is stored in this browser’s IndexedDB and never leaves this device.</span>
          <a href={ORG_URL} target="_blank" rel="noreferrer" className="rounded-sm hover:text-ink">
            Made by <span className="[font-feature-settings:'zero']">0xExploitLabs</span>
          </a>
        </div>
      </footer>
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
              placeholder="Northwind Traders"
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
