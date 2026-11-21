import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { cx } from "./primitives";

/**
 * A headline whose words each arrive through a pixel block. Given two
 * phrases, it shows the first, then swaps to the second, word by word.
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
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhrase(then);
      return;
    }
    const timer = setTimeout(() => setPhrase(then), 2600);
    return () => clearTimeout(timer);
  }, [then]);
  let index = 0;
  return (
    <h1 className={className} aria-label={then.join(" ")}>
      <span key={phrase.join("|")} aria-hidden="true">
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
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    return () => seen.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx(className)} style={{ "--d": `${delay}s` } as CSSProperties}>
      {children}
    </div>
  );
}

/**
 * Reports how far a tall element has been scrolled through, 0 to 1, by setting
 * `--p` on it. The page scrolls inside a container, so every scroll is heard.
 */
export function useScrollProgress<T extends HTMLElement>(onProgress?: (p: number, el: T) => void) {
  const ref = useRef<T>(null);
  const handler = useRef(onProgress);
  handler.current = onProgress;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / span));
      el.style.setProperty("--p", p.toFixed(4));
      handler.current?.(p, el);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", queue, { capture: true, passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue, { capture: true });
      window.removeEventListener("resize", queue);
    };
  }, []);
  return ref;
}
