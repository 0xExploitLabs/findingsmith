import { LoaderCircle, PanelLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_NAME } from "../../brand";
import * as db from "../../data/db";
import { type LibraryEntry, libraryBody } from "../../data/library";
import { compareFindings } from "../../domain/severity";
import type { Finding } from "../../domain/types";
import { href, navigate, type Route } from "../../state/router";
import { useWorkspace } from "../../state/useWorkspace";
import { useConfirm } from "../../ui/Confirm";
import { IconButton } from "../../ui/primitives";
import { ThemeToggle } from "../../ui/ThemeToggle";
import { toast } from "../../ui/toast";
import { useEvent } from "../../ui/useEvent";
import { FindingEditor } from "../finding/FindingEditor";
import { LibraryDialog, type LibraryStart } from "../library/LibraryDialog";
import { ReportView } from "../report/ReportView";
import { ProjectHome } from "./ProjectHome";
import { ProjectPage } from "./ProjectPage";
import { QuickSwitcher, SWITCHER_ICONS } from "./QuickSwitcher";
import { Sidebar } from "./Sidebar";

const SIDEBAR_KEY = "debrief-sidebar";

export function Workspace({ route }: { route: Extract<Route, { projectId: string }> }) {
  const ws = useWorkspace(route.projectId);
  // The library, when open: on everything, in one category or at one entry.
  const [library, setLibrary] = useState<LibraryStart | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { project, findings } = ws;

  // What the lists show of a finding. Typing a write-up changes none of it, so
  // the same array is handed on and the sidebar is left alone.
  const listedRef = useRef<Finding[]>([]);
  const listed = useMemo(() => {
    const before = listedRef.current;
    const same =
      before.length === findings.length &&
      findings.every((f, i) => {
        const b = before[i];
        return (
          b !== undefined &&
          b.id === f.id &&
          b.title === f.title &&
          b.cvss === f.cvss &&
          b.manualSeverity === f.manualSeverity &&
          b.override === f.override &&
          b.status === f.status &&
          b.order === f.order
        );
      });
    if (!same) listedRef.current = findings;
    return listedRef.current;
  }, [findings]);

  const idPrefix = project?.idPrefix || "F";
  /** Reference numbers follow severity order, exactly as in the report. */
  const refs = useMemo(
    () =>
      new Map(
        [...listed]
          .sort(compareFindings)
          .map((f, i) => [f.id, `${idPrefix}-${String(i + 1).padStart(2, "0")}`]),
      ),
    [listed, idPrefix],
  );

  // On a wide screen the sidebar folds to a rail; the choice is kept.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleSidebar = useCallback(() => {
    setCollapsed((was) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, was ? "0" : "1");
      } catch {
        // Storage blocked: the choice still holds for this visit.
      }
      return !was;
    });
  }, []);

  const finding =
    route.name === "finding" ? findings.find((f) => f.id === route.findingId) : undefined;

  useEffect(() => {
    if (ws.status === "ready" && route.name === "finding" && !finding) {
      navigate({ name: "project", projectId: route.projectId, view: "overview" }, true);
    }
  }, [ws.status, route, finding]);

  // Going anywhere puts the drawer away.
  const here = href(route);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the address changes
  useEffect(() => setNavOpen(false), [here]);

  useEffect(() => {
    document.title = project ? `${project.name || "Untitled project"} - ${APP_NAME}` : APP_NAME;
  }, [project]);

  const open = (f: Finding) =>
    navigate({ name: "finding", projectId: route.projectId, findingId: f.id });

  const addBlank = useEvent(async () => open(await ws.addFinding()));
  const openLibrary = useCallback(() => setLibrary({}), []);
  const openSwitcher = useCallback(() => setSwitcherOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const addFromLibrary = async (entry: LibraryEntry) => {
    setLibrary(null);
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
      if (e.key === "Escape" && navOpen && !e.defaultPrevented) setNavOpen(false);
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitcherOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void addBlank();
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLibrary({});
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
    <div className="flex h-full bg-bg">
      <Sidebar
        projectId={project.id}
        projectName={project.name}
        findings={listed}
        refs={refs}
        route={route}
        onNewFinding={addBlank}
        onOpenLibrary={openLibrary}
        onReorder={ws.reorder}
        onOpenSwitcher={openSwitcher}
        saveState={ws.saveState}
        open={navOpen}
        onClose={closeNav}
        collapsed={collapsed}
        onToggle={toggleSidebar}
      />
      {navOpen ? (
        <button
          type="button"
          aria-label="Close project menu"
          tabIndex={-1}
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 cursor-default animate-fade bg-scrim backdrop-blur-[3px] md:hidden"
        />
      ) : null}
      <main className="page-glow relative flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-surface-1 pl-1.5 pr-2 md:hidden">
          <IconButton
            label="Open project menu"
            aria-expanded={navOpen}
            aria-controls="project-nav"
            onClick={() => setNavOpen(true)}
            className="size-9"
          >
            <PanelLeft />
          </IconButton>
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
            {finding ? (
              <>
                <span className="mr-2 font-mono text-[12px] font-normal text-ink-faint">
                  {refs.get(finding.id)}
                </span>
                {finding.title || "Untitled finding"}
              </>
            ) : (
              project.name || "Untitled project"
            )}
          </p>
          <ThemeToggle />
        </div>
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
            key={route.name === "finding" ? route.findingId : route.view}
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
              ) : route.name === "project" && route.view === "details" ? (
                <ProjectPage project={project} onChange={ws.updateProject} />
              ) : (
                <ProjectHome
                  project={project}
                  findings={findings}
                  refs={refs}
                  onChange={ws.updateProject}
                  onNewFinding={addBlank}
                  onOpenLibrary={(start) => setLibrary(start ?? {})}
                  onDelete={() =>
                    confirm({
                      title: "Delete this project?",
                      body: `“${project.name || "Untitled project"}”, its ${findings.length} findings and all screenshots will be removed from this browser. Export it first if you may need it again.`,
                      action: "Delete project",
                      onConfirm: async () => {
                        await db.deleteProject(project.id);
                        navigate({ name: "projects" }, true);
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
      {switcherOpen ? (
        <QuickSwitcher
          open
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
              run: () => setLibrary({}),
            },
            {
              id: "overview",
              label: "Project overview",
              icon: SWITCHER_ICONS.project,
              run: () => navigate({ name: "project", projectId: project.id, view: "overview" }),
            },
            {
              id: "details",
              label: "Report details: summary, scope and dates",
              icon: SWITCHER_ICONS.details,
              run: () => navigate({ name: "project", projectId: project.id, view: "details" }),
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
              run: () => navigate({ name: "projects" }),
            },
          ]}
        />
      ) : null}
      {library !== null ? (
        <LibraryDialog
          open
          start={library}
          onClose={() => setLibrary(null)}
          onUse={addFromLibrary}
        />
      ) : null}
      {dialog}
    </div>
  );
}
