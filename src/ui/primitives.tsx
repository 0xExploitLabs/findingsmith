import { Check, ChevronDown, X } from "lucide-react";
import {
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Severity } from "../domain/types";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "btn inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" &&
          "btn-primary bg-accent text-ink-inverse enabled:hover:bg-accent-deep",
        variant === "secondary" &&
          "btn-raised border border-line-strong bg-surface-1 text-ink enabled:hover:border-line-hover",
        variant === "ghost" && "text-ink-muted enabled:hover:bg-hover enabled:hover:text-ink",
        variant === "danger" &&
          "border border-danger-line bg-danger-soft text-danger enabled:hover:bg-danger-soft-hover",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        "inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-[background-color,color,scale] duration-(--dur-short) ease-(--ease-out) enabled:hover:bg-hover enabled:hover:text-ink enabled:active:scale-90 enabled:active:bg-press disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Text inputs never spell-check: reports are full of hostnames, payloads and non-English words. */
const noProofing = {
  spellCheck: false,
  autoCorrect: "off",
  autoCapitalize: "off",
  autoComplete: "off",
} as const;

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...noProofing}
      {...rest}
      className={cx(
        "h-9 w-full rounded-lg border border-line-strong bg-surface-1 px-3 text-[13.5px] text-ink outline-none transition-colors duration-(--dur-micro) placeholder:text-ink-faint hover:border-line-hover focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
    />
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...noProofing}
      {...rest}
      className={cx(
        "w-full resize-y rounded-lg border border-line-strong bg-surface-1 px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none transition-colors duration-(--dur-micro) placeholder:text-ink-faint hover:border-line-hover focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[12px] font-medium text-ink-muted">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-[12px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export const SEVERITY_CLASS: Record<Severity, { text: string; dot: string; soft: string }> = {
  Critical: {
    text: "text-sev-critical",
    dot: "bg-sev-critical",
    soft: "bg-[rgb(var(--sev-critical)/0.12)] border-[rgb(var(--sev-critical)/0.3)]",
  },
  High: {
    text: "text-sev-high",
    dot: "bg-sev-high",
    soft: "bg-[rgb(var(--sev-high)/0.12)] border-[rgb(var(--sev-high)/0.3)]",
  },
  Medium: {
    text: "text-sev-medium",
    dot: "bg-sev-medium",
    soft: "bg-[rgb(var(--sev-medium)/0.12)] border-[rgb(var(--sev-medium)/0.3)]",
  },
  Low: {
    text: "text-sev-low",
    dot: "bg-sev-low",
    soft: "bg-[rgb(var(--sev-low)/0.12)] border-[rgb(var(--sev-low)/0.3)]",
  },
  Info: {
    text: "text-sev-info",
    dot: "bg-sev-info",
    soft: "bg-[rgb(var(--sev-info)/0.12)] border-[rgb(var(--sev-info)/0.3)]",
  },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const c = SEVERITY_CLASS[severity];
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-md border px-2 text-[12.5px] font-semibold",
        c.soft,
        c.text,
        className,
      )}
    >
      {severity}
    </span>
  );
}

/** Positions a floating element under its anchor, flipping above when there is no room. */
function useAnchoredPosition(
  open: boolean,
  anchor: React.RefObject<HTMLElement | null>,
  align: "start" | "end",
) {
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number; above: boolean }>({
    top: 0,
    left: 0,
    maxHeight: 320,
    above: false,
  });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const flip = below < 220 && above > below;
      setPos({
        top: flip ? r.top - 6 : r.bottom + 6,
        left: align === "end" ? r.right : r.left,
        maxHeight: Math.max(160, flip ? above : below),
        above: flip,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, align]);
  return pos;
}

export interface MenuItem<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  /** A quiet note at the end of the row, such as an example value. */
  detail?: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
}

