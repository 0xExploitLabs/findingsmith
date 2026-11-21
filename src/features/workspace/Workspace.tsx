import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as db from "../../data/db";
import { type LibraryEntry, libraryBody } from "../../data/library";
import { compareFindings } from "../../domain/severity";
import type { Finding } from "../../domain/types";
import { navigate, type Route } from "../../state/router";
import { useWorkspace } from "../../state/useWorkspace";
import { useConfirm } from "../../ui/Confirm";
import { toast } from "../../ui/toast";
import { FindingEditor } from "../finding/FindingEditor";
import { LibraryDialog } from "../library/LibraryDialog";
import { ReportView } from "../report/ReportView";
import { ProjectPage } from "./ProjectPage";
import { QuickSwitcher, SWITCHER_ICONS } from "./QuickSwitcher";
import { Sidebar } from "./Sidebar";

export function Workspace({ route }: { route: Extract<Route, { projectId: string }> }) {
  const ws = useWorkspace(route.projectId);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { project, findings } = ws;

  /** Reference numbers follow severity order, exactly as in the report. */
  const refs = useMemo(() => {
    const prefix = project?.idPrefix || "F";
    return new Map(
      [...findings]
        .sort(compareFindings)
        .map((f, i) => [f.id, `${prefix}-${String(i + 1).padStart(2, "0")}`]),
    );
  }, [findings, project?.idPrefix]);

  const finding =
    route.name === "finding" ? findings.find((f) => f.id === route.findingId) : undefined;

  useEffect(() => {
    if (ws.status === "ready" && route.name === "finding" && !finding) {
      navigate({ name: "project", projectId: route.projectId, view: "overview" }, true);
    }
  }, [ws.status, route, finding]);

  useEffect(() => {
    document.title = project ? `${project.name || "Untitled project"} - Debrief` : "Debrief";
  }, [project]);

  const open = (f: Finding) =>
    navigate({ name: "finding", projectId: route.projectId, findingId: f.id });

  const addBlank = async () => open(await ws.addFinding());
  const addFromLibrary = async (entry: LibraryEntry) => {
    setLibraryOpen(false);
    const f = await ws.addFinding({
      title: entry.title,
      cvss: entry.vector,
      cwe: entry.cwe,
      body: libraryBody(entry),
    });
    open(f);
    toast(`Added “${entry.title}”`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setSwitcherOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void addBlank();
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLibraryOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (ws.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-accent" />
      </div>
    );
  }
  if (ws.status === "missing" || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-[15px] font-medium">This project does not exist in this browser.</p>
        <a href="#/" className="text-[13.5px] text-accent hover:underline">
          Back to projects
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar
        project={project}
        findings={findings}
        refs={refs}
        route={route}
        onNewFinding={addBlank}
        onOpenLibrary={() => setLibraryOpen(true)}
        onReorder={ws.reorder}
        onOpenSwitcher={() => setSwitcherOpen(true)}
        saveState={ws.saveState}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {route.name === "project" && route.view === "report" ? (
          <ReportView
            project={project}
            findings={findings}
            refs={refs}
            onChange={ws.updateProject}
          />
        ) : (
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            key={route.name === "finding" ? route.findingId : "overview"}
          >
            <div className="min-h-full animate-rise">
              {finding ? (
                <FindingEditor
                  finding={finding}
                  reference={refs.get(finding.id) ?? ""}
                  onChange={(patch) => ws.updateFinding(finding.id, patch)}
                  onDuplicate={async () => {
                    const { id: _id, createdAt: _c, updatedAt: _u, order: _o, ...rest } = finding;
                    const copy = await ws.addFinding({
                      ...rest,
                      title: `${finding.title} (copy)`.trim(),
                    });
                    open(copy);
                    toast("Finding duplicated");
                  }}
                  onDelete={() =>
                    confirm({
                      title: "Delete this finding?",
                      body: `“${finding.title || "Untitled finding"}” will be removed from the project. This cannot be undone.`,
                      action: "Delete finding",
                      onConfirm: async () => {
                        await ws.removeFinding(finding.id);
                        navigate(
                          { name: "project", projectId: project.id, view: "overview" },
                          true,
                        );
                        toast("Finding deleted");
                      },
                    })
                  }
                />
              ) : (
                <ProjectPage
                  project={project}
                  findings={findings}
                  onChange={ws.updateProject}
                  onDelete={() =>
                    confirm({
                      title: "Delete this project?",
                      body: `“${project.name || "Untitled project"}”, its ${findings.length} findings and all screenshots will be removed from this browser. Export it first if you may need it again.`,
                      action: "Delete project",
                      onConfirm: async () => {
                        await db.deleteProject(project.id);
                        navigate({ name: "home" }, true);
                        toast("Project deleted");
                      },
                    })
                  }
                />
              )}
            </div>
          </div>
        )}
      </main>
      <QuickSwitcher
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        findings={findings}
        refs={refs}
        onOpenFinding={open}
        actions={[
          {
            id: "new",
            label: "New blank finding",
            icon: SWITCHER_ICONS.newFinding,
            run: () => void addBlank(),
          },
          {
            id: "library",
            label: "Add a finding from the library",
            icon: SWITCHER_ICONS.library,
            run: () => setLibraryOpen(true),
          },
          {
            id: "project",
            label: "Project details and summary",
            icon: SWITCHER_ICONS.project,
            run: () => navigate({ name: "project", projectId: project.id, view: "overview" }),
          },
          {
            id: "export",
            label: "Export PDF",
            icon: SWITCHER_ICONS.export,
            run: () => navigate({ name: "project", projectId: project.id, view: "report" }),
          },
          {
            id: "projects",
            label: "All projects",
            icon: SWITCHER_ICONS.projects,
            run: () => navigate({ name: "home" }),
          },
        ]}
      />
      <LibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onUse={addFromLibrary}
      />
      {dialog}
    </div>
  );
}
