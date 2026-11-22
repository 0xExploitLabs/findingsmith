import { ArrowUpRight } from "lucide-react";
import { type CSSProperties, useLayoutEffect, useMemo, useRef } from "react";
import { readCvss } from "../../domain/cvss";
import { splitSections } from "../../markdown/sections";
import { href } from "../../state/router";
import { PixelField } from "../../ui/PixelField";
import { reducedMotion, useScrollProgress } from "../../ui/scroll";
import { ReportContents, ReportCover, ReportSheet } from "./ReportSheet";
import {
  SAMPLE_ACCENT,
  SAMPLE_BODY,
  SAMPLE_CONTENTS,
  SAMPLE_COUNTS,
  SAMPLE_ENDPOINT,
  SAMPLE_PARAMETER,
  SAMPLE_PARTICULARS,
  SAMPLE_PARTIES,
  SAMPLE_TITLE,
  SAMPLE_VECTOR,
  SAMPLE_WEAKNESS,
} from "./sample";

/* The scroll through the pinned screen, 0 to 1: the finding is read from its
   head to its foot at full size, the view pulls back until the whole page
   hangs in the colour field with the cover and the contents fanned out behind
   it, and then the words arrive. */
const READ_END = 0.46;
const PULL_START = 0.5;
const PULL_END = 0.8;
const SAID_START = 0.78;

/** What the page holds, said beside it. */
const POINTS: [string, string][] = [
  [
    "Severity you can defend",
    "The rating follows the CVSS score, and an override prints its reason.",
  ],
  [
    "Your Markdown, typeset",
    "Headings, lists, tables and screenshots, set in the report's own type.",
  ],
  ["Evidence, highlighted", "Requests and code keep their indentation and their colours."],
];

/** The share of a page's width that its column of text takes: A4 less its two margins. */
const COLUMN = 0.812;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (moment: number) => ({ "--at": moment }) as CSSProperties;

/** Where the pages sit at each end of the journey, measured when the layout changes. */
interface Journey {
  /** Reading: the page at full size, from its head to its foot. */
  readX: [number, number];
  readY: [number, number];
  /** At rest: the page scaled into its place beside the words. */
  restX: number;
  restScale: number;
}

/** An element's place inside `root` as laid out, whatever transforms it wears. */
function placeIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/**
 * The report, met as it prints. The sample finding arrives at reading size and
 * the scroll reads down it; then the view pulls back to the whole page, its
 * cover and contents fan out behind it, and the words say what it is. The
 * pages are laid out at their largest and only ever scaled down, so the type
 * is sharp at every step.
 */
