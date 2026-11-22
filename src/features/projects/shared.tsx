import { FileUp, Plus } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME, ORG_EMAIL, ORG_LINKS, ORG_NAME, ORG_URL, REPO_URL } from "../../brand";
import * as db from "../../data/db";
import { importProject } from "../../data/transfer";
import { createProject } from "../../domain/factories";
import type { Finding, Project } from "../../domain/types";
import { href, navigate, type Route } from "../../state/router";
import { GitHubMark } from "../../ui/GitHubMark";
import { PixelField } from "../../ui/PixelField";
import { Button, cx, Dialog, Field, TextInput } from "../../ui/primitives";
import { ScrollContext, ScrollStage, useScrollProgress } from "../../ui/scroll";
import { ThemeToggle } from "../../ui/ThemeToggle";
import { toast } from "../../ui/toast";
import { Cicada, Wordmark } from "../../ui/Wordmark";

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

const FOOT_LINK =
  "rounded-sm text-ink underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-(--dur-short) hover:decoration-current";

/** The two ways to start a project, and the dialog the first one opens. */
export function useProjectActions() {
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  return {
    create: () => setCreating(true),
    newButton: (
      <Button
        variant="primary"
        icon={<Plus />}
        onClick={() => setCreating(true)}
        className="[&_svg]:transition-transform [&_svg]:duration-(--dur-medium) [&_svg]:ease-(--ease-out) enabled:hover:[&_svg]:rotate-90"
      >
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
 * footer, and a page-wide drop target for project files. It is also the stage
 * the page scrolls on: the wheel is smoothed, everything inside can follow the
 * scroll, and the page lifts off the footer like a curtain at its end.
 */
export function SiteShell({
  current,
  projectCount,
  onNewProject,
  ending,
  children,
}: {
  current: Extract<Route, { name: "home" | "projects" }>["name"];
  projectCount: number | null;
  onNewProject: () => void;
  /** "field" when the page ends on the colour field, whose edge then breaks up over the footer. */
  ending?: "field";
  children: ReactNode;
}) {
  const [stage] = useState(() => new ScrollStage());
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scroller.current || !content.current) return;
    return stage.attach(scroller.current, content.current);
  }, [stage]);

  const link = (name: "home" | "projects", label: ReactNode) => (
    <a
      href={href({ name })}
      aria-current={current === name ? "page" : undefined}
      className={cx(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-[13.5px] max-sm:px-2.5 font-medium transition-colors duration-(--dur-short) ease-(--ease-out)",
        current === name ? "bg-surface-3 text-ink" : "text-ink-muted hover:bg-hover hover:text-ink",
      )}
    >
      {label}
    </a>
  );
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a file drop target; "Import project file" is the accessible route to the same action
    <div
      ref={scroller}
      className="relative h-full overflow-y-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) void importFile(file);
      }}
    >
      <ScrollContext value={stage}>
        <div ref={content} className="flex min-h-full flex-col">
          <header className="pointer-events-none sticky top-0 z-20 h-[68px] shrink-0">
            <div className="mx-auto flex h-full max-w-[1240px] items-center gap-2 px-6 [&>*]:pointer-events-auto">
              <nav
                aria-label="Main"
                className="flex h-11 items-center gap-0.5 rounded-full bg-surface-1 pl-4 pr-1.5 shadow-page max-sm:pl-3"
              >
                <a
                  href={href({ name: "home" })}
                  aria-label={`${APP_NAME}, home`}
                  className="mr-2 rounded-md max-sm:mr-1"
                >
                  {/* A phone has room for the mark alone; the link's label still names it. */}
                  <Wordmark compact flap className="max-sm:[&>span:not(.cicada)]:hidden" />
                </a>
                {link("home", "Overview")}
                {link(
                  "projects",
                  <>
                    Projects
                    {projectCount ? (
                      <span className="text-[12.5px] tabular-nums text-ink-faint">
                        {projectCount}
                      </span>
                    ) : null}
                  </>,
                )}
              </nav>
              <button
                type="button"
                onClick={onNewProject}
                className="ml-auto flex h-11 items-center rounded-full bg-ink px-4 text-[13.5px] font-medium text-bg shadow-page transition-transform duration-(--dur-short) ease-(--ease-out) hover:-translate-y-0.5 active:translate-y-0 max-sm:hidden"
              >
                Start a report
              </button>
              <span className="flex h-11 items-center gap-0.5 rounded-full bg-surface-1 px-2 shadow-page max-sm:ml-auto">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${APP_NAME} on GitHub`}
                  title={`${APP_NAME} on GitHub`}
                  // The narrowest phones have no room for it; the footer links there too.
                  className="max-[359px]:hidden inline-flex size-7 items-center justify-center rounded-lg text-ink-muted transition-[background-color,color,scale] duration-(--dur-short) ease-(--ease-out) hover:bg-hover hover:text-ink active:scale-90 active:bg-press"
                >
                  <GitHubMark className="size-4" />
                </a>
                <ThemeToggle />
              </span>
            </div>
          </header>
          {ending === "field" ? (
            <Page>{children}</Page>
          ) : (
            <main className="flex-1">{children}</main>
          )}
          <Footer onNewProject={onNewProject} curtain={ending === "field"} />
        </div>
      </ScrollContext>
    </div>
  );
}

/**
 * The page itself, lying over the footer. As its foot rises it uncovers the
 * footer beneath, and tells it how far along that is.
 */
function Page({ children }: { children: ReactNode }) {
  const ref = useScrollProgress<HTMLElement>("tail", (p, el) => {
    const footer = el.nextElementSibling;
    if (!(footer instanceof HTMLElement)) return;
    footer.style.setProperty("--reveal", String(p));
    footer.toggleAttribute("data-live", p > 0);
  });
  return (
    <main ref={ref} className="relative z-10 flex-1">
      <div className="bg-bg">{children}</div>
      {/* The field's last edge: it breaks into pixels, and the footer shows between them. */}
      <div className="pointer-events-none h-36 sm:h-44">
        <PixelField shape="fall" />
      </div>
    </main>
  );
}

function Footer({ onNewProject, curtain }: { onNewProject: () => void; curtain: boolean }) {
  const ref = useRef<HTMLElement>(null);
  // The footer waits under the page only when a screen can hold all of it;
  // a taller one would never show its head, so it follows the page instead.
  useEffect(() => {
    const el = ref.current;
    // The scrolling page is the nearest positioned ancestor.
    const scroller = el?.offsetParent;
    if (!curtain || !el || !scroller) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const settle = () =>
      el.toggleAttribute("data-curtain", el.offsetHeight <= scroller.clientHeight);
    settle();
    const resized = new ResizeObserver(settle);
    resized.observe(el);
    resized.observe(scroller);
    // While it waits under the page it is on screen but covered, so the browser
    // sees no reason to scroll to a link in it that takes focus. Do it instead.
    const reveal = () => {
      if (el.hasAttribute("data-curtain")) {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
      }
    };
    el.addEventListener("focusin", reveal);
    return () => {
      resized.disconnect();
      el.removeEventListener("focusin", reveal);
    };
  }, [curtain]);
  return (
    <footer
      ref={ref}
      // Where no page lifts off it, the footer is simply there: shown, and alive.
      data-live={curtain ? undefined : ""}
      className="site-footer shrink-0 overflow-hidden pt-20 sm:pt-28"
    >
      <div className="footer-words mx-auto max-w-[1240px] px-6">
        <div className="grid gap-x-16 gap-y-12 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div>
            <p className="font-display text-[64px] italic leading-[0.9] tracking-[-0.02em] sm:text-[88px]">
              {APP_NAME}
            </p>
            <a
              href={ORG_URL}
              target="_blank"
              rel="noreferrer"
              className="group/org mt-4 inline-flex items-center gap-2.5 rounded-md text-[15px] text-ink-muted transition-colors duration-(--dur-short) hover:text-ink"
            >
              <Cicada flap="greet" className="h-[15px] text-ink" />
              <span>
                by{" "}
                <span className="font-medium text-ink [font-feature-settings:'zero']">
                  {ORG_NAME}
                </span>
              </span>
            </a>
            <p className="mt-5 max-w-[40ch] text-[14.5px] leading-relaxed text-ink-muted">
              Pentest reports, written like notes. Everything is stored in this browser’s IndexedDB
              and never leaves this device.
            </p>
            <ul
              aria-label={`${ORG_NAME} elsewhere`}
              className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14.5px]"
            >
              {ORG_LINKS.map(({ label, url }) => (
                <li key={label}>
                  <a href={url} target="_blank" rel="noreferrer" className={FOOT_LINK}>
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${ORG_EMAIL}`} className={FOOT_LINK}>
                  {ORG_EMAIL}
                </a>
              </li>
            </ul>
          </div>
          <nav aria-label="Footer" className="contents">
            <div>
              <h2 className="text-[13px] text-ink-faint">Product</h2>
              <ul className="mt-3 space-y-2 text-[14.5px]">
                <li>
                  <a href={href({ name: "home" })} className={FOOT_LINK}>
                    Overview
                  </a>
                </li>
                <li>
                  <a href={href({ name: "projects" })} className={FOOT_LINK}>
                    Projects
                  </a>
                </li>
                <li>
                  <button type="button" onClick={onNewProject} className={FOOT_LINK}>
                    Start a report
                  </button>
                </li>
                <li>
                  <a href={REPO_URL} target="_blank" rel="noreferrer" className={FOOT_LINK}>
                    Source on GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-[13px] text-ink-faint">Made by</h2>
              <ul className="mt-3 space-y-2 text-[14.5px]">
                <li>
                  <a href={ORG_URL} target="_blank" rel="noreferrer" className={FOOT_LINK}>
                    <span className="[font-feature-settings:'zero']">{ORG_NAME}</span>
                  </a>
                </li>
                <li className="text-ink-muted">No account, no server</li>
                <li className="text-ink-muted">MIT or Apache-2.0</li>
              </ul>
            </div>
          </nav>
        </div>
      </div>
      <Cicada
        hatch
        flap="idle"
        className="footer-cicada mx-auto mt-14 block! w-[min(1100px,92%)] translate-y-[18%] text-field sm:mt-20"
      />
    </footer>
  );
}

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  const create = async () => {
    const project = createProject(name.trim() || "Untitled project");
    await db.putProject(project);
    onClose();
    navigate({ name: "project", projectId: project.id, view: "overview" });
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={440}
      title="New project"
      description="A name is all it needs. Everything else can be filled in as you write."
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
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
