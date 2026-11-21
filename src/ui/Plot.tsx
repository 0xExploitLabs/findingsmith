import type { CSSProperties, ReactNode } from "react";
import { cx } from "./primitives";

/** Delay and duration for one plotted stroke or one late fade, in seconds. */
function timing(delay: number, duration?: number): CSSProperties {
  return {
    "--d": `${delay}s`,
    ...(duration ? { "--t": `${duration}s` } : null),
  } as CSSProperties;
}

/** A stroke that draws itself. `d` is ordinary path data. */
export function Stroke({
  d,
  delay = 0,
  duration,
  className,
  loop,
}: {
  d: string;
  delay?: number;
  duration?: number;
  className?: string;
  /** Redraw for as long as it is shown, for a loader. */
  loop?: boolean;
}) {
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      strokeLinecap="square"
      className={cx(loop ? "plot-loop" : "plot", className)}
      style={timing(delay, duration)}
    />
  );
}

/** Something that fades in after the strokes around it have been drawn. */
export function Late({
  delay,
  duration,
  children,
}: {
  delay: number;
  duration?: number;
  children: ReactNode;
}) {
  return (
    <g className="fade-late" style={timing(delay, duration)}>
      {children}
    </g>
  );
}

/** Four print crop marks around a rectangle, drawn outwards from its corners. */
export function cropMarks(x: number, y: number, w: number, h: number, gap = 10, len = 22) {
  const r = x + w;
  const b = y + h;
  return [
    `M${x - gap} ${y}H${x - gap - len}`,
    `M${x} ${y - gap}V${y - gap - len}`,
    `M${r + gap} ${y}H${r + gap + len}`,
    `M${r} ${y - gap}V${y - gap - len}`,
    `M${x - gap} ${b}H${x - gap - len}`,
    `M${x} ${b + gap}V${b + gap + len}`,
    `M${r + gap} ${b}H${r + gap + len}`,
    `M${r} ${b + gap}V${b + gap + len}`,
  ].join("");
}

/**
 * A small sheet of paper with crop marks whose lines of text plot themselves:
 * the mark for "nothing here yet", and, looping, for "typesetting".
 */
export function SheetMark({ loop, className }: { loop?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cx("size-14 stroke-current text-ink-faint", className)}
      strokeWidth={1.25}
    >
      <Stroke d="M18 12H46V52H18Z" duration={0.7} />
      <Stroke d={cropMarks(18, 12, 28, 40, 4, 6)} delay={0.35} duration={0.4} />
      <g className="text-accent">
        <Stroke d="M23 20H35" delay={0.6} duration={0.5} loop={loop} />
      </g>
      <Stroke d="M23 27H41" delay={0.75} duration={0.5} loop={loop} />
      <Stroke d="M23 32H41" delay={0.9} duration={0.5} loop={loop} />
      <Stroke d="M23 37H37" delay={1.05} duration={0.5} loop={loop} />
      <Stroke d="M23 44H41" delay={1.2} duration={0.5} loop={loop} />
    </svg>
  );
}
