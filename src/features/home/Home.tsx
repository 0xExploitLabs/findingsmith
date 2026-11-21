import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { href } from "../../state/router";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
import { relative, SiteShell, useProjectActions, useProjects } from "../projects/shared";
import { CreationStage } from "./CreationStage";

/** The overview: what Debrief is, how a report is made, and your latest work. */
export function Home() {
  const { rows } = useProjects();
  const actions = useProjectActions();

  useEffect(() => {
    document.title = "Debrief - pentest report writer";
  }, []);

  const recent = rows?.slice(0, 3) ?? [];

  return (
    <SiteShell current="home" projectCount={rows?.length ?? null}>
      <div className="mx-auto max-w-[1240px] px-6 pb-24">
        <section className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 pb-12 pt-14">
          <div>
            <h1 className="max-w-[16ch] text-[40px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[52px]">
              Pentest reports, written like notes
            </h1>
            <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-ink-muted">
              Write each finding in Markdown and download a typeset PDF your client can read.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 pb-1">
            <div className="flex flex-wrap gap-2.5">
              {actions.newButton}
              {actions.importButton}
            </div>
            <p className="text-[13px] text-ink-faint">
              Or drop a project file anywhere on this page.
            </p>
          </div>
        </section>

        {recent.length > 0 ? (
          <section aria-labelledby="recent-title" className="animate-rise pb-14">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="recent-title" className="text-[15px] font-semibold">
                Pick up where you left off
              </h2>
              <a
                href={href({ name: "projects" })}
                className="flex items-center gap-1 rounded-sm text-[13.5px] text-ink-muted hover:text-ink [&_svg]:size-3.5"
              >
                {rows?.length === 1 ? "Your project" : `All ${rows?.length} projects`}
                <ArrowRight />
              </a>
            </div>
            <ul className="mt-3 grid gap-3 md:grid-cols-3">
              {recent.map(({ project, findings }) => (
                <li
                  key={project.id}
                  className="relative rounded-xl bg-surface-1 p-4 transition-colors duration-(--dur-micro) hover:bg-surface-2"
                >
                  <a
                    href={href({ name: "project", projectId: project.id, view: "overview" })}
                    className="block truncate rounded-sm text-[15px] font-semibold tracking-[-0.01em] after:absolute after:inset-0 after:rounded-xl"
                  >
                    {project.name || "Untitled project"}
                  </a>
                  <p className="mt-0.5 truncate text-[13px] text-ink-faint">
                    {project.client || "No client"}, edited {relative(project.updatedAt)}
                  </p>
                  <div className="mt-4 min-h-9">
                    {findings.length === 0 ? (
                      <span className="text-[13px] text-ink-faint">No findings yet</span>
                    ) : (
                      <SeverityMix counts={countSeverities(findings)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <CreationStage />
      </div>
      {actions.dialog}
    </SiteShell>
  );
}
