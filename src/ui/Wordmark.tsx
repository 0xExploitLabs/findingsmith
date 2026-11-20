import { APP_NAME, ORG_NAME } from "../brand";
import cicada from "../cicada.svg?raw";
import { cx } from "./primitives";

const path = /<path[^>]*>/.exec(cicada)?.[0] ?? "";

/** The founder-drawn cicada, coloured by `currentColor`. */
export function Cicada({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1958 690"
      aria-hidden="true"
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: a static brand asset bundled with the app
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

export function Wordmark({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <Cicada className={cx("text-ink", compact ? "h-[11px]" : "h-[14px]")} />
      <span
        className={cx(
          "font-semibold tracking-[-0.015em] text-ink",
          compact ? "text-[13px]" : "text-[15px]",
        )}
      >
        {APP_NAME}
      </span>
      {compact ? null : (
        <span className="text-[12.5px] text-ink-faint">
          by <span className="[font-feature-settings:'zero'] text-ink-muted">{ORG_NAME}</span>
        </span>
      )}
    </span>
  );
}