/** A dropdown menu rendered in a portal so it is never clipped by a scrolling parent. */
export function Menu<T extends string>({
  trigger,
  items,
  value,
  onSelect,
  align = "start",
  heading,
  width = 220,
}: {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    ref: React.RefObject<HTMLButtonElement | null>;
  }) => ReactNode;
  items: MenuItem<T>[];
  value?: T;
  onSelect: (value: T) => void;
  align?: "start" | "end";
  heading?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const pos = useAnchoredPosition(open, anchor, align);

  useEffect(() => {
    if (!open) return;
    setActive(
      Math.max(
        0,
        items.findIndex((i) => i.value === value),
      ),
    );
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    requestAnimationFrame(() => panel.current?.focus());
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, items, value]);

  const choose = (v: T) => {
    onSelect(v);
    setOpen(false);
    anchor.current?.focus();
  };

  return (
    <>
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: anchor })}
      {open
        ? createPortal(
            <div
              ref={panel}
              role="menu"
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  anchor.current?.focus();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => (a + 1) % items.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => (a - 1 + items.length) % items.length);
                } else if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const item = items[active];
                  if (item) choose(item.value);
                }
              }}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width,
                maxHeight: pos.maxHeight,
                transform: `${align === "end" ? "translateX(-100%)" : ""} ${pos.above ? "translateY(-100%)" : ""}`,
              }}
              className="z-[200] overflow-y-auto rounded-xl border border-line-strong bg-surface-2 p-1 shadow-pop outline-none animate-in"
            >
              {heading ? (
                <div className="px-2.5 pb-1 pt-1.5 text-[12px] font-medium text-ink-faint">
                  {heading}
                </div>
              ) : null}
              {items.map((item, i) => (
                <button
                  type="button"
                  // A menu that holds a choice says which entry is the current one.
                  {...(value === undefined
                    ? { role: "menuitem" }
                    : { role: "menuitemradio", "aria-checked": value === item.value })}
                  key={item.value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(item.value)}
                  className={cx(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13.5px] [&_svg]:size-4 [&_svg]:shrink-0",
                    i === active && "bg-hover",
                    item.danger ? "text-danger" : "text-ink",
                  )}
                >
                  {item.icon ? (
                    <span className={cx("flex", !item.danger && "text-ink-muted")}>
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.hint ? (
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">
                        {item.hint}
                      </span>
                    ) : null}
                  </span>
                  {item.detail ? (
                    <span className="max-w-[60%] shrink-0 truncate text-[12px] text-ink-faint">
                      {item.detail}
                    </span>
                  ) : null}
                  {value === item.value ? <Check className="!size-3.5 text-accent" /> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function SelectButton({
  label,
  open,
  className,
  ...rest
}: ComponentProps<"button"> & { label: ReactNode; open: boolean }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      {...rest}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink transition-colors hover:bg-hover",
        open && "bg-hover",
        className,
      )}
    >
      {label}
      <ChevronDown className="size-3.5 text-ink-faint" />
    </button>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 560,
  bare,
  placement = "center",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  bare?: boolean;
  /** "top" suits search palettes, which grow downwards as results change. */
  placement?: "center" | "top";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"]), .cm-content',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // The page behind a modal is taken out of the tab order and the accessibility tree.
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    requestAnimationFrame(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current;
      target?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      root?.removeAttribute("inert");
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className={cx(
        "fixed inset-0 z-[150] flex justify-center p-4 sm:p-8",
        placement === "top" ? "items-start pt-[12vh] sm:pt-[12vh]" : "items-center",
      )}
    >
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-scrim backdrop-blur-[3px] animate-fade"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{ maxWidth: width }}
        className="relative flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-pop outline-none animate-in"
      >
        {bare ? (
          children
        ) : (
          <>
            <div className="flex items-start gap-4 px-6 pb-4 pt-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
                {description ? (
                  <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
                ) : null}
              </div>
              <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
                <X />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
            {footer ? (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-3.5">
                {footer}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-px font-mono text-[10.5px] text-ink-muted">
      {children}
    </kbd>
  );
}
