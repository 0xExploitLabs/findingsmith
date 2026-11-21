import { RotateCcw } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { useScheme } from "../../state/scheme";
import { cropMarks, Late, Stroke } from "../../ui/Plot";

/* The stage is drawn on a 1240 by 680 grid: the editor on the left, the page
   it becomes on the right, and the lines between them. */
const EDITOR = { x: 10, y: 40, w: 463, h: 600 };
const PAGE = { x: 780, y: 40, w: 424, h: 600 };

type Box = typeof EDITOR;
const outline = (b: Box) => `M${b.x} ${b.y}H${b.x + b.w}V${b.y + b.h}H${b.x}Z`;
const place = (b: Box, delay: number, duration: number): CSSProperties =>
  ({
    left: `${(b.x / 1240) * 100}%`,
    top: `${(b.y / 680) * 100}%`,
    width: `${(b.w / 1240) * 100}%`,
    "--d": `${delay}s`,
    "--t": `${duration}s`,
  }) as CSSProperties;

const note = "fill-current stroke-none font-mono text-[14px]";

const STEPS = [
  {
    at: 0.3,
    title: "Write the finding",
    text: "One Markdown document, with screenshots and HTTP requests pasted straight in.",
  },
  {
    at: 3.4,
    title: "Paste the CVSS vector",
    text: "Severity follows the score, so a 9.8 is Critical and a 5.3 is always Medium.",
  },
  {
    at: 4.6,
    title: "Download the PDF",
    text: "Typeset in this browser, with a cover and contents: no account, no server.",
  },
];

/**
 * How a report is made, shown with the real thing: a capture of the editor
 * writes itself in, the page is plotted and develops beside it, and lines
 * trace what the editor holds to where it lands in the PDF.
 */
export function CreationStage() {
  const scheme = useScheme();
  const [run, setRun] = useState(0);
  return (
    <section aria-labelledby="creation-title">
      <div className="flex items-end justify-between gap-4">
        <h2 id="creation-title" className="text-[22px] font-semibold tracking-[-0.02em]">
          From a finding to the finished page
        </h2>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-muted transition-colors duration-(--dur-micro) hover:bg-hover hover:text-ink max-md:hidden [&_svg]:size-3.5"
        >
          <RotateCcw />
          Play again
        </button>
      </div>

      {/* Phones get the two captures, stacked and still. */}
      <div className="mt-6 space-y-4 md:hidden">
        <img
          src={`/home/editor-${scheme}.webp`}
          width={926}
          height={1199}
          alt="The Debrief editor with a SQL injection finding rated Critical"
          className="w-full rounded-lg border border-line"
        />
        <img
          src="/home/report-finding.webp"
          width={680}
          height={962}
          alt="The same finding as a page of the PDF report"
          className="w-full rounded-[2px] shadow-page"
        />
      </div>

      <div key={run} className="relative mt-6 aspect-[1240/680] max-md:hidden">
        <svg
          viewBox="0 0 1240 680"
          aria-hidden="true"
          className="absolute inset-0 size-full stroke-current text-ink-faint"
          strokeWidth={1.2}
        >
          <Stroke d={outline(EDITOR)} duration={0.8} />
          <Stroke d={outline(PAGE)} delay={1.5} duration={0.8} />
          <Stroke d={cropMarks(PAGE.x, PAGE.y, PAGE.w, PAGE.h, 8, 20)} delay={2} duration={0.5} />
        </svg>

        <img
          src={`/home/editor-${scheme}.webp`}
          width={926}
          height={1199}
          alt="The Debrief editor with a SQL injection finding rated Critical"
          className="write-in absolute rounded-lg border border-line"
          style={place(EDITOR, 0.4, 1.5)}
        />
        <img
          src="/home/report-finding.webp"
          width={680}
          height={962}
          alt="The same finding as a page of the PDF report"
          className="fade-late absolute rounded-[2px] shadow-page"
          style={place(PAGE, 2.2, 0.7)}
        />

        <svg
          viewBox="0 0 1240 680"
          aria-hidden="true"
          className="absolute inset-0 size-full stroke-current text-ink-muted"
          strokeWidth={1.4}
        >
          <Stroke d="M206 116H604V188H810" delay={2.8} duration={0.8} />
          <Stroke d="M134 313H524V286H810" delay={3.1} duration={0.8} />
          <Late delay={3.5}>
            <rect x={806} y={184} width={8} height={8} className="fill-current stroke-none" />
            <rect x={806} y={282} width={8} height={8} className="fill-current stroke-none" />
            <text x={616} y={178} className={note}>
              the title
            </text>
            <text x={536} y={306} className={note}>
              your Markdown, typeset
            </text>
          </Late>
          <g className="text-sev-critical" strokeWidth={2}>
            <Stroke d="M430 206H564V226H810" delay={3.7} duration={0.9} />
            <Stroke d="M814 208H868V246H814Z" delay={4.6} duration={0.4} />
            <Late delay={4.7}>
              <text x={576} y={246} className={note}>
                9.8 is Critical
              </text>
            </Late>
          </g>
        </svg>
      </div>

      <ol
        key={`steps-${run}`}
        className="mt-8 grid gap-x-10 gap-y-6 border-t border-line pt-6 md:grid-cols-3"
      >
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="fade-late grid grid-cols-[2rem_minmax(0,1fr)]"
            style={{ "--d": `${step.at}s` } as CSSProperties}
          >
            <span className="font-mono text-[13px] tabular-nums text-ink-faint">{i + 1}</span>
            <div>
              <h3 className="text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
