import type { CSSProperties } from "react";
import { cropMarks, Late, Stroke } from "../../ui/Plot";

/* The plate is drawn on a 1000 by 1000 grid. Each sheet is A4, 520 wide. */
const W = 520;
const H = 735.6;
const FINDING = { x: 90, y: 60 };
const COVER = { x: 400, y: 150 };

const sheet = (o: { x: number; y: number }) => `M${o.x} ${o.y}H${o.x + W}V${o.y + H}H${o.x}Z`;
const place = (o: { x: number; y: number }, delay: number): CSSProperties =>
  ({
    left: `${o.x / 10}%`,
    top: `${o.y / 10}%`,
    width: `${W / 10}%`,
    "--d": `${delay}s`,
    "--t": "0.7s",
  }) as CSSProperties;

const label = "fill-current stroke-none font-mono text-[20px] max-sm:hidden";

/**
 * Two pages of a sample report, set up the way a printer would proof them: the
 * sheets are plotted first with their crop marks and dimensions, the rendered
 * pages develop inside them, and a red line traces the one rule the report is
 * built on, from a CVSS score to the severity printed on the page.
 */
export function ReportPlate() {
  const right = COVER.x + W;
  const bottom = COVER.y + H;
  return (
    <figure className="mx-auto w-full max-w-[560px]">
      <div className="relative aspect-square">
        <svg
          viewBox="0 0 1000 1000"
          aria-hidden="true"
          className="absolute inset-0 size-full stroke-current text-ink-faint"
          strokeWidth={1.6}
        >
          <Stroke d={sheet(FINDING)} duration={0.9} />
          <Stroke d={sheet(COVER)} delay={0.15} duration={0.9} />
          <Stroke d={cropMarks(FINDING.x, FINDING.y, W, H)} delay={0.6} duration={0.5} />
          <Stroke d={cropMarks(COVER.x, COVER.y, W, H)} delay={0.7} duration={0.5} />
          {/* Width along the bottom, height up the right-hand side. */}
          <Stroke
            d={`M${COVER.x} 918V942M${right} 918V942M${COVER.x} 930H${right}`}
            delay={0.9}
            duration={0.6}
          />
          <Stroke
            d={`M950 ${COVER.y}H974M950 ${bottom}H974M962 ${COVER.y}V${bottom}`}
            delay={1}
            duration={0.6}
          />
          <Stroke d="M300 906V954M276 930H324" delay={1.1} duration={0.4} />
          <Stroke d="M314 930A14 14 0 1 1 286 930A14 14 0 1 1 314 930" delay={1.2} duration={0.5} />
          <Late delay={1.4}>
            <text x={(COVER.x + right) / 2} y={972} textAnchor="middle" className={label}>
              210 mm
            </text>
            <text
              x={992}
              y={(COVER.y + bottom) / 2}
              textAnchor="middle"
              transform={`rotate(-90 992 ${(COVER.y + bottom) / 2})`}
              className={label}
            >
              297 mm
            </text>
            <text x={FINDING.x} y={44} className={label}>
              p. 5, a finding
            </text>
            <text x={624} y={136} className={label}>
              p. 1, the cover
            </text>
          </Late>
        </svg>

        <img
          src="/home/report-finding.webp"
          width={680}
          height={962}
          alt="A findings page: SQL injection, rated Critical with a CVSS 3.1 score of 9.8"
          className="fade-late absolute rounded-[2px] shadow-page"
          style={place(FINDING, 0.9)}
        />
        <img
          src="/home/report-cover.webp"
          width={680}
          height={962}
          alt="The cover of a penetration test report for Northwind Traders"
          fetchPriority="high"
          className="fade-late absolute rounded-[2px] shadow-page"
          style={place(COVER, 1.05)}
        />

        <svg
          viewBox="0 0 1000 1000"
          aria-hidden="true"
          className="absolute inset-0 size-full stroke-current text-sev-critical"
          strokeWidth={2.4}
        >
          <Stroke d="M150 866H52V284H126" delay={1.7} duration={1.1} />
          <Stroke d="M126 258H192V310H126Z" delay={2.7} duration={0.45} />
          <Late delay={1.7} duration={0.2}>
            <rect x={143} y={859} width={14} height={14} className="fill-current stroke-none" />
          </Late>
          <Late delay={2.9}>
            <text x={170} y={873} className={label}>
              9.8 is Critical
            </text>
          </Late>
        </svg>
      </div>
      <figcaption className="mt-2 text-center text-[12.5px] text-ink-faint">
        Two pages from a sample report, as Debrief renders them.
      </figcaption>
    </figure>
  );
}
