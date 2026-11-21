import { useEffect, useRef } from "react";
import { useScheme } from "../state/scheme";
import { cx } from "./primitives";

/** Where the field is dense: around the edges, or fading out downwards or upwards. */
export type FieldShape = "frame" | "fall" | "rise";

/* Value noise on an integer lattice, smoothed between points. */
function hash(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const plane = (k: number) =>
    mix(
      mix(hash(xi, yi, k), hash(xi + 1, yi, k), xf),
      mix(hash(xi, yi + 1, k), hash(xi + 1, yi + 1, k), xf),
      yf,
    );
  return mix(plane(zi), plane(zi + 1), zf);
}

/** How strongly a cell is inked, 0 to 1, before the noise is added. */
function density(shape: FieldShape, u: number, v: number): number {
  if (shape === "fall") return 1 - v;
  if (shape === "rise") return v;
  const dx = (u - 0.5) / 0.5;
  const dy = (v - 0.5) / 0.5;
  return Math.min(1, Math.sqrt(dx * dx * 0.55 + dy * dy));
}

/**
 * A slow field of large pixels in the accent colour, in three strengths, like
 * weather seen at very low resolution. One small canvas, scaled up unsmoothed.
 */
export function PixelField({
  shape,
  cell = 22,
  className,
}: {
  shape: FieldShape;
  /** The size of one pixel on screen. */
  cell?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scheme = useScheme();

  // biome-ignore lint/correctness/useExhaustiveDependencies: the accent colour is re-read when the scheme changes
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rgb = getComputedStyle(canvas)
      .getPropertyValue("--brand-accent")
      .trim()
      .split(/\s+/)
      .map(Number);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = 0;
    let visible = true;

    const draw = (time: number) => {
      const cols = Math.max(1, Math.ceil(canvas.clientWidth / cell));
      const rows = Math.max(1, Math.ceil(canvas.clientHeight / cell));
      if (canvas.width !== cols || canvas.height !== rows) {
        canvas.width = cols;
        canvas.height = rows;
      }
      const image = ctx.createImageData(cols, rows);
      const t = time / 9000;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const n =
            noise(x * 0.11 + t, y * 0.16, t * 1.7) * 0.7 +
            noise(x * 0.31, y * 0.37 - t, t * 3) * 0.3;
          const value = density(shape, x / cols, y / rows) * 1.15 + (n - 0.5) * 1.1;
          const alpha = value > 0.92 ? 255 : value > 0.78 ? 150 : value > 0.66 ? 70 : 0;
          const i = (y * cols + x) * 4;
          image.data[i] = rgb[0] ?? 0;
          image.data[i + 1] = rgb[1] ?? 0;
          image.data[i + 2] = rgb[2] ?? 0;
          image.data[i + 3] = alpha;
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || time - last < 90) return;
      last = time;
      draw(time);
    };
    draw(0);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    seen.observe(canvas);
    const resized = new ResizeObserver(() => draw(last));
    resized.observe(canvas);
    if (!still) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      resized.disconnect();
    };
  }, [shape, cell, scheme]);

  return (
    <div aria-hidden="true" className={cx("size-full", className)}>
      <canvas ref={ref} className="pixelated block size-full" />
    </div>
  );
}
