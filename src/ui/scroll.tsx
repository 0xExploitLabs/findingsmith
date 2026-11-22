import Lenis from "lenis";
import { createContext, type RefObject, useContext, useEffect, useRef } from "react";

/**
 * How an element's progress, 0 to 1, follows the scroll:
 * - "enter": its top edge rising from the foot of the screen, eased;
 * - "exit": it leaving through the top of the screen;
 * - "pin": the way through a tall element that pins a screen inside it;
 * - "cross": from its top reaching the foot of the screen to its foot leaving the top;
 * - "tail": its foot rising from the foot of the screen to where the page ends,
 *   which is how much of what lies beneath it has been uncovered.
 */
export type ScrollMode = "enter" | "exit" | "pin" | "cross" | "tail";

/* The one entrance every section shares: how far an element travels up the
   screen while it arrives, as a share of the screen's height, and the curve it
   follows. Changing these changes the whole page at once. */
const ENTER_SPAN = 0.4;
const ENTER_MAX = 380;
export const glide = (t: number) => 1 - (1 - t) ** 3;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Track {
  el: HTMLElement;
  mode: ScrollMode;
  /** For "enter": how much later this element starts, as a share of the entrance. */
  delay: number;
  onProgress?: (p: number, el: HTMLElement) => void;
  top: number;
  height: number;
  shown: number;
}

/**
 * One scrolling page and everything on it that moves with the scroll. Places
 * are measured when the layout changes, never while scrolling, so a scroll
 * only reads one number and writes transforms. It also owns the smooth
 * wheel scrolling, which is left off under reduced motion.
 */
export class ScrollStage {
  private scroller: HTMLElement | null = null;
  private tracks = new Set<Track>();
  private view = 0;
  private limit = 0;
  private still = false;
  private lenis: Lenis | null = null;
  private observer: ResizeObserver | null = null;
  private pending = 0;

  attach(scroller: HTMLElement, content: HTMLElement): () => void {
    this.scroller = scroller;
    this.still = reducedMotion();
    if (!this.still) {
      // Only the wheel is smoothed. Keys, the scrollbar, touch, find-in-page and
      // focus all scroll natively, and the stage follows whichever moved the page.
      this.lenis = new Lenis({
        wrapper: scroller,
        content,
        eventsTarget: scroller,
        lerp: 0.115,
        wheelMultiplier: 1,
        autoRaf: true,
        allowNestedScroll: true,
      });
    }
    const onScroll = () => this.update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    // Measuring waits for the frame, so a burst of layout changes is read once.
    const remeasure = () => {
      if (this.pending) return;
      this.pending = requestAnimationFrame(() => {
        this.pending = 0;
        this.measure();
      });
    };
    this.observer = new ResizeObserver(remeasure);
    this.observer.observe(scroller);
    this.observer.observe(content);
    void document.fonts?.ready.then(remeasure);
    this.measure();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(this.pending);
      this.pending = 0;
      this.observer?.disconnect();
      this.observer = null;
      this.lenis?.destroy();
      this.lenis = null;
      this.scroller = null;
    };
  }

  track(
    el: HTMLElement,
    mode: ScrollMode,
    delay: number,
    onProgress?: Track["onProgress"],
  ): () => void {
    const track: Track = { el, mode, delay, onProgress, top: 0, height: 0, shown: -1 };
    this.tracks.add(track);
    if (this.scroller) {
      this.place(track);
      this.show(track, this.scroller.scrollTop);
    }
    return () => {
      this.tracks.delete(track);
      el.style.removeProperty("--p");
    };
  }

  /** Lays everything out again: call when something moved without changing the page's size. */
  measure(): void {
    const scroller = this.scroller;
    if (!scroller) return;
    this.view = scroller.clientHeight;
    this.limit = scroller.scrollHeight - this.view;
    for (const track of this.tracks) this.place(track);
    for (const track of this.tracks) track.shown = -1;
    this.update();
  }

  /** The element's place in the page as laid out, whatever transform it wears. */
  private place(track: Track): void {
    let top = 0;
    let node: HTMLElement | null = track.el;
    while (node && node !== this.scroller) {
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    track.top = top;
    track.height = track.el.offsetHeight;
  }

  private update(): void {
    const scroller = this.scroller;
    if (!scroller) return;
    const y = scroller.scrollTop;
    for (const track of this.tracks) this.show(track, y);
  }

  private progress(track: Track, y: number): number {
    const { mode, top, height } = track;
    const view = this.view;
    if (mode === "exit") return height > 0 ? clamp((y - top) / height) : 0;
    if (mode === "pin") return height > view ? clamp((y - top) / (height - view)) : 1;
    if (mode === "cross") return clamp((y + view - top) / (view + height));
    if (mode === "tail") {
      const start = top + height - view;
      return this.limit > start ? clamp((y - start) / (this.limit - start)) : 1;
    }
    // An element near the end of the page has less room to rise, so its
    // entrance is fitted to the room there is and it always finishes.
    const room = this.limit + view - top;
    const span = Math.max(1, Math.min(view * ENTER_SPAN, ENTER_MAX, room * 0.85));
    return glide(clamp((y + view - top) / span - track.delay));
  }

  private show(track: Track, y: number): void {
    // Reduced motion: everything is where it comes to rest, and stays there.
    const p = this.still
      ? track.mode === "exit" || track.mode === "cross"
        ? 0
        : 1
      : Math.round(this.progress(track, y) * 10000) / 10000;
    if (p === track.shown) return;
    track.shown = p;
    // A handler takes the value itself; otherwise it is the element's --p.
    if (track.onProgress) track.onProgress(p, track.el);
    else track.el.style.setProperty("--p", String(p));
  }
}

export const ScrollContext = createContext<ScrollStage | null>(null);

/**
 * Follows an element through the scroll of the page around it: its progress,
 * 0 to 1, goes to `onProgress` when one is given and is otherwise set on the
 * element as `--p`. Without a stage nothing is set, and the styles fall back
 * to the element at rest.
 */
export function useScrollProgress<T extends HTMLElement>(
  mode: ScrollMode,
  onProgress?: (p: number, el: T) => void,
  delay = 0,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const stage = useContext(ScrollContext);
  const handler = useRef(onProgress);
  handler.current = onProgress;
  useEffect(() => {
    const el = ref.current;
    if (!el || !stage) return;
    return stage.track(
      el,
      mode,
      delay,
      handler.current ? (p, node) => handler.current?.(p, node as T) : undefined,
    );
  }, [stage, mode, delay]);
  return ref;
}
