import { type RefObject, useEffect, useRef } from "react";
import { useScheme } from "../state/scheme";
import { cx } from "./primitives";
import { reducedMotion } from "./scroll";

/**
 * Where the field is dense: "cloud" gathers in uneven masses around whatever
 * it is told to keep clear; "fall" and "rise" are solid at one edge and break
 * up towards the other.
 */
export type FieldShape = "cloud" | "fall" | "rise";

declare global {
  interface Window {
    /** A fixed seed for the fields, so a screenshot or a test sees the same cloud twice. */
    __fieldSeed?: number;
  }
}

/* Every load draws its own clouds: one seed for the page, read once. */
let loadSeed: number | null = null;
function pageSeed(): number {
  loadSeed ??= window.__fieldSeed ?? Math.floor(Math.random() * 2 ** 31);
  return loadSeed;
}

/* Value noise on an integer lattice, smoothed between points. */
function hash(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function noise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);
  const plane = (k: number) =>
    mix(
      mix(hash(xi, yi, k), hash(xi + 1, yi, k), xf),
      mix(hash(xi, yi + 1, k), hash(xi + 1, yi + 1, k), xf),
      yf,
    );
  return mix(plane(zi), plane(zi + 1), zf);
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (lo: number, hi: number, x: number) => fade(clamp((x - lo) / (hi - lo)));

/** A seeded stream of numbers from 0 to 1, for laying a cloud out. */
function stream(seed: number) {
  let n = 0;
  return () => hash(seed, n++, 77);
}

interface Mass {
  x: number;
  y: number;
  rx: number;
  ry: number;
  weight: number;
}

/**
 * The cloud's masses, in cells: lumps of different sizes scattered along the
 * edges of the field, more of them on some sides than others, so no two loads
 * frame the page the same way and none of them is symmetric.
 */
