import {
  Building2,
  CalendarDays,
  Download,
  FileClock,
  MoreHorizontal,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { useRef } from "react";
import { download, exportProject, safeFilename } from "../../data/transfer";
import { rate } from "../../domain/severity";
import { type Finding, type Project, SEVERITIES } from "../../domain/types";
import { cx, IconButton, Menu, SEVERITY_CLASS } from "../../ui/primitives";
import { toast } from "../../ui/toast";
import { AddSections, InlineText, Property, Title } from "../doc/DocParts";
import { type DocController, DocEditor } from "../editor/DocEditor";

const PROJECT_SECTIONS = ["Executive summary", "Scope", "Methodology", "Limitations", "Conclusion"];

/**
 * The project is a document like any finding: a title, a few properties and
 * the report's own text (summary, scope, methodology) as Markdown.
 */
export function ProjectPage({
  project,
  findings,
  onChange,
  onDelete,
}: {
  project: Project;
  findings: Finding[];
  onChange: (patch: Partial<Project>) => void;
  onDelete: () => void;
}) {
  const editor = useRef<DocController | null>(null);
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
    (typeof SEVERITIES)[number],
    number
  >;
  for (const f of findings) counts[rate(f).severity]++;

  return (
    <article className="mx-auto w-full max-w-[800px] px-6 pb-10 pt-10 sm:px-14">
      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-ink-faint">
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-medium text-ink-muted">
          Project
        </span>
        <span className="ml-1">
          {findings.length} finding{findings.length === 1 ? "" : "s"}
        </span>
        {findings.length > 0 ? (
          <span className="ml-1 flex items-center gap-2.5">
            {SEVERITIES.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} className="flex items-center gap-1" title={`${counts[s]} ${s}`}>
                <span className={cx("size-1.5 rounded-[2px]", SEVERITY_CLASS[s].dot)} />
                <span className="font-mono text-ink-muted">{counts[s]}</span>
              </span>
            ))}
          </span>
        ) : null}
        <div className="flex-1" />
        <Menu
          align="end"
          width={230}
          trigger={({ toggle, ref, open }) => (
            <IconButton ref={ref} label="Project actions" onClick={toggle} aria-expanded={open}>
              <MoreHorizontal />
            </IconButton>
          )}
          items={[
            {
              value: "export",
              label: "Export project file",
              icon: <Download />,
              hint: "A backup you can import in any browser",
            },
            { value: "delete", label: "Delete project", icon: <Trash2 />, danger: true },
          ]}
          onSelect={async (v) => {
            if (v === "delete") return onDelete();
            download(await exportProject(project), `${safeFilename(project.name)}.debrief.json`);
            toast("Project exported");
          }}
        />
      </div>

      <Title
        value={project.name}
        onChange={(name) => onChange({ name })}
        placeholder="Untitled project"
      />

      <dl className="mt-6">
        <Property icon={<Building2 />} label="Client">
          <InlineText
            value={project.client}
            onChange={(client) => onChange({ client })}
            placeholder="Client name"
            label="Client"
          />
        </Property>
        <Property icon={<Users />} label="Assessors">
          <InlineText
            value={project.assessors}
            onChange={(assessors) => onChange({ assessors })}
            placeholder="Who tested"
            label="Assessors"
          />
        </Property>
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
        <Property icon={<Tag />} label="Version">
          <div className="w-24">
            <InlineText
              value={project.version}
              onChange={(version) => onChange({ version })}
              placeholder="1.0"
              label="Version"
            />
          </div>
        </Property>
      </dl>

      <div className="mt-6 border-t border-line pt-7">
        <DocEditor
          key={project.id}
          controller={editor}
          label="Report text"
          projectId={project.id}
          value={project.body}
          onChange={(body) => onChange({ body })}
          placeholder="Write the executive summary, scope and methodology. Each ## heading becomes a section of the report."
        />
        <AddSections
          body={project.body}
          sections={PROJECT_SECTIONS}
          onAdd={(t) => editor.current?.addSection(t)}
        />
      </div>
    </article>
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
