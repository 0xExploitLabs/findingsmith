import { Building2, CalendarDays, FileClock, Plus, Users } from "lucide-react";
import { useRef, useState } from "react";
import type { Project } from "../../domain/types";
import { cx, Menu } from "../../ui/primitives";
import { AddSections, InlineText, Property, Title } from "../doc/DocParts";
import { type DocController, DocEditor } from "../editor/DocEditor";
import { ReportTabs } from "../report/ReportTabs";

type Extra = "client" | "assessors";

/** Properties a report may state, added from the picker when it does. */
const EXTRAS: { key: Extra; label: string; icon: React.ReactNode; example: string }[] = [
  { key: "client", label: "Client", icon: <Building2 />, example: "Northwind Traders Ltd" },
  { key: "assessors", label: "Assessors", icon: <Users />, example: "A. Okafor, M. Lindqvist" },
];

const PROJECT_SECTIONS = ["Executive summary", "Scope", "Methodology", "Limitations", "Conclusion"];

/** What to write under each of the report's usual sections. */
const PROJECT_HINTS = {
  "executive summary":
    "What was tested, how it held up and what to do first, for a reader who is not technical.",
  scope: "The targets that were tested, and what was left out.",
  methodology: "How the testing was done: the standards followed, the approach, the tools.",
  limitations: "What restricted the testing: time, access, environments, exclusions.",
  conclusion: "The overall result, and the next steps you recommend.",
};

/**
 * What the report says about the engagement itself: its title, a few
 * properties, and the text that comes before the findings (summary, scope,
 * methodology) as Markdown. It sits beside the PDF it feeds.
 */
export function ProjectPage({
  project,
  onChange,
}: {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
}) {
  const editor = useRef<DocController | null>(null);
  // Client and assessors are stated by some reports and not others: their rows
  // appear once they hold something, or when asked for.
  const [shown, setShown] = useState<Set<Extra>>(
    () => new Set(EXTRAS.filter((e) => project[e.key].trim()).map((e) => e.key)),
  );
  const [justAdded, setJustAdded] = useState<Extra | null>(null);
  const hidden = EXTRAS.filter((e) => !shown.has(e.key));

  return (
    <>
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-bg px-4 sm:px-5">
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] max-sm:sr-only">Report</h1>
        <ReportTabs projectId={project.id} current="details" />
        <p className="truncate text-[12.5px] text-ink-faint max-md:hidden">
          Everything the report says before its findings
        </p>
      </div>
      <article className="mx-auto w-full max-w-[800px] px-6 pb-10 pt-9 sm:px-14">
        <p className="mb-2 text-[12.5px] text-ink-faint">Report title</p>
        <Title
          value={project.name}
          onChange={(name) => onChange({ name })}
          placeholder="Untitled project"
        />

        <dl className="mt-6">
          <Property icon={<CalendarDays />} label="Testing">
            <div className="flex items-center gap-1 text-[13px] text-ink-faint">
              <DateField
                value={project.startDate}
                onChange={(startDate) => onChange({ startDate })}
                label="Testing started"
                empty="Start date"
              />
              <span className="px-1">to</span>
              <DateField
                value={project.endDate}
                onChange={(endDate) => onChange({ endDate })}
                label="Testing ended"
                empty="End date"
              />
            </div>
          </Property>
          <Property icon={<FileClock />} label="Report date">
            <DateField
              value={project.reportDate}
              onChange={(reportDate) => onChange({ reportDate })}
              label="Report date"
              empty="Set date"
            />
          </Property>
          {EXTRAS.filter((e) => shown.has(e.key)).map((e) => (
            <Property
              key={e.key}
              icon={e.icon}
              label={e.label}
              onRemove={() => {
                onChange({ [e.key]: "" });
                setShown((prev) => {
                  const next = new Set(prev);
                  next.delete(e.key);
                  return next;
                });
              }}
            >
              <InlineText
                value={project[e.key]}
                onChange={(value) => onChange({ [e.key]: value })}
                placeholder={e.example}
                label={e.label}
                autoFocus={justAdded === e.key}
              />
            </Property>
          ))}
        </dl>

        {hidden.length > 0 ? (
          <Menu
            width={260}
            items={hidden.map((e) => ({
              value: e.key,
              label: e.label,
              icon: e.icon,
              detail: e.example,
            }))}
            onSelect={(key) => {
              setShown((prev) => new Set(prev).add(key));
              setJustAdded(key);
            }}
            trigger={({ toggle, ref, open }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="mt-1 flex h-7 items-center gap-2 rounded-md px-1.5 text-[13px] text-ink-faint transition-colors hover:bg-hover hover:text-ink [&_svg]:size-[15px]"
              >
                <Plus />
                Add property
              </button>
            )}
          />
        ) : null}

        <div className="mt-6 border-t border-line pt-7">
          <DocEditor
            key={project.id}
            controller={editor}
            label="Report text"
            projectId={project.id}
            value={project.body}
            onChange={(body) => onChange({ body })}
            placeholder="Write the executive summary, scope and methodology. Each ## heading becomes a section of the report."
            hints={PROJECT_HINTS}
          />
          <AddSections
            body={project.body}
            sections={PROJECT_SECTIONS}
            onAdd={(t) => editor.current?.addSection(t)}
          />
        </div>
      </article>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A date shown as text, "12 Nov 2026", that opens the browser's date picker. */
function DateField({
  value,
  onChange,
  label,
  empty,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  empty: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => input.current?.showPicker?.()}
        aria-label={`${label}: ${value ? formatDate(value) : "not set"}`}
        className={cx(
          "-mx-1.5 rounded-md px-1.5 py-[3px] text-[14px] transition-colors hover:bg-hover",
          value ? "text-ink" : "text-ink-faint",
        )}
      >
        {value ? formatDate(value) : empty}
      </button>
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </span>
  );
}
