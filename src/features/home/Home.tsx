import { ArrowUpRight } from "lucide-react";
import { useEffect } from "react";
import { href } from "../../state/router";
import { FlowIn, PixelCorner, SwapHeadline, useScrollProgress } from "../../ui/motion";
import { PixelField } from "../../ui/PixelField";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
import { relative, SiteShell, useProjectActions, useProjects } from "../projects/shared";
import { LiveDemo } from "./LiveDemo";
import { PixelPage } from "./PixelPage";

const FACTS = [
  [
    "Evidence, pasted in",
    "Screenshots and HTTP requests go straight into the finding, next to the text they prove.",
  ],
  [
    "Severity you can defend",
    "It follows the CVSS score, so a 5.3 is always Medium. Rate it differently and the report prints your reason.",
  ],
  [
    "Nothing leaves this browser",
    "No account and no server. Projects live in this browser, and one file moves them to another.",
  ],
] as const;

/** The overview: what Debrief is, the product working, and your latest work. */
export function Home() {
  const { rows } = useProjects();
  const actions = useProjectActions();

  useEffect(() => {
    document.title = "Debrief - pentest report writer";
  }, []);

  const recent = rows?.slice(0, 3) ?? [];
  // The hero's words drift up and fade as the page scrolls away from them.
  const hero = useScrollProgress<HTMLElement>(undefined, "exit");

  return (
    <SiteShell current="home" projectCount={rows?.length ?? null} onNewProject={actions.create}>
      <section ref={hero} className="relative -mt-[68px] overflow-hidden">
        <div className="absolute inset-0">
          <PixelField shape="frame" />
        </div>
        <div className="relative mx-auto flex min-h-[min(100vh,820px)] max-w-[1240px] translate-y-[calc(var(--p,0)*-90px)] flex-col items-center justify-center px-6 pb-20 pt-36 text-center opacity-[calc(1-var(--p,0)*1.6)]">
          <SwapHeadline
            first={["Write findings", "like notes"]}
            then={["Pentest reports,", "written like notes"]}
            className="font-display text-[56px] italic leading-[1.04] tracking-[-0.03em] sm:text-[92px] lg:text-[124px]"
          />
          <p
            className="rise-late mt-6 max-w-[46ch] text-[15.5px] leading-relaxed text-ink sm:text-[16.5px]"
            style={{ animationDelay: "0.5s" }}
          >
            Write each finding in Markdown and download a typeset PDF your client can read. It runs
            in this browser, with no account.
          </p>
          <div
            className="rise-late mt-7 flex flex-wrap justify-center gap-2.5"
            style={{ animationDelay: "0.65s" }}
          >
            {actions.newButton}
            {actions.importButton}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] px-6">
        <FlowIn className="relative z-10 -mt-10">
          <LiveDemo />
        </FlowIn>

        {recent.length > 0 ? (
          <section aria-labelledby="recent-title" className="pt-20">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2
                id="recent-title"
                className="text-[26px] font-medium leading-tight tracking-[-0.02em] sm:text-[34px]"
              >
                Pick up where you left off
              </h2>
              <a
                href={href({ name: "projects" })}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm text-[13.5px] text-ink-muted transition-colors duration-(--dur-short) hover:text-ink [&_svg]:size-4 [&_svg]:transition-transform [&_svg]:duration-(--dur-short) [&_svg]:ease-(--ease-out) hover:[&_svg]:translate-x-0.5 hover:[&_svg]:-translate-y-0.5"
              >
                {rows?.length === 1 ? "Your project" : `All ${rows?.length} projects`}
                <ArrowUpRight />
              </a>
            </div>
            <ul className="mt-6 grid gap-3 md:grid-cols-3">
              {recent.map(({ project, findings }, i) => (
                <li key={project.id}>
                  <FlowIn
                    delay={i * 0.08}
                    className="group relative h-full overflow-hidden rounded-2xl bg-surface-1 p-5 transition-[translate,box-shadow] duration-(--dur-medium) ease-(--ease-out) hover:-translate-y-1 hover:shadow-page"
                  >
                    <PixelCorner />
                    <a
                      href={href({ name: "project", projectId: project.id, view: "overview" })}
                      className="block truncate rounded-sm text-[17px] font-medium tracking-[-0.01em] after:absolute after:inset-0 after:rounded-2xl"
                    >
                      {project.name || "Untitled project"}
                    </a>
                    <p className="mt-0.5 truncate text-[13px] text-ink-faint">
                      {project.client || "No client"}, edited {relative(project.updatedAt)}
                    </p>
                    <div className="mt-6 min-h-9">
                      {findings.length === 0 ? (
                        <span className="text-[13px] text-ink-faint">No findings yet</span>
                      ) : (
                        <SeverityMix counts={countSeverities(findings)} />
                      )}
                    </div>
                  </FlowIn>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <dl className="grid gap-3 pb-24 pt-20 md:grid-cols-3">
          {FACTS.map(([term, text], i) => (
            <FlowIn
              key={term}
              delay={i * 0.1}
              className="group relative overflow-hidden rounded-2xl bg-surface-1 p-6 transition-[translate,box-shadow] duration-(--dur-medium) ease-(--ease-out) hover:-translate-y-1 hover:shadow-page"
            >
              <PixelCorner />
              <dt className="font-display text-[30px] italic leading-tight tracking-[-0.02em]">
                {term}
              </dt>
              <dd className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">{text}</dd>
            </FlowIn>
          ))}
        </dl>
      </div>

      <PixelPage />
      {actions.dialog}
    </SiteShell>
  );
}
