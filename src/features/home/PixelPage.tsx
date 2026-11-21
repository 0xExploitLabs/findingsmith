import { ArrowUpRight } from "lucide-react";
import { SEVERITY_HEX } from "../../domain/severity";
import { href } from "../../state/router";
import { useScrollProgress } from "../../ui/motion";
import { PixelField } from "../../ui/PixelField";

/* A report page at 24 by 34 pixels: a header rule, a severity block with its
   score, and lines of text. Each entry is x, y, width. */
const LINES: [number, number, number][] = [
  [3, 11, 16],
  [3, 13, 18],
  [3, 15, 12],
  [3, 19, 18],
  [3, 21, 15],
  [3, 23, 17],
  [3, 25, 9],
  [3, 29, 14],
];

const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * The page seen from inside one of its pixels: scrolling pulls back until the
 * whole report page hangs in the colour field, and then says what it is.
 */
export function PixelPage() {
  const ref = useScrollProgress<HTMLElement>((p, el) => {
    const out = ease(Math.min(1, p / 0.7));
    el.style.setProperty("--zoom", (1 + (1 - out) * 15).toFixed(3));
    el.style.setProperty("--said", Math.min(1, Math.max(0, (p - 0.68) / 0.18)).toFixed(3));
  });
  return (
    <>
      <div className="h-40">
        <PixelField shape="rise" />
      </div>
      <section
        ref={ref}
        aria-labelledby="read-title"
        className="relative h-[280vh] bg-accent text-ink-inverse"
      >
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <svg
              viewBox="0 0 24 34"
              shapeRendering="crispEdges"
              role="img"
              aria-label="A report page drawn in large pixels, with a red Critical block and lines of text"
              className="h-[min(56vh,460px)] w-auto origin-[30%_22%] scale-(--zoom)"
            >
              <rect width="24" height="34" className="fill-sheet" />
              <rect x="3" y="3" width="18" height="1" className="fill-sheet-ink opacity-25" />
              <rect x="3" y="6" width="5" height="3" fill={SEVERITY_HEX.Critical} />
              <rect x="9" y="6" width="9" height="1" className="fill-sheet-ink" />
              <rect x="9" y="8" width="6" height="1" className="fill-sheet-ink opacity-40" />
              {LINES.map(([x, y, w]) => (
                <rect
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  width={w}
                  height="1"
                  className="fill-sheet-ink opacity-30"
                />
              ))}
            </svg>
            <ul className="pointer-events-none absolute inset-0 text-[13px] font-medium text-sheet-ink opacity-(--said)">
              {[
                ["Rated Critical", "left-[calc(50%-270px)] top-[30%]"],
                ["CVSS 9.8", "left-[calc(50%+150px)] top-[26%]"],
                ["Your Markdown, typeset", "left-[calc(50%+160px)] top-[58%]"],
              ].map(([label, at]) => (
                <li
                  key={label}
                  className={`absolute rounded-md bg-sheet px-2 py-1 shadow-page max-md:hidden ${at}`}
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto grid w-full max-w-[1240px] gap-x-12 gap-y-4 px-6 pb-14 opacity-(--said) md:grid-cols-[1fr_minmax(0,420px)]">
            <h2
              id="read-title"
              className="text-[34px] font-medium leading-tight tracking-[-0.02em] sm:text-[44px]"
            >
              Built to be read
            </h2>
            <div>
              <p className="text-[15px] leading-relaxed opacity-90">
                Every pixel of the report is yours: a cover, contents with page numbers, a risk
                overview and one section per finding. No watermark, and no tool name in the file.
              </p>
              <a
                href={href({ name: "projects" })}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13.5px] font-medium text-bg transition-transform duration-(--dur-micro) hover:-translate-y-px [&_svg]:size-4"
              >
                Open your projects
                <ArrowUpRight />
              </a>
            </div>
          </div>
        </div>
      </section>
      <div className="h-40 bg-bg">
        <PixelField shape="fall" />
      </div>
    </>
  );
}
