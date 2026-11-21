import { useEffect, useRef, useState } from "react";
import { cx } from "../../ui/primitives";

const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

interface Hsv {
  h: number;
  s: number;
  v: number;
}

function toHsv(hex: string): Hsv {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function toHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

/**
 * A colour of your own for the report. The browser's picker opens wherever it
 * likes and ran off the window from this narrow panel, so this one is drawn
 * here and stays inside it: a shade square, a hue slider and the hex value.
 */
export function ColourPicker({
  value,
  active,
  onChange,
}: {
  value: string;
  /** Whether the current colour is this custom one, not one of the presets. */
  active: boolean;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => toHsv(isHex(value) ? value : "#036877"));
  const [text, setText] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  const square = useRef<HTMLDivElement>(null);

  // Follow the project's colour while closed; while open, the picker leads.
  useEffect(() => {
    if (open || !isHex(value)) return;
    setHsv(toHsv(value));
    setText(value);
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: Hsv) => {
    setHsv(next);
    const hex = toHex(next);
    setText(hex);
    onChange(hex);
  };

  const shade = (e: React.PointerEvent) => {
    const box = square.current?.getBoundingClientRect();
    if (!box) return;
    pick({
      h: hsv.h,
      s: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      v: 1 - Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    });
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Custom colour"
        aria-expanded={open}
        title="Custom colour"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex size-6 items-center justify-center rounded-full text-[11px] transition-transform hover:scale-110",
          active
            ? "border-2 border-ink"
            : "border border-dashed border-line-strong text-ink-faint hover:text-ink",
        )}
        style={active ? { background: value } : undefined}
      >
        {active ? null : "+"}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Custom colour"
          className="absolute right-0 top-8 z-20 w-[216px] animate-in rounded-xl border border-line-strong bg-surface-2 p-3 shadow-pop"
        >
          <div
            ref={square}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              shade(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons) shade(e);
            }}
            className="relative h-[120px] cursor-crosshair touch-none rounded-lg"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
            }}
          >
            <span
              className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                background: toHex(hsv),
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={359}
            value={Math.round(hsv.h)}
            onChange={(e) => pick({ ...hsv, h: Number(e.target.value) })}
            aria-label="Hue"
            className="hue-slider mt-3 block w-full"
          />
          <div className="mt-3 flex items-center gap-2">
            <span
              className="size-8 shrink-0 rounded-lg border border-line-strong"
              style={{ background: toHex(hsv) }}
            />
            <input
              value={text}
              onChange={(e) => {
                const next = e.target.value.trim();
                setText(next);
                const hex = next.startsWith("#") ? next : `#${next}`;
                if (isHex(hex)) {
                  setHsv(toHsv(hex));
                  onChange(hex.toLowerCase());
                }
              }}
              aria-label="Hex colour"
              spellCheck={false}
              autoComplete="off"
              maxLength={7}
              className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-1 px-2.5 font-mono text-[12.5px] uppercase text-ink outline-none hover:border-line-hover focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
