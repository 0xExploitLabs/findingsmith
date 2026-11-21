import { APP_NAME, ORG_NAME } from "../brand";
import cicada from "../cicada.svg?raw";
import { cx } from "./primitives";

const path = /<path[^>]*>/.exec(cicada)?.[0] ?? "";

const HATCH =
  '<defs><pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><rect width="14" height="5" fill="currentColor"/></pattern></defs>';

/** The founder-drawn cicada, coloured by `currentColor`; `hatch` fills it with ruled lines. */
export function Cicada({ className, hatch }: { className?: string; hatch?: boolean }) {
  return (
    <svg
      viewBox="0 0 1958 690"
      aria-hidden="true"
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: a static brand asset bundled with the app
      dangerouslySetInnerHTML={{ __html: (hatch ? HATCH : "") + path }}
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
