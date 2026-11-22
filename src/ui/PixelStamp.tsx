import type { ReactNode } from "react";
import { cx } from "./primitives";

/* Each glyph is drawn on an eight by eight grid. */
const GLYPHS = {
  /** The corners of a capture, around what was caught. */
  capture: [
    "##....##",
    "#......#",
    "........",
    "...##...",
    "...##...",
    "........",
    "#......#",
    "##....##",
  ],
  /** Bars that step up, the way severity does. */
  gauge: [
    "........",
    "......##",
    "......##",
    "...##.##",
    "...##.##",
    "##.##.##",
    "##.##.##",
    "##.##.##",
  ],
  /** A padlock: what is written here stays here. */
  lock: [
    "..####..",
    ".#....#.",
    ".#....#.",
    "########",
    "########",
    "###..###",
    "###..###",
    "########",
  ],
} as const;

/** Cells a side: the eight the glyph is drawn on, a margin, a rim, and room for loose pixels. */
const SIDE = 14;

export type StampGlyph = keyof typeof GLYPHS;

function hash(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * A small tile of the field's colour with a glyph cut into it, like a stamp
 * printed at very low resolution: a solid ground that is not quite flat, a
 * dithered rim, and a few pixels come loose at one corner. `seed` picks the
 * details, so tiles side by side differ. Inside a `group` it straightens and
 * lifts when that is hovered.
 */
export function PixelStamp({
  glyph,
  seed = 1,
  className,
}: {
  glyph: StampGlyph;
  seed?: number;
  className?: string;
}) {
  const rows = GLYPHS[glyph];
  const ground: ReactNode[] = [];
  const mark: ReactNode[] = [];
  const last = SIDE - 1;
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const edge = Math.min(x, y, last - x, last - y);
      const key = `${x}-${y}`;
      const roll = hash(x + seed * 13, y, 3);
      if (edge === 0) {
        // Loose pixels, gathered around one corner that the seed picks.
        const corner = [seed % 2 === 0 ? 0 : last, seed % 3 === 0 ? 0 : last];
        const near = Math.abs(x - (corner[0] ?? 0)) + Math.abs(y - (corner[1] ?? 0)) < 8;
        if (near && roll > 0.62) {
          ground.push(<rect key={key} x={x} y={y} width="1" height="1" opacity="0.34" />);
        }
      } else if (edge === 1) {
        // The rim is dithered: two quarters of each cell, corner to corner.
        ground.push(
          <path key={key} d={`M${x} ${y}h.5v.5h-.5zM${x + 0.5} ${y + 0.5}h.5v.5h-.5z`} />,
        );
      } else {
        ground.push(
          <rect
            key={key}
            x={x}
            y={y}
            width="1.02"
            height="1.02"
            opacity={roll > 0.86 ? 0.82 : undefined}
          />,
        );
        if (rows[y - 3]?.[x - 3] === "#") {
          mark.push(<rect key={key} x={x} y={y} width="1.02" height="1.02" />);
        }
      }
    }
  }
  return (
    <svg
      viewBox={`0 0 ${SIDE} ${SIDE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cx("pixel-stamp -ml-1.5 -mt-1.5 size-[84px]", className)}
    >
      <g className="fill-field">{ground}</g>
      <g className="fill-surface-1">{mark}</g>
    </svg>
  );
}
