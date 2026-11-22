import { type CSSProperties, useEffect, useId, useRef } from "react";
import { APP_NAME, ORG_NAME } from "../brand";
import cicada from "../cicada.svg?raw";
import { cx } from "./primitives";

const SHAPE = /\sd="([^"]+)"/.exec(cicada)?.[1] ?? "";
const SHAPE_ID = "cicada-shape";
const VIEW = { width: 1958, height: 690 };

/* Where each wing meets the body, in the drawing's units: its narrowest point.
   A wing is everything beyond that line, and the line is what it turns on. */
const HINGE = { left: 812, right: 1118 };
const percent = (x: number) => `${((x / VIEW.width) * 100).toFixed(3)}%`;

/* The three parts are the same drawing, each showing its own side of a hinge.
   The body reaches a little under both wings, so no seam shows between them. */
const PARTS = [
  {
    name: "left",
    clip: `inset(0 calc(100% - ${percent(HINGE.left)}) 0 0)`,
    hinge: percent(HINGE.left),
    side: 1,
  },
  {
    name: "body",
    clip: `inset(0 calc(100% - ${percent(HINGE.right + 3)}) 0 ${percent(HINGE.left - 3)})`,
    hinge: "50%",
    side: 0,
  },
  {
    name: "right",
    clip: `inset(0 0 0 ${percent(HINGE.right)})`,
    hinge: percent(HINGE.right),
    side: -1,
  },
] as const;

/** The drawing is long, so the document holds it once and every cicada points at it. */
function shareShape() {
  if (typeof document === "undefined" || document.getElementById(SHAPE_ID)) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<svg aria-hidden="true" width="0" height="0" style="position:absolute"><defs><path id="${SHAPE_ID}" fill-rule="evenodd" d="${SHAPE}"/></defs></svg>`,
  );
}

shareShape();

/** How long one beat of the wings takes, in milliseconds, and how many a greeting has. */
const BEAT = 620;
const BEATS = 2;

/**
 * The founder-drawn cicada, coloured by `currentColor`; `hatch` fills it with
 * ruled lines. Its wings are hinged at the body and can beat like a
 * butterfly's: "greet" beats them once when it appears and again whenever the
 * link around it is hovered or focused, and "idle" beats them slowly for as
 * long as an ancestor carries `data-live`, folded by that ancestor's `--fold`
 * (0 open, 1 closed). Still under reduced motion.
 */
export function Cicada({
  className,
  hatch,
  flap,
}: {
  className?: string;
  hatch?: boolean;
  flap?: "greet" | "idle";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const pattern = `hatch-${useId().replace(/[^a-z0-9]/gi, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || flap !== "greet" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const beat = () => {
      if (el.dataset.beat) return;
      el.dataset.beat = "on";
      timer = window.setTimeout(() => delete el.dataset.beat, BEAT * BEATS + 40);
    };
    const hello = window.setTimeout(beat, 700);
    const host = el.closest("a, button") ?? el;
    host.addEventListener("pointerenter", beat);
    host.addEventListener("focus", beat);
    return () => {
      clearTimeout(hello);
      clearTimeout(timer);
      delete el.dataset.beat;
      host.removeEventListener("pointerenter", beat);
      host.removeEventListener("focus", beat);
    };
  }, [flap]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-flap={flap}
      className={cx("cicada relative inline-block aspect-[1958/690]", className)}
      style={{ "--beat": `${BEAT}ms`, "--beats": BEATS } as CSSProperties}
    >
      {PARTS.map((part) => (
        <span
          key={part.name}
          className="cicada-fold absolute inset-0"
          style={{ "--hinge": part.hinge, "--side": part.side } as CSSProperties}
        >
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            className={cx("absolute inset-0 size-full", part.side !== 0 && "cicada-wing")}
            data-side={part.name}
            style={{ clipPath: part.clip }}
          >
            {hatch && part.name === "left" ? (
              <defs>
                <pattern
                  id={pattern}
                  width="14"
                  height="14"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(-38)"
                >
                  <rect width="14" height="5" fill="currentColor" />
                </pattern>
              </defs>
            ) : null}
            <use href={`#${SHAPE_ID}`} fill={hatch ? `url(#${pattern})` : "currentColor"} />
          </svg>
        </span>
      ))}
    </span>
  );
}

export function Wordmark({
  compact,
  flap,
  className,
}: {
  compact?: boolean;
  /** The mark greets: its wings beat once on arrival and on hover. */
  flap?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <Cicada
        flap={flap ? "greet" : undefined}
        className={cx("text-ink", compact ? "h-[11px]" : "h-[14px]")}
      />
      <span
        className={cx(
          "font-semibold tracking-[-0.015em] text-ink",
          compact ? "text-[13px]" : "text-[15px]",
        )}
      >
        {APP_NAME}
      </span>
      {compact ? null : (
        <span className="whitespace-nowrap text-[12.5px] text-ink-faint">
          by <span className="[font-feature-settings:'zero'] text-ink-muted">{ORG_NAME}</span>
        </span>
      )}
    </span>
  );
}
