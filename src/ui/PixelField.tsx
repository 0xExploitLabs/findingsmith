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

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const smooth = (a: number, b: number, x: number) => fade(clamp((x - a) / (b - a), 0, 1));

/**
 * How strongly a cell is inked, 0 to about 1.4, before the noise is added.
 * The frame keeps a rounded clearing in its middle, sized in pixels so the
 * headline it surrounds stays readable at any width, and thins out along its
 * bottom edge so it dissolves into the page instead of ending in a line.
 */
function density(shape: FieldShape, u: number, v: number, width: number, height: number): number {
  if (shape === "fall") return (1 - v) ** 1.15;
  if (shape === "rise") return v ** 1.15;
  const holeW = width < 700 ? width * 1.25 : Math.min(width * 0.9, 1200);
  const holeH = width < 700 ? 390 : clamp(height * 0.58, 360, 500);
  const dx = Math.abs(u - 0.5) / (holeW / width / 2);
  const dy = Math.abs(v - 0.52) / (holeH / height / 2);
  const d = Math.cbrt(dx ** 3 + dy ** 3);
  // A narrow screen has few columns, so the edge ramps more gently and stays ragged.
  return clamp((d - 0.86) * (width < 700 ? 1.25 : 1.9), 0, 1.4) * (1 - smooth(0.84, 1, v));
}

/** How far the pointer's wake reaches, in screen pixels. */
const REACH = 150;

/**
 * A slow field of large pixels, in a few strengths of one colour, like weather
 * seen at very low resolution. It drifts on its own, slides a little as the
 * page scrolls, and parts around the pointer, which leaves a ring behind it.
 * One small canvas, scaled up unsmoothed.
 */
export function PixelField({
  shape,
  cell = 22,
  tone = "accent",
  className,
}: {
  shape: FieldShape;
  /** The size of one pixel on screen. */
  cell?: number;
  /** "accent" on the page colour; "inverse" is a faint texture on an accent ground. */
  tone?: "accent" | "inverse";
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scheme = useScheme();

  // biome-ignore lint/correctness/useExhaustiveDependencies: the colour is re-read when the scheme changes
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rgb = getComputedStyle(canvas)
      .getPropertyValue(tone === "accent" ? "--brand-accent" : "--brand-ink-inverse")
      .trim()
      .split(/\s+/)
      .map(Number);
    const strength = tone === "accent" ? 1 : 0.2;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = 0;
    let visible = true;
    let top = 0;
    // The pointer as the field feels it: it trails the real one and fades in and out.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, power: 0, target: 0 };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      // Smaller pixels on a phone, so the field keeps its grain.
      const size = width < 700 ? Math.round(cell * 0.68) : cell;
      const cols = Math.max(1, Math.ceil(width / size));
      const rows = Math.max(1, Math.ceil(height / size));
      if (canvas.width !== cols || canvas.height !== rows) {
        canvas.width = cols;
        canvas.height = rows;
      }
      const image = ctx.createImageData(cols, rows);
      const t = time / 9000;
      const drift = top / 900;
      const blink = Math.floor(time / 640);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const n =
            noise(x * 0.11 + t, y * 0.16 + drift, t * 1.7) * 0.62 +
            noise(x * 0.31, y * 0.37 - t + drift * 2, t * 3) * 0.28 +
            noise(x * 0.83 - t * 2, y * 0.79, t * 4) * 0.1;
          const base = density(shape, (x + 0.5) / cols, (y + 0.5) / rows, width, height);
          let value = base * 1.15 + (n - 0.5) * 1.1;
          if (pointer.power > 0.01) {
            const d =
              Math.hypot((x + 0.5) * size - pointer.x, (y + 0.5) * size - pointer.y) / REACH;
            value += pointer.power * (0.5 * Math.exp(-((d - 1) ** 2) * 7) - Math.exp(-d * d * 2.4));
          }
          let alpha = value > 0.92 ? 255 : value > 0.78 ? 150 : value > 0.66 ? 70 : 0;
          // Loose pixels flicker at the field's edge, where it is thinning out.
          if (!alpha && base > 0.12 && value > 0.4 && hash(x, y, blink) > 0.93) alpha = 46;
          const i = (y * cols + x) * 4;
          image.data[i] = rgb[0] ?? 0;
          image.data[i + 1] = rgb[1] ?? 0;
          image.data[i + 2] = rgb[2] ?? 0;
          image.data[i + 3] = alpha * strength;
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || time - last < 40) return;
      last = time;
      top = canvas.getBoundingClientRect().top;
      pointer.x += (pointer.tx - pointer.x) * 0.16;
      pointer.y += (pointer.ty - pointer.y) * 0.16;
      pointer.power += (pointer.target - pointer.power) * 0.08;
      draw(time);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top - REACH &&
        e.clientY <= rect.bottom + REACH;
      pointer.target = inside ? 1 : 0;
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
      if (pointer.power < 0.02) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
    };
    const onLeave = () => {
      pointer.target = 0;
    };

    draw(0);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    seen.observe(canvas);
    const resized = new ResizeObserver(() => draw(last));
    resized.observe(canvas);
    if (!still) {
      frame = requestAnimationFrame(tick);
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      resized.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [shape, cell, tone, scheme]);

  return (
    <div aria-hidden="true" className={cx("size-full", className)}>
      <canvas ref={ref} className="pixelated block size-full" />
    </div>
  );
}