function scatter(seed: number, cols: number, rows: number): Mass[] {
  const next = stream(seed);
  const masses: Mass[] = [];
  // One side is favoured and one neglected, which is what makes it lopsided.
  const favour = [0.6 + next() * 0.9, 0.6 + next() * 0.9, 0.6 + next() * 0.9, 0.6 + next() * 0.9];
  const total = favour.reduce((a, b) => a + b, 0);
  const count = Math.round(7 + next() * 4);
  for (let i = 0; i < count; i++) {
    let pick = next() * total;
    let side = 0;
    while (side < 3 && pick > (favour[side] ?? 0)) pick -= favour[side++] ?? 0;
    const along = next();
    const depth = next() ** 1.6 * 0.3;
    const horizontal = side < 2;
    const x = horizontal ? along : side === 2 ? depth : 1 - depth;
    const y = horizontal ? (side === 0 ? depth : 1 - depth) : along;
    const big = next() ** 1.4;
    masses.push({
      x: x * cols,
      y: y * rows,
      rx: (0.08 + big * 0.2) * cols * (horizontal ? 1.3 : 0.8),
      ry: (0.1 + big * 0.2) * rows * (horizontal ? 0.8 : 1.3),
      weight: 0.4 + next() * 0.5,
    });
  }
  return masses;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An element's box as laid out inside `root`, whatever transforms it wears. */
function layoutBox(el: HTMLElement, root: Element | null): Box {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** How far a point is from a box, in pixels; negative inside it. */
function distance(px: number, py: number, b: Box): number {
  const dx = Math.abs(px - (b.x + b.w / 2)) - b.w / 2;
  const dy = Math.abs(py - (b.y + b.h / 2)) - b.h / 2;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}

/** How far the pointer's wake reaches, in screen pixels. */
const REACH = 150;

/* What a cell is drawn with, from nothing to solid. The two dithers are
   checkerboards of the field's colour, fine enough to read as a tone. */
const NONE = 0;
const SPARSE = 1;
const DITHER = 2;
const LIGHT = 3;
const MID = 4;
const SOLID = 5;
const ALPHA = [0, 1, 1, 0.34, 0.62, 1];

/**
 * A slow field of pixels in one colour, like weather seen at very low
 * resolution: blocks of several sizes, flat tones next to dithered ones, and
 * loose single pixels where it thins out. It drifts on its own, re-dithers
 * now and then, slides a little as the page scrolls, and parts gently around
 * the pointer. As a "cloud" it is laid out afresh on every load, and whatever
 * `clear` holds is always left untouched.
 */
export function PixelField({
  shape,
  cell = 22,
  tone = "accent",
  still = false,
  clear,
  tail = 0,
  plain = false,
  className,
}: {
  shape: FieldShape;
  /** The size of one pixel on screen. */
  cell?: number;
  /** "accent" on the page colour; "inverse" is a faint texture on an accent ground. */
  tone?: "accent" | "inverse";
  /** Drawn once and left alone: a texture behind a page that is being worked on. */
  still?: boolean;
  /** A cloud keeps this element's children clear: the words it gathers around. */
  clear?: RefObject<HTMLElement | null>;
  /** A cloud thins out over this many pixels at its foot, into the page below. */
  tail?: number;
  /** Three flat tones and nothing else: no dither, no blocks, the same on every load. */
  plain?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scheme = useScheme();

  // biome-ignore lint/correctness/useExhaustiveDependencies: the colour is re-read when the scheme changes
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const css = getComputedStyle(canvas);
    const triplet = (name: string) => css.getPropertyValue(name).trim().split(/\s+/).map(Number);
    const rgb = triplet(tone === "accent" ? "--brand-field" : "--brand-ink-inverse");
    const sink = triplet("--brand-on-field");
    const strength = tone === "accent" ? 1 : 0.16;
    const frozen = still || reducedMotion();
    const seed = plain ? 0 : pageSeed() + (shape === "cloud" ? 0 : shape === "fall" ? 101 : 211);
    const colour = (towards: number[], amount: number, alpha: number) =>
      `rgb(${rgb.map((c, i) => Math.round(c + ((towards[i] ?? c) - c) * amount)).join(" ")} / ${alpha * strength})`;
    const flat = {
      [LIGHT]: colour(rgb, 0, ALPHA[LIGHT] ?? 1),
      [MID]: colour(rgb, 0, ALPHA[MID] ?? 1),
      [SOLID]: colour(rgb, 0, 1),
      lift: colour([255, 255, 255], 0.1, 1),
      deep: colour(sink, 0.07, 1),
    };

    // Geometry, rebuilt when the canvas changes size.
    let size = cell;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    /** Each cell's share of the masses, read where its block is sampled. */
    let base = new Float32Array(0);
    /** How much of the field each cell may keep: 0 inside the clearing. */
    let room = new Float32Array(0);
    /** The cell that speaks for each cell's block, as an index. */
    let from = new Int32Array(0);
    /** Each cell's strength this frame, before the clearing is cut from it. */
    let value = new Float32Array(0);
    let checker: CanvasPattern | null = null;
    let sparse: CanvasPattern | null = null;

    const pattern = (on: number[]): CanvasPattern | null => {
      // Two CSS pixels to a square: a tone from afar, a texture up close.
      const unit = Math.max(1, Math.round(2 * dpr));
      const tile = document.createElement("canvas");
      tile.width = tile.height = unit * 2;
      const t = tile.getContext("2d");
      if (!t) return null;
      t.fillStyle = flat[SOLID];
      for (const i of on) t.fillRect((i % 2) * unit, Math.floor(i / 2) * unit, unit, unit);
      return ctx.createPattern(tile, "repeat");
    };

    const layout = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      // Smaller pixels on a phone, so the field keeps its grain.
      size = width < 700 ? Math.round(cell * 0.68) : cell;
      cols = Math.ceil(width / size);
      rows = Math.ceil(height / size);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      checker = pattern([0, 3]);
      sparse = pattern([0]);

      const count = cols * rows;
      base = new Float32Array(count);
      room = new Float32Array(count).fill(1);
      from = new Int32Array(count);
      value = new Float32Array(count);
      const masses = shape === "cloud" ? scatter(seed, cols, rows) : [];
      const foot = rows - tail / size;
      const massAt = (x: number, y: number) => {
        if (plain) return 1.15 * (shape === "fall" ? 1 - y / rows : y / rows) ** 1.15;
        if (shape === "fall") return 1.7 * (1 - y / rows) ** 1.35;
        if (shape === "rise") return 1.7 * (y / rows) ** 1.35;
        let sum = 0;
        for (const m of masses) {
          const dx = (x - m.x) / m.rx;
          const dy = (y - m.y) / m.ry;
          sum += m.weight * Math.exp(-(dx * dx + dy * dy));
        }
        // The cloud always closes over the foot of its screen, then lets go below it.
        const floor = smooth(foot - rows * 0.22, foot, y) * 0.62;
        const edge = Math.min(x, cols - x, y) / Math.min(cols, rows);
        return 0.3 + sum * 0.8 + floor + smooth(0.14, 0, edge) * 0.2;
      };

      // What stays clear, in pixels: the boxes of the words the cloud gathers around.
      const boxes: Box[] = [];
      if (shape === "cloud" && clear?.current) {
        const root = canvas.offsetParent;
        const self = layoutBox(canvas, root);
        for (const child of clear.current.children) {
          if (!(child instanceof HTMLElement) || !child.offsetWidth) continue;
          const b = layoutBox(child, root);
          boxes.push({ x: b.x - self.x, y: b.y - self.y, w: b.w, h: b.h });
        }
      }
      const reach = size * (width < 700 ? 4.5 : 7);
      const guard = size * (width < 700 ? 0.55 : 0.9);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          // Patches of the field are drawn in blocks two or four cells wide.
          const patch = hash(Math.floor(x / 8) + seed, Math.floor(y / 8), 5);
          const step = shape === "cloud" ? (patch < 0.24 ? 4 : patch < 0.62 ? 2 : 1) : 1;
          const bx = Math.min(cols - 1, Math.floor(x / step) * step);
          const by = Math.min(rows - 1, Math.floor(y / step) * step);
          from[i] = by * cols + bx;
          base[i] = massAt(bx + step / 2, by + step / 2);
          if (shape === "cloud" && y > foot) {
            base[i] = (base[i] ?? 0) * (1 - ((y - foot) / (rows - foot)) ** 1.2);
          }
          if (boxes.length > 0) {
            const px = (x + 0.5) * size;
            const py = (y + 0.5) * size;
            let d = Number.POSITIVE_INFINITY;
            for (const b of boxes) d = Math.min(d, distance(px, py, b));
            // The clearing's edge wanders, so it reads as a gap in weather, not a frame.
            const wander =
              (noise(x * 0.075 + seed, y * 0.09, 3) - 0.5) * reach * 1.7 +
              (noise(x * 0.24, y * 0.27 + seed, 6) - 0.5) * reach * 0.6;
            room[i] = d < guard ? 0 : smooth(guard, reach, d + wander);
          }
        }
      }
      return true;
    };

    let frame = 0;
    let last = 0;
    let visible = true;
    let top = 0;
    // The pointer as the field feels it: it trails the real one and fades in and out.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, power: 0, target: 0 };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = time / 11000;
      const drift = top / 900;
      const blink = Math.floor(time / 720);
      const turn = Math.floor(time / 2600);
      const twinkle = Math.floor(time / 1500);
      const px = (n: number) => Math.round(n * size * dpr);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const n =
            noise(x * 0.11 + t + seed, y * 0.16 + drift, t * 1.7) * 0.62 +
            noise(x * 0.31, y * 0.37 - t + drift * 2 + seed, t * 3) * 0.28 +
            noise(x * 0.83 - t * 2, y * 0.79, t * 4) * 0.1;
          value[i] = (base[i] ?? 0) + (n - 0.5) * (plain ? 1.1 : 1.9);
        }
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const keep = room[i] ?? 1;
          if (keep === 0) continue;
          // A block speaks with one voice; the clearing is cut cell by cell.
          let v = (value[from[i] ?? i] ?? 0) * keep - (1 - keep) * 0.3;
          if (pointer.power > 0.01) {
            const d =
              Math.hypot((x + 0.5) * size - pointer.x, (y + 0.5) * size - pointer.y) / REACH;
            v +=
              pointer.power * (0.3 * Math.exp(-((d - 1) ** 2) * 7) - 0.62 * Math.exp(-d * d * 2.4));
          }
          if (plain) {
            // The quiet field: solid, half and faint, with a loose pixel here and there.
            const alpha =
              v > 0.92
                ? 1
                : v > 0.78
                  ? 0.59
                  : v > 0.66
                    ? 0.27
                    : (base[i] ?? 0) > 0.14 && v > 0.4 && hash(x, y, blink) > 0.93
                      ? 0.18
                      : 0;
            if (alpha > 0) {
              ctx.fillStyle = colour(rgb, 0, alpha);
              ctx.fillRect(px(x), px(y), px(x + 1) - px(x), px(y + 1) - px(y));
            }
            continue;
          }
          let level =
            v > 0.94
              ? SOLID
              : v > 0.8
                ? MID
                : v > 0.68
                  ? LIGHT
                  : v > 0.58
                    ? DITHER
                    : v > 0.5
                      ? SPARSE
                      : NONE;
          // Flat tones and dithered ones trade places in slow patches, and a
          // few cells change their mind every couple of seconds.
          const weave = noise(x * 0.09 - t * 0.6 + seed, y * 0.11 + t * 0.4, t);
          const fickle = hash(x, y, turn) > 0.94;
          if (level === MID && (weave > 0.6 || fickle)) level = DITHER;
          else if (level === LIGHT && (weave < 0.36 || fickle)) level = SPARSE;
          const x0 = px(x);
          const y0 = px(y);
          const w = px(x + 1) - x0;
          const h = px(y + 1) - y0;
          if (level === NONE) {
            // Loose pixels flicker where the field is thinning out: whole ones and half ones.
            if (v > 0.26 && keep > 0.5 && hash(x, y, blink) > 0.965) {
              const half = hash(x, y, 9) > 0.5;
              ctx.fillStyle = hash(x, y, 4) > 0.5 ? flat[LIGHT] : flat[MID];
              if (half)
                ctx.fillRect(x0 + Math.round(w / 4), y0 + Math.round(h / 4), w >> 1, h >> 1);
              else ctx.fillRect(x0, y0, w, h);
            }
            continue;
          }
          if (level === SOLID) {
            // Solid parts breathe too: a step lighter or deeper passes through them.
            ctx.fillStyle =
              tone === "accent" && hash(x, y, twinkle) > 0.997
                ? flat.lift
                : tone === "accent" && weave > 0.72
                  ? flat.lift
                  : tone === "accent" && weave < 0.24
                    ? flat.deep
                    : flat[SOLID];
          } else if (level === DITHER) ctx.fillStyle = checker ?? flat[MID];
          else if (level === SPARSE) ctx.fillStyle = sparse ?? flat[LIGHT];
          else ctx.fillStyle = level === MID ? flat[MID] : flat[LIGHT];
          ctx.fillRect(x0, y0, w, h);
        }
      }
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      // The field changes a cell at a time, so a few frames a second carry its
      // drift; it only needs to be quick while it is following the pointer.
      const busy = pointer.target > 0 || pointer.power > 0.02;
      if (!visible || time - last < (busy ? 40 : 110)) return;
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

    const relay = () => {
      if (layout()) draw(last);
    };
    relay();
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    seen.observe(canvas);
    const resized = new ResizeObserver(relay);
    resized.observe(canvas);
    // The words settle once their fonts arrive, and the clearing follows them.
    for (const child of clear?.current?.children ?? []) resized.observe(child);
    if (!frozen) {
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
  }, [shape, cell, tone, still, clear, tail, plain, scheme]);

  return (
    <div aria-hidden="true" className={cx("size-full", className)}>
      <canvas ref={ref} className="block size-full" />
    </div>
  );
}
