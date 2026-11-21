import { href } from "../../state/router";
import { cx } from "../../ui/primitives";

/**
 * The report has two sides, kept next to each other: what it says about the
 * engagement (title, dates, summary, scope) and the PDF it becomes.
 */
export function ReportTabs({
  projectId,
  current,
}: {
  projectId: string;
  current: "details" | "report";
}) {
  const tab = (view: "details" | "report", label: string) => (
    <a
      href={href({ name: "project", projectId, view })}
      aria-current={current === view ? "page" : undefined}
      className={cx(
        "flex h-7 items-center rounded-md px-3 text-[13px] font-medium transition-colors duration-(--dur-micro)",
        current === view ? "bg-surface-1 text-ink shadow-sm" : "text-ink-muted hover:text-ink",
      )}
    >
      {label}
    </a>
  );
  return (
    <nav aria-label="Report" className="flex shrink-0 gap-0.5 rounded-lg bg-surface-3 p-0.5">
      {tab("details", "Details")}
      {tab("report", "PDF")}
    </nav>
  );
}
