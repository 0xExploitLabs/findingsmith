import { ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { SEVERITY_HEX } from "../../domain/severity";
import { tint } from "../../pdf/palette";
import { href } from "../../state/router";
import { useScrollProgress } from "../../ui/motion";
import { PixelField } from "../../ui/PixelField";

/* A finding's page at 30 by 42 pixels, with the parts the PDF prints: running
   head, reference and severity, title, score box, two sections, a code block
   and the folio. Each entry is x, y, width, height and a fill. */
const RED = SEVERITY_HEX.Critical;
const INK = "fill-sheet-ink";
const TEAL = "fill-sheet-accent";
const ART: [number, number, number, number, string, number?][] = [
  [3, 3, 24, 1, INK, 0.14],
  [22, 3, 5, 1, TEAL],
  [3, 6, 2, 1, TEAL],
  [6, 6, 6, 1, tint(RED, 0.72)],
  [6, 6, 1, 1, RED],
  [3, 8, 16, 2, INK],
  [3, 12, 24, 5, "fill-sheet-rule"],
  [4, 13, 22, 3, "fill-sheet"],
  [4, 13, 6, 3, tint(RED, 0.84)],
  [5, 14, 3, 2, RED],
  [11, 14, 12, 1, INK, 0.3],
  [3, 19, 7, 1, TEAL],
  [3, 21, 23, 1, INK, 0.3],
  [3, 23, 17, 1, INK, 0.3],
  [3, 26, 9, 1, TEAL],
  [3, 28, 20, 1, INK, 0.3],
  [3, 30, 24, 5, "fill-sheet-wash"],
  [4, 31, 4, 1, "#8A5200", 0.75],
  [9, 31, 8, 1, TEAL, 0.7],
  [4, 33, 13, 1, INK, 0.3],
  [3, 39, 9, 1, INK, 0.14],
  [25, 39, 2, 1, INK, 0.3],
];

/* The view starts inside the red score, at 5 to 8 across and 14 to 16 down. */
const ORIGIN = "origin-[21.67%_35.71%]";
const START_ZOOM = 70;

/** What the labels point at, each with the moment it appears, 0 to 1. */
const CALLOUTS: [string, string, number][] = [
  ["Rated Critical", "right-full mr-3 top-[12%] flex-row-reverse", 0],
  ["CVSS 9.8", "left-full ml-3 top-[32%]", 0.14],
  ["Your Markdown, typeset", "left-full ml-3 top-[54%]", 0.28],
  ["Evidence, highlighted", "right-full mr-3 top-[74%] flex-row-reverse", 0.42],
];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const at = (moment: number) => ({ "--at": moment }) as CSSProperties;
/**
 * The report seen from inside one of its pixels: scrolling pulls back out of
 * the red of a Critical score until the whole page hangs in the colour field,
 * and then the page is labelled, part by part.
 */
export function PixelPage() {
  const ref = useScrollProgress<HTMLElement>((p, el) => {
    // Zoom in equal ratios, so the pull-back feels as fast at the end as at the start.
    const out = easeInOut(Math.min(1, p / 0.62));
    const said = Math.min(1, Math.max(0, (p - 0.56) / 0.36));
    el.style.setProperty("--zoom", (START_ZOOM ** (1 - out)).toFixed(4));
    el.style.setProperty("--said", said.toFixed(3));
    el.style.setProperty("--hint", Math.max(0, 1 - p * 9).toFixed(3));
    el.toggleAttribute("data-said", said > 0.6);
  });
  return (
    <>
      <div className="h-56">
        <PixelField shape="rise" />
      </div>
      <section
        ref={ref}
        aria-labelledby="read-title"
        className="relative h-[300vh] bg-accent text-ink-inverse"
      >
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className="absolute inset-0 opacity-(--said)">
            <PixelField shape="frame" tone="inverse" />
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center pt-16">
            <div className="relative aspect-[30/42] h-[min(54vh,460px)]">
              <svg
                viewBox="0 0 30 42"
                shapeRendering="crispEdges"
                role="img"
                aria-label="A report page drawn in large pixels: a red Critical score, section headings, lines of text and a code block"
                className={`size-full scale-(--zoom) shadow-page ${ORIGIN}`}
              >
                <rect width="30" height="42" className="fill-sheet" />
                {ART.map(([x, y, w, h, fill, opacity]) => (
                  <rect
                    key={`${x}-${y}-${w}`}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    opacity={opacity}
                    {...(fill.startsWith("#") ? { fill } : { className: fill })}
                  />
                ))}
              </svg>
              <ul className="pointer-events-none absolute inset-0 text-[13px] font-medium text-sheet-ink max-md:hidden">
                {CALLOUTS.map(([label, place, moment]) => (
                  <li
                    key={label}
                    style={at(moment)}
                    className={`absolute flex items-center gap-1.5 whitespace-nowrap ${place} said`}
                  >
                    <span className="flex gap-[3px]">
                      <i className="size-[5px] bg-sheet/40" />
                      <i className="size-[5px] bg-sheet/70" />
                      <i className="size-[5px] bg-sheet" />
                    </span>
                    <span className="rounded-md bg-sheet px-2 py-1 shadow-page">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* The strip above runs on into the first screen, then clears as the view pulls back. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-(--hint)">
              <PixelField shape="fall" />
            </div>
            <p className="pointer-events-none absolute inset-x-0 bottom-10 text-center text-[13px] font-medium text-sheet opacity-(--hint)">
              One pixel of your report. Keep scrolling.
            </p>
          </div>
          <div className="relative mx-auto grid w-full max-w-[1240px] gap-x-12 gap-y-4 px-6 pb-14 pt-8 md:grid-cols-[1fr_minmax(0,420px)]">
            <h2
              id="read-title"
              style={at(0.3)}
              className="said font-display text-[52px] italic leading-none tracking-[-0.02em] sm:text-[72px]"
            >
              Built to be read
            </h2>
            <div style={at(0.45)} className="said">
              <p className="text-[15px] leading-relaxed opacity-90">
                Every pixel of the report is yours: a cover, contents with page numbers, a risk
                overview and one section per finding. No watermark, and no tool name in the file.
              </p>
              <a
                href={href({ name: "projects" })}
                className="group mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4.5 text-[13.5px] font-medium text-bg transition-transform duration-(--dur-short) ease-(--ease-out) hover:-translate-y-0.5 active:translate-y-0 [&_svg]:size-4 [&_svg]:transition-transform [&_svg]:duration-(--dur-short) [&_svg]:ease-(--ease-out) hover:[&_svg]:translate-x-0.5 hover:[&_svg]:-translate-y-0.5"
              >
                Open your projects
                <ArrowUpRight />
              </a>
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
