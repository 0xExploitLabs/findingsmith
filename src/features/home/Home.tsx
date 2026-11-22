import { ArrowUpRight } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { APP_NAME } from "../../brand";
import { href } from "../../state/router";
import { PixelCorner, Rise, SwapHeadline } from "../../ui/motion";
import { PixelField } from "../../ui/PixelField";
import { PixelStamp, type StampGlyph } from "../../ui/PixelStamp";
import { cx } from "../../ui/primitives";
import { countSeverities, SeverityMix } from "../../ui/SeverityMix";
import { useScrollProgress } from "../../ui/scroll";
import { relative, SiteShell, useProjectActions, useProjects } from "../projects/shared";
import { ReportShowcase } from "./ReportShowcase";

const FACTS: [StampGlyph, string, string][] = [
  [
    "capture",
    "Evidence, pasted in",
    "Screenshots and HTTP requests go straight into the finding, next to the text they prove.",
  ],
  [
    "gauge",
    "Severity you can defend",
    "It follows the CVSS score, so a 5.3 is always Medium. Rate it differently and the report prints your reason.",
  ],
  [
    "lock",
    "Nothing leaves this browser",
    "No account and no server. Projects live in this browser, and one file moves them to another.",
  ],
];

/** How far the cloud reaches below the hero, thinning out into the page. */
const CLOUD_TAIL = 168;

/** The overview: what the tool is, the product working, and your latest work. */
export function Home() {
  const { rows } = useProjects();
  const actions = useProjectActions();

  useEffect(() => {
    document.title = `${APP_NAME} - pentest report writer`;
  }, []);

  const recent = rows?.slice(0, 3) ?? [];
  const words = useRef<HTMLDivElement>(null);

  return (
    <SiteShell
      current="home"
      projectCount={rows?.length ?? null}
      onNewProject={actions.create}
      ending="field"
    >
      <Hero words={words}>
        <SwapHeadline
          first={["Write findings", "like notes"]}
          then={["Pentest reports,", "written like notes"]}
          className="font-display text-[52px] italic leading-[1.04] tracking-[-0.03em] min-[360px]:text-[56px] sm:text-[92px] lg:text-[124px]"
        />
        <p
          className="rise-late mt-6 max-w-[46ch] text-[15.5px] leading-relaxed text-ink sm:text-[16.5px]"
          style={{ animationDelay: "0.5s" }}
        >
          Write each finding in Markdown and download a typeset PDF your client can read. It runs in
          this browser, with no account.
        </p>
        <div
          className="rise-late mt-7 flex flex-wrap justify-center gap-2.5"
          style={{ animationDelay: "0.65s" }}
        >
          {actions.newButton}
          {actions.importButton}
        </div>
      </Hero>

      {/* The cloud's tail hangs over the top of this, so the first words wait below it. */}
      <div className="relative mx-auto max-w-[1240px] px-6" style={{ paddingTop: CLOUD_TAIL + 24 }}>
        {recent.length > 0 ? (
          <section aria-labelledby="recent-title">
            <Rise className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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
            </Rise>
            <ul className="mt-6 grid gap-3 md:grid-cols-3">
              {recent.map(({ project, findings }, i) => (
                <Rise
                  as="li"
                  key={project.id}
                  delay={0.12 + i * 0.14}
                  className="tilt-card group relative overflow-hidden rounded-2xl bg-surface-1 p-5"
                >
                  <PixelCorner />
                  <a
                    href={href({ name: "project", projectId: project.id, view: "overview" })}
                    className="block truncate rounded-sm text-[17px] font-medium tracking-[-0.01em] after:absolute after:inset-0 after:rounded-2xl"
                  >
                    {project.name || "Untitled project"}
                  </a>
                  <p className="mt-0.5 truncate text-[13px] text-ink-faint">
                    {project.client ? `${project.client}, edited ` : "Edited "}
                    {relative(project.updatedAt)}
                  </p>
                  <div className="mt-6 min-h-9">
                    {findings.length === 0 ? (
                      <span className="text-[13px] text-ink-faint">No findings yet</span>
                    ) : (
                      <SeverityMix counts={countSeverities(findings)} />
                    )}
                  </div>
                </Rise>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          aria-labelledby="facts-title"
          className={cx("pb-20 sm:pb-32", recent.length > 0 ? "pt-20 sm:pt-32" : "pt-2 sm:pt-8")}
        >
          <Rise className="mx-auto max-w-[760px] text-center">
            <h2
              id="facts-title"
              className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[60px]"
            >
              Less formatting, more findings
            </h2>
            <p className="mx-auto mt-5 max-w-[50ch] text-[15px] leading-relaxed text-ink-muted sm:text-[16px]">
              The report is laid out for you, so the hours go into the testing and the write-up.
            </p>
          </Rise>
          <dl className="mt-12 grid gap-3 sm:mt-16 md:grid-cols-3">
            {FACTS.map(([glyph, term, text], i) => (
              <Rise
                key={term}
                delay={0.12 + i * 0.14}
                className="tilt-card group relative overflow-hidden rounded-2xl bg-surface-1 p-7 sm:p-8"
              >
                <PixelCorner />
                <PixelStamp glyph={glyph} seed={i + 1} />
                <dt className="mt-7 font-display text-[32px] italic leading-tight tracking-[-0.02em]">
                  {term}
                </dt>
                <dd className="mt-3 text-[15px] leading-relaxed text-ink-muted">{text}</dd>
              </Rise>
            ))}
          </dl>
        </section>
      </div>

      <ReportShowcase />
      {actions.dialog}
    </SiteShell>
  );
}

/**
 * The first screen: the words, and the cloud that gathers around them and
 * thins out into the page below. The words drift up and fade as the page
 * scrolls away from them.
 */
function Hero({
  words,
  children,
}: {
  words: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const ref = useScrollProgress<HTMLElement>("exit");
  return (
    <section ref={ref} className="relative -mt-[68px] overflow-x-clip">
      <div className="absolute inset-x-0 top-0" style={{ bottom: -CLOUD_TAIL }}>
        <PixelField shape="cloud" clear={words} tail={CLOUD_TAIL} />
      </div>
      <div
        ref={words}
        className="hero-words relative mx-auto flex min-h-svh max-w-[1240px] flex-col items-center justify-center px-6 pb-20 pt-36 text-center"
      >
        {children}
      </div>
    </section>
  );
}
