import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "../data/db";
import { createFinding } from "../domain/factories";
import type { Finding, Project } from "../domain/types";
import { toast } from "../ui/toast";

export type SaveState = "saved" | "saving" | "error";

const SAVE_DELAY = 300;

/**
 * A project and its findings, held in React state and written through to
 * IndexedDB a moment after each change. Edits are batched per record, and a
 * pending write is flushed when the page is hidden or the project changes, so
 * closing the tab right after typing does not lose the last keystrokes.
 */
export function useWorkspace(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const dirtyProject = useRef<Project | null>(null);
  const dirtyFindings = useRef(new Map<string, Finding>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const p = dirtyProject.current;
    const fs = [...dirtyFindings.current.values()];
    dirtyProject.current = null;
    dirtyFindings.current.clear();
    if (!p && fs.length === 0) return;
    try {
      await Promise.all([p ? db.putProject(p) : null, fs.length ? db.putFindings(fs) : null]);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      toast(`Could not save: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, []);

  const schedule = useCallback(() => {
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY);
  }, [flush]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([db.getProject(projectId), db.listFindings(projectId)]).then(([p, fs]) => {
      if (cancelled) return;
      if (!p) {
        setStatus("missing");
        return;
      }
      setProject(p);
      setFindings(fs);
      setStatus("ready");
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      void flush();
    };
  }, [projectId, flush]);

  const touchProject = useCallback(
    (patch: Partial<Project> = {}) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
        dirtyProject.current = next;
        return next;
      });
      schedule();
    },
    [schedule],
  );

  const updateFinding = useCallback(
    (id: string, patch: Partial<Finding>) => {
      setFindings((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const next = { ...f, ...patch, updatedAt: new Date().toISOString() };
          dirtyFindings.current.set(id, next);
          return next;
        }),
      );
      touchProject();
    },
    [touchProject],
  );

  const addFinding = useCallback(
    async (init: Partial<Finding> = {}): Promise<Finding> => {
      const order = findings.reduce((max, f) => Math.max(max, f.order), -1) + 1;
      const finding: Finding = { ...createFinding(projectId, order), ...init };
      await db.putFinding(finding);
      setFindings((prev) => [...prev, finding]);
      touchProject();
      return finding;
    },
    [findings, projectId, touchProject],
  );

  const removeFinding = useCallback(
    async (id: string) => {
      dirtyFindings.current.delete(id);
      await db.deleteFinding(id);
      setFindings((prev) => prev.filter((f) => f.id !== id));
      touchProject();
    },
    [touchProject],
  );

  const reorder = useCallback(
    (orderedIds: string[]) => {
      setFindings((prev) => {
        const byId = new Map(prev.map((f) => [f.id, f]));
        return orderedIds
          .map((id, order) => {
            const f = byId.get(id);
            if (!f) return null;
            if (f.order === order) return f;
            const next = { ...f, order };
            dirtyFindings.current.set(id, next);
            return next;
          })
          .filter((f): f is Finding => f !== null);
      });
      touchProject();
    },
    [touchProject],
  );

  return {
    project,
    findings,
    status,
    saveState,
    updateProject: touchProject,
    updateFinding,
    addFinding,
    removeFinding,
    reorder,
    flush,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
