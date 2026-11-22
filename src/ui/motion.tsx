import { type CSSProperties, type ElementType, type ReactNode, useEffect, useState } from "react";
import { cx } from "./primitives";
import { reducedMotion, useScrollProgress } from "./scroll";

/** How long a phrase is held before the next one wipes over it. */
const HOLD = 3600;

/**
 * A headline that trades one phrase for another, line by line: a block of
 * pixels crosses each line, taking the old words with it and leaving the new
 * ones behind. Both phrases are always laid out, one over the other, so the
 * trade moves nothing around it. With reduced motion it shows the second
 * phrase and stays.
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
  // "start" wipes the first phrase in; after that the two take turns.
  const [shown, setShown] = useState<"start" | 0 | 1 | "rest">("start");
  useEffect(() => {
    if (reducedMotion()) {
      setShown("rest");
      return;
    }
    const timer = setInterval(() => setShown((now) => (now === 1 ? 0 : 1)), HOLD);
    return () => clearInterval(timer);
  }, []);
  const lines = Math.max(first.length, then.length);
  return (
    <h1 className={className} aria-label={then.join(" ")}>
      {Array.from({ length: lines }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the lines of a fixed headline
          key={i}
          aria-hidden="true"
          className="block"
        >
          <span className="swap-line" data-show={shown} style={{ "--i": i } as CSSProperties}>
            {[first[i], then[i]].map((text, face) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: the two faces of a line
                key={face}
                className="swap-face"
                data-face={face}
              >
                <span className="swap-ink">{text}</span>
              </span>
            ))}
            <span className="swap-wipe">
              <span className="swap-block">
                <i />
                <i />
                <i />
                <i />
              </span>
            </span>
          </span>
        </span>
      ))}
    </h1>
  );
}

/**
 * Brings its content up into place as it scrolls into view, following the
 * scroll: the entrance every section of a page shares. `delay` starts it a
 * little later than its neighbours, as a share of the entrance.
 */
export function Rise({
  as: Tag = "div",
  children,
  delay = 0,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useScrollProgress<HTMLElement>("enter", undefined, delay);
  return (
    <Tag ref={ref} className={cx("rise-in", className)}>
      {children}
    </Tag>
  );
}

/**
 * A few pixels that grow into a corner of their card while it is hovered or
 * focused: the top right one, or the bottom right. The card needs the `group`
 * class and to clip its overflow.
 */
export function PixelCorner({ corner = "tr" }: { corner?: "tr" | "br" }) {
  return (
    <span aria-hidden="true" className="pixel-corner" data-corner={corner}>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <i key={n} style={{ "--n": n } as CSSProperties} />
      ))}
    </span>
  );
}
