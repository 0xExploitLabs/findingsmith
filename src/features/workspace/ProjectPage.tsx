import {
  Building2,
  CalendarDays,
  Download,
  FileClock,
  MoreHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { download, exportProject, safeFilename } from "../../data/transfer";
import { rate } from "../../domain/severity";
import { type Finding, type Project, SEVERITIES } from "../../domain/types";
import { cx, IconButton, Menu, SEVERITY_CLASS } from "../../ui/primitives";
import { toast } from "../../ui/toast";
import { DocEditor } from "../editor/DocEditor";
import { InlineText, Property, Title } from "../finding/FindingEditor";

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
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
    (typeof SEVERITIES)[number],
    number
  >;
  for (const f of findings) counts[rate(f).severity]++;

  return (
    <article className="mx-auto w-full max-w-[780px] px-6 pb-8 pt-12 sm:px-12">
      <div className="flex items-center gap-2 text-[12.5px] text-ink-faint">
        <span>Project</span>
        <span>·</span>
        <span>
          {findings.length} finding{findings.length === 1 ? "" : "s"}
        </span>
        {findings.length > 0 ? (
          <span className="ml-1 flex items-center gap-2.5">
            {SEVERITIES.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} className="flex items-center gap-1" title={s}>
                <span className={cx("size-1.5 rounded-[2px]", SEVERITY_CLASS[s].dot)} />
                <span className="font-mono text-ink-muted">{counts[s]}</span>
              </span>
            ))}
          </span>
        ) : null}
        <div className="flex-1" />
        <Menu
          align="end"
          width={210}
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
              hint: "A backup you can import anywhere",
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

      <dl className="mt-5 border-b border-line pb-5">
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
          <div className="flex items-center gap-2 text-[13px] text-ink-faint">
            <div className="w-[150px]">
              <InlineText
                type="date"
                value={project.startDate}
                onChange={(startDate) => onChange({ startDate })}
                placeholder="Start"
                label="Testing started"
              />
            </div>
            to
            <div className="w-[150px]">
              <InlineText
                type="date"
                value={project.endDate}
                onChange={(endDate) => onChange({ endDate })}
                placeholder="End"
                label="Testing ended"
              />
            </div>
          </div>
        </Property>
        <Property icon={<FileClock />} label="Report">
          <div className="flex items-center gap-2 text-[13px] text-ink-faint">
            <div className="w-[150px]">
              <InlineText
                type="date"
                value={project.reportDate}
                onChange={(reportDate) => onChange({ reportDate })}
                placeholder="Date"
                label="Report date"
              />
            </div>
            version
            <div className="w-[80px]">
              <InlineText
                value={project.version}
                onChange={(version) => onChange({ version })}
                placeholder="1.0"
                label="Version"
              />
            </div>
          </div>
        </Property>
      </dl>

      <div className="mt-7">
        <DocEditor
          key={project.id}
          label="Report text"
          projectId={project.id}
          value={project.body}
          onChange={(body) => onChange({ body })}
          placeholder="Write the executive summary, scope and methodology. Each ## heading becomes a section of the report."
        />
      </div>
    </article>
  );
}