export function ReportShowcase() {
  const screen = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const journey = useRef<Journey | null>(null);
  const progress = useRef(1);

  const place = (p: number, el: HTMLElement) => {
    const j = journey.current;
    if (!j) return;
    let x = j.restX;
    let y = 0;
    let scale = j.restScale;
    let fan = 1;
    if (p < PULL_START) {
      const t = 1 - (1 - clamp(p / READ_END)) ** 1.5;
      x = mix(j.readX[0], j.readX[1], easeInOut(clamp((t - 0.2) / 0.6)));
      y = mix(j.readY[0], j.readY[1], t);
      scale = 1;
      fan = 0;
    } else if (p < PULL_END) {
      const t = easeInOut((p - PULL_START) / (PULL_END - PULL_START));
      // Scaled in equal ratios, so the pull back is as fast at its end as at its start.
      scale = j.restScale ** t;
      x = mix(j.readX[1], j.restX, t);
      y = mix(j.readY[1], 0, t);
      fan = easeInOut(clamp((t - 0.3) / 0.7));
    }
    const said = clamp((p - SAID_START) / (1 - SAID_START - 0.04));
    el.style.setProperty("--x", `${x.toFixed(1)}px`);
    el.style.setProperty("--y", `${y.toFixed(1)}px`);
    el.style.setProperty("--s", scale.toFixed(4));
    el.style.setProperty("--fan", fan.toFixed(3));
    el.style.setProperty("--said", said.toFixed(3));
    el.toggleAttribute("data-said", said > 0.5);
  };

  const ref = useScrollProgress<HTMLElement>("pin", (p, el) => {
    progress.current = p;
    place(p, el);
  });

  // The journey is measured here and only read while scrolling.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured once, then on every resize
  useLayoutEffect(() => {
    const section = ref.current;
    const view = screen.current;
    const rest = box.current;
    const pages = stack.current;
    if (!section || !view || !rest || !pages) return;
    const measure = () => {
      const width = pages.offsetWidth;
      const height = pages.offsetHeight;
      if (!width || !height) return;
      const spread = Number(getComputedStyle(section).getPropertyValue("--spread")) || 0;
      const at = placeIn(rest, view);
      const restScale = rest.offsetHeight / height;
      const fanned = width * restScale * (1 + spread);
      // Read from just under the header to just above the foot of the screen.
      // A page whose text fits the screen stays centred, margins and all; a
      // wider one is read from its left edge to its right.
      const fits = width * COLUMN <= view.clientWidth;
      const gutter = fits ? (view.clientWidth - width) / 2 : 16;
      const head = 96 - at.y;
      const foot = view.clientHeight - 40 - height - at.y;
      journey.current = {
        readX: [gutter - at.x, view.clientWidth - gutter - width - at.x],
        readY: [head, Math.min(head, foot)],
        restX: (rest.offsetWidth - fanned) / 2 + width * restScale * spread,
        restScale,
      };
      place(reducedMotion() ? 1 : progress.current, section);
    };
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(view);
    resized.observe(pages);
    return () => resized.disconnect();
  }, []);

  const score = useMemo(() => {
    const read = readCvss(SAMPLE_VECTOR);
    return read.ok ? read.cvss : null;
  }, []);
  const sections = useMemo(() => splitSections(SAMPLE_BODY), []);
  const properties = useMemo(
    () => [
      {
        label: "Endpoint",
        value: (
          <>
            <span className="font-bold text-accent">{SAMPLE_ENDPOINT.method} </span>
            {SAMPLE_ENDPOINT.url}
          </>
        ),
      },
      { label: "Parameter", value: SAMPLE_PARAMETER },
      { label: "Weakness", value: <span className="text-accent">{SAMPLE_WEAKNESS}</span> },
    ],
    [],
  );

  return (
    <>
      {/* The colour field arrives as loose pixels that close into a solid edge. */}
      <div className="h-36 sm:h-44">
        <PixelField shape="rise" />
      </div>
      <section
        ref={ref}
        aria-labelledby="read-title"
        className="report-show relative bg-field motion-safe:h-[300vh] motion-safe:lg:h-[440vh]"
      >
        <div
          ref={screen}
          className="grid min-h-svh overflow-hidden motion-safe:sticky motion-safe:top-0 motion-safe:h-svh"
        >
          <PixelField shape="fall" tone="inverse" cell={30} className="absolute inset-0" />
          <div className="relative mx-auto grid h-full max-w-[1240px] content-center items-center justify-items-center gap-x-16 gap-y-8 px-6 pb-8 pt-[84px] lg:grid-cols-[auto_minmax(0,380px)] lg:justify-center lg:justify-items-start">
            <div ref={box} className="report-rest relative z-10">
              <div ref={stack} className="report-stack">
                <ReportCover
                  parties={SAMPLE_PARTIES}
                  accent={SAMPLE_ACCENT}
                  counts={SAMPLE_COUNTS}
                  particulars={SAMPLE_PARTICULARS}
                  size="a4"
                  page="cover"
                  className="report-page"
                />
                <ReportContents
                  parties={SAMPLE_PARTIES}
                  entries={SAMPLE_CONTENTS}
                  size="a4"
                  page="contents"
                  className="report-page max-sm:hidden"
                />
                <ReportSheet
                  title={SAMPLE_TITLE}
                  score={score}
                  sections={sections}
                  parties={SAMPLE_PARTIES}
                  properties={properties}
                  size="a4"
                  className="report-page"
                />
              </div>
            </div>

            <div className="relative text-on-field max-lg:text-center">
              <h2
                id="read-title"
                style={at(0)}
                className="said font-display text-[46px] italic leading-none tracking-[-0.02em] sm:text-[64px] lg:text-[84px]"
              >
                Built to be read
              </h2>
              <p
                style={at(0.12)}
                className="said mt-4 text-[15px] leading-relaxed opacity-90 max-lg:mx-auto max-lg:max-w-[42ch] lg:mt-6 lg:text-[16px]"
              >
                Every pixel of the report is yours: a cover, contents with page numbers, a risk
                overview and one section per finding. No watermark, and no tool name in the file.
              </p>
              <ul className="mt-8 space-y-5 max-lg:hidden">
                {POINTS.map(([term, text], i) => (
                  <li key={term} style={at(0.24 + i * 0.1)} className="said flex gap-3.5">
                    <span aria-hidden="true" className="mt-[7px] grid shrink-0 grid-cols-2 gap-px">
                      <i className="size-[5px] bg-current" />
                      <i className="size-[5px] bg-current opacity-55" />
                      <i className="size-[5px] bg-current opacity-55" />
                      <i className="size-[5px] bg-current opacity-25" />
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium">{term}</span>
                      <span className="mt-0.5 block text-[14px] leading-relaxed opacity-80">
                        {text}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div style={at(0.58)} className="said mt-6 lg:mt-9">
                <a
                  href={href({ name: "projects" })}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full bg-on-field px-5 text-[14px] font-medium text-sheet transition-transform duration-(--dur-short) ease-(--ease-out) hover:-translate-y-0.5 active:translate-y-0 [&_svg]:size-4 [&_svg]:transition-transform [&_svg]:duration-(--dur-short) [&_svg]:ease-(--ease-out) hover:[&_svg]:translate-x-0.5 hover:[&_svg]:-translate-y-0.5"
                >
                  Open your projects
                  <ArrowUpRight />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
