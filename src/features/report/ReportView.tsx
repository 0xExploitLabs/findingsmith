import { CircleAlert, CircleCheck, Download, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { download, safeFilename } from "../../data/transfer";
import { cvssOf } from "../../domain/severity";
import type { Finding, Project } from "../../domain/types";
import { findSection, splitSections } from "../../markdown/sections";
import { href } from "../../state/router";
import { SheetMark } from "../../ui/Plot";
import { Button, cx } from "../../ui/primitives";
import { toast } from "../../ui/toast";
import { ReportSettings } from "./ReportSettings";

interface Check {
  ok: boolean;
  label: string;
  link?: string;
}

function checks(project: Project, findings: Finding[], refs: Map<string, string>): Check[] {
  const list: Check[] = [];
  const projectLink = href({ name: "project", projectId: project.id, view: "overview" });
  const projectSections = splitSections(project.body);
  list.push({ ok: !!project.client.trim(), label: "Client is set", link: projectLink });
  list.push({ ok: !!project.preparedBy.trim(), label: "“Prepared by” is set" });
  list.push({
    ok: !!findSection(projectSections, /summary/i),
    label: "Executive summary is written",
    link: projectLink,
  });
  for (const f of findings) {
    const ref = refs.get(f.id) ?? "";
    const link = href({ name: "finding", projectId: project.id, findingId: f.id });
    const sections = splitSections(f.body);
    const missing = [
      !f.title.trim() && "a title",
      sections.length === 0 && "a write-up",
      sections.length > 0 &&
        !findSection(sections, /remediat|recommend|fix|mitigat/i) &&
        "remediation",
      !cvssOf(f) && f.manualSeverity !== "Info" && "a CVSS score",
    ].filter(Boolean);
    if (missing.length > 0) {
      list.push({ ok: false, label: `${ref} needs ${missing.join(", ")}`, link });
    }
  }
  if (findings.length > 0 && list.every((c) => c.ok)) {
    list.push({
      ok: true,
      label:
        findings.length === 1
          ? "The finding is complete"
          : `All ${findings.length} findings are complete`,
    });
  }
  return list;
}

export function ReportView({
  project,
  findings,
  refs,
  onChange,
}: {
  project: Project;
  findings: Finding[];
  refs: Map<string, string>;
  onChange: (patch: Partial<Project>) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const generation = useRef(0);
  const snapshot = useRef({ project, findings });
  snapshot.current = { project, findings };

  const build = useCallback(async () => {
    const id = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const { renderReport } = await import("../../pdf/render");
      const out = await renderReport(snapshot.current.project, snapshot.current.findings);
      if (id !== generation.current) return null;
      setBlob(out);
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(out);
      });
      setStale(false);
      return out;
    } catch (err) {
      if (id === generation.current) {
        const message = err instanceof Error ? err.message : String(err);
        // A deploy replaced the lazily loaded PDF engine while this tab was open.
        setError(
          /dynamically imported module|Importing a module script failed/i.test(message)
            ? "stale"
            : message,
        );
      }
      return null;
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: build once on open; later edits are handled below
  useEffect(() => {
    void build();
  }, []);

  // Edits made while the report is open (design settings) re-render it after a pause.
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: any change to the inputs schedules a rebuild
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStale(true);
    const timer = setTimeout(() => void build(), 700);
    return () => clearTimeout(timer);
  }, [project, findings]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const filename = `${safeFilename([project.client, project.name].filter(Boolean).join(" ") || "report")}.pdf`;
  const list = useMemo(() => checks(project, findings, refs), [project, findings, refs]);
  const issues = list.filter((c) => !c.ok).length;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Report</h1>
          </div>
          <span className="truncate font-mono text-[12px] text-ink-faint">{filename}</span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="primary"
            icon={<Download />}
            disabled={busy && !blob}
            onClick={async () => {
              const out = stale || !blob ? await build() : blob;
              if (out) {
                download(out, filename);
                toast("PDF downloaded");
              }
            }}
          >
            Download PDF
          </Button>
        </div>
        <div className="relative min-h-0 flex-1 bg-surface-2">
          {error ? (
            <div className="m-auto flex h-full max-w-md flex-col items-center justify-center gap-3 text-center">
              <CircleAlert className="size-6 text-danger" />
              {error === "stale" ? (
                <>
                  <p className="text-[13.5px] text-ink-muted">
                    Debrief was updated since this tab opened. Reload to load the new version. Your
                    work is saved.
                  </p>
                  <Button size="sm" variant="primary" onClick={() => location.reload()}>
                    Reload
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-[13.5px] text-ink-muted">
                    The report could not be rendered: {error}
                  </p>
                  <Button size="sm" onClick={() => void build()}>
                    Try again
                  </Button>
                </>
              )}
            </div>
          ) : url ? (
            <iframe
              title="Report preview"
              src={`${url}#navpanes=0&view=FitH`}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-[13px] text-ink-muted">
              <SheetMark loop className="size-20" />
              Typesetting your report
            </div>
          )}
          {busy && url ? (
            <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg border border-line-strong bg-surface-1 px-3 py-1.5 text-[12px] text-ink-muted shadow-pop">
              <LoaderCircle className="size-3.5 animate-spin text-accent" /> Updating
            </div>
          ) : null}
        </div>
      </div>

      <aside className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface-1 lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-line px-5">
          <h2 className="text-[13.5px] font-semibold">Design</h2>
        </div>
        <ReportSettings project={project} onChange={onChange} />
        <div className="flex h-12 shrink-0 items-center gap-2 border-y border-line px-5">
          <h2 className="text-[13.5px] font-semibold">Checks</h2>
          <span
            className={cx(
              "ml-auto rounded-md px-2 py-0.5 text-[12px] font-medium tabular-nums",
              issues ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok",
            )}
          >
            {issues ? `${issues} to review` : "Ready"}
          </span>
        </div>
        <ul className="flex-1 space-y-0.5 p-2">
          {list.map((c) => {
            const body = (
              <>
                {c.ok ? (
                  <CircleCheck className="mt-px size-4 shrink-0 text-ok" />
                ) : (
                  <CircleAlert className="mt-px size-4 shrink-0 text-warn" />
                )}
                <span className={c.ok ? "text-ink-muted" : "text-ink"}>{c.label}</span>
              </>
            );
            return (
              <li key={c.label}>
                {c.link && !c.ok ? (
                  <a
                    href={c.link}
                    className="flex gap-2.5 rounded-lg px-3 py-2 text-[12.5px] leading-snug transition-colors hover:bg-hover"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="flex gap-2.5 px-3 py-2 text-[12.5px] leading-snug">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-5 py-3.5 text-[11.5px] leading-relaxed text-ink-faint">
          The PDF is made in your browser. Private notes are never included.
        </p>
      </aside>
    </div>
  );
}
