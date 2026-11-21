import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { cx } from "./primitives";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How long the first phrase is held, and how long its words take to fold away. */
const HOLD = 2600;
const FOLD = 420;
const STAGGER = 70;

/**
 * A headline whose words each arrive through a pixel block. Given two
 * phrases, it shows the first, folds its words back into their pixels, then
 * brings in the second, word by word.
 */
export function SwapHeadline({
  first,
  then,
  className,
}: {
  /** Each phrase is a list of lines. */
  first: string[];
  then: string[];
  className?: string;
}) {
  const [phrase, setPhrase] = useState(first);
  const [leaving, setLeaving] = useState(false);
  // The phrases are compared by their text, so a parent re-rendering with equal
  // arrays never restarts the swap.
  const words = first.join(" ").split(" ").length;
  const next = then.join("\n");
  useEffect(() => {
    const last = next.split("\n");
    if (reduced()) {
      setPhrase(last);
      return;
    }
    const fold = setTimeout(() => setLeaving(true), HOLD);
    const swap = setTimeout(
      () => {
        setPhrase(last);
        setLeaving(false);
      },
      HOLD + FOLD + (words - 1) * STAGGER,
    );
    return () => {
      clearTimeout(fold);
      clearTimeout(swap);
    };
  }, [next, words]);
  let index = 0;
  return (
    <h1 className={className} aria-label={then.join(" ")}>
      <span key={phrase.join("|")} aria-hidden="true" data-leaving={leaving || undefined}>
        {phrase.map((line) => (
          <span key={line} className="block">
            {line.split(" ").map((word) => (
              <span
                key={`${word}-${index}`}
                className="swap-word mr-[0.22em] last:mr-0"
                style={{ "--i": index++ } as CSSProperties}
              >
                <span className="pixel" />
                <span className="text">{word}</span>
              </span>
            ))}
          </span>
        ))}
      </span>
    </h1>
  );
}

/** Flies its content up into place the first time it scrolls into view. */
export function FlowIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    // Hidden only once scripting is known to work, so it can never stay hidden.
    el.dataset.flow = "wait";
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.flow = "in";
        seen.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    seen.observe(el);
    // Once landed, the entrance lets go, so hover transforms are the element's own again.
    const landed = (e: AnimationEvent) => {
      if (e.target === el) el.dataset.flow = "done";
    };
    el.addEventListener("animationend", landed);
    return () => {
      seen.disconnect();
      el.removeEventListener("animationend", landed);
    };
  }, []);
  return (
    <div ref={ref} className={cx(className)} style={{ "--d": `${delay}s` } as CSSProperties}>
      {children}
    </div>
  );
}

/**
 * Reports how far an element has been scrolled, 0 to 1, by setting `--p` on it.
 * "pin" measures the way through a tall element that pins a screen inside it;
 * "exit" measures an element leaving through the top of the screen. The value
 * eases after the scroll position instead of jumping with each wheel tick.
 * The page scrolls inside a container, so every scroll is heard.
 */
export function useScrollProgress<T extends HTMLElement>(
  onProgress?: (p: number, el: T) => void,
  mode: "pin" | "exit" = "pin",
) {
  const ref = useRef<T>(null);
  const handler = useRef(onProgress);
  handler.current = onProgress;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const still = reduced();
    let frame = 0;
    let target = 0;
    let shown = -1;
    let before = 0;
    const read = () => {
      const rect = el.getBoundingClientRect();
      const span = mode === "pin" ? rect.height - window.innerHeight : rect.height;
      target = span <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / span));
    };
    const step = (now: number) => {
      frame = 0;
      const dt = Math.min(64, now - before || 16);
      before = now;
      const next =
        still || shown < 0 ? target : shown + (target - shown) * (1 - Math.exp(-dt / 90));
      shown = Math.abs(target - next) < 0.0004 ? target : next;
      el.style.setProperty("--p", shown.toFixed(4));
      handler.current?.(shown, el);
      if (shown !== target) frame = requestAnimationFrame(step);
    };
    const queue = () => {
      read();
      if (!frame) {
        before = performance.now();
        frame = requestAnimationFrame(step);
      }
    };
    queue();
    window.addEventListener("scroll", queue, { capture: true, passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue, { capture: true });
      window.removeEventListener("resize", queue);
    };
  }, [mode]);
  return ref;
}

/**
 * A few pixels that grow into a corner of their card while it is hovered or
 * focused. The card needs the `group` class and to clip its overflow.
 */
export function PixelCorner() {
  return (
    <span aria-hidden="true" className="pixel-corner">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <i key={n} style={{ "--n": n } as CSSProperties} />
      ))}
    </span>
  );
}
