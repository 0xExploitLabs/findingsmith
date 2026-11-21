import { ArrowUpRight } from "lucide-react";
import { type CSSProperties, useMemo, useRef } from "react";
import { readCvss } from "../../domain/cvss";
import { splitSections } from "../../markdown/sections";
import { href } from "../../state/router";
import { useScrollProgress } from "../../ui/motion";
import { PixelField } from "../../ui/PixelField";
import { ART, FOCUS, FOCUS_SIZE, PAGE_ART } from "./pageArt";
import { ReportSheet } from "./ReportSheet";
import { SAMPLE_BODY, SAMPLE_TITLE, SAMPLE_VECTOR } from "./sample";

/* The scroll through the pinned screen, 0 to 1: the drawn page rises and the
   view flies into its score, holds, pulls back to the whole page, and then the
   words arrive. */
const FLY_END = 0.3;
const PULL_START = 0.36;
const PULL_END = 0.74;
const SAID_START = 0.72;

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

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (moment: number) => ({ "--at": moment }) as CSSProperties;

/**
 * The report, met as a drawing in large pixels: it rises from the foot of the
 * page, the view flies into its Critical score, then pulls back until the
 * whole sheet hangs in the colour field, where it turns into the typeset page.
 */
export function PixelPage() {
  const sheet = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);

  const ref = useScrollProgress<HTMLElement>((p, el) => {
    const page = sheet.current?.getBoundingClientRect();
    const view = screen.current?.getBoundingClientRect();
    if (!page || !view || !page.width) return;
    // Where the page rests, and the focus point on it, inside the pinned screen.
    const left = page.left - view.left;
    const top = page.top - view.top;
    const fx = FOCUS.x * page.width;
    const fy = FOCUS.y * page.height;

    // Rising: wider than the screen, its head just inside the top.
    const rise = Math.max((view.width * 1.12) / page.width, 2.2);
    const riseX = view.width / 2 - left - fx - rise * (page.width / 2 - fx);
    const riseY = view.height * 0.1 - top - fy + rise * fy;
    // Inside: the score's digits fill the middle of the screen.
    const inside = Math.min(
      (view.width * 0.5) / (FOCUS_SIZE.w * page.width),
      (view.height * 0.4) / (FOCUS_SIZE.h * page.height),
    );
    const insideX = view.width / 2 - left - fx;
    const insideY = view.height / 2 - top - fy;

    let zoom = 1;
    let x = 0;
    let y = 0;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (p < PULL_START) {
        const t = easeInOut(clamp(p / FLY_END));
        // Zoom in equal ratios, so the flight is as fast at its end as at its start.
        zoom = rise * (inside / rise) ** t;
        x = mix(riseX, insideX, t);
        y = mix(riseY, insideY, t);
      } else {
        const t = easeInOut(clamp((p - PULL_START) / (PULL_END - PULL_START)));
        zoom = inside ** (1 - t);
        x = insideX * (1 - t) ** 2;
        y = insideY * (1 - t) ** 2;
      }
    }
    const said = clamp((p - SAID_START) / (1 - SAID_START - 0.04));
    el.style.setProperty("--zoom", zoom.toFixed(4));
    el.style.setProperty("--x", `${x.toFixed(1)}px`);
    el.style.setProperty("--y", `${y.toFixed(1)}px`);
    el.style.setProperty("--field", clamp((p - 0.12) / 0.16).toFixed(3));
    el.style.setProperty("--real", clamp((p - PULL_END + 0.02) / 0.06).toFixed(3));
    el.style.setProperty("--said", said.toFixed(3));
    el.toggleAttribute("data-said", said > 0.5);
  });

  const score = useMemo(() => {
    const read = readCvss(SAMPLE_VECTOR);
    return read.ok ? read.cvss : null;
  }, []);
  const sections = useMemo(() => splitSections(SAMPLE_BODY), []);

  return (
    <>
      <section ref={ref} aria-labelledby="read-title" className="relative h-[340vh]">
        <div ref={screen} className="sticky top-0 h-svh overflow-hidden">
          <div className="absolute inset-0 bg-field opacity-(--field,1)" />
          <div className="relative mx-auto grid h-full max-w-[1240px] content-center items-center justify-items-center gap-x-20 gap-y-7 px-6 pb-8 pt-[76px] lg:grid-cols-[auto_minmax(0,430px)] lg:justify-center lg:justify-items-start">
            <div
              ref={sheet}
              className="relative z-10 aspect-[595/842] h-[min(40svh,420px)] lg:h-[min(76svh,740px)]"
            >
              <ReportSheet
                title={SAMPLE_TITLE}
                score={score}
                sections={sections}
                size="a4"
                className="absolute inset-0 opacity-(--real,1)"
              />
              <svg
                viewBox={`0 0 ${ART.width} ${ART.height}`}
                shapeRendering="crispEdges"
                aria-hidden="true"
                className="absolute inset-0 size-full translate-x-(--x,0px) translate-y-(--y,0px) scale-(--zoom,1) overflow-visible opacity-[calc(1-var(--real,1))]"
                style={{ transformOrigin: `${FOCUS.x * 100}% ${FOCUS.y * 100}%` }}
              >
                <rect
                  x="1"
                  y="1"
                  width={ART.width}
                  height={ART.height}
                  fill="#000"
                  opacity="0.16"
                />
                <rect width={ART.width} height={ART.height} className="fill-sheet" />
                {PAGE_ART.map((b, i) => (
                  <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, never reordered
                    key={i}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    fill={b.fill}
                    opacity={b.o}
                  />
                ))}
              </svg>
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
      <div className="h-56 bg-bg">
        <PixelField shape="fall" />
      </div>
    </>
  );
}
