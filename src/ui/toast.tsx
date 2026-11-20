import { CircleAlert, CircleCheck } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cx } from "./primitives";

interface Toast {
  id: number;
  message: string;
  tone: "ok" | "error";
}

let toasts: Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function toast(message: string, tone: Toast["tone"] = "ok"): void {
  const id = next++;
  toasts = [...toasts, { id, message, tone }];
  emit();
  setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    tone === "error" ? 6000 : 3200,
  );
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[300] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className={cx(
            "flex items-center gap-2.5 rounded-xl border bg-surface-2 px-4 py-2.5 text-[13px] shadow-pop animate-in [&_svg]:size-4",
            t.tone === "error"
              ? "border-[rgb(var(--brand-signal-drop)/0.4)]"
              : "border-line-strong",
          )}
        >
          {t.tone === "error" ? (
            <CircleAlert className="text-danger" />
          ) : (
            <CircleCheck className="text-ok" />
          )}
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}
