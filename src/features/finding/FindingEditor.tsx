import {
  CircleDot,
  Copy,
  Gauge,
  Hash,
  MoreHorizontal,
  NotebookPen,
  Server,
  ShieldAlert,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatScore } from "../../domain/cvss";
import { rate } from "../../domain/severity";
import {
  type Finding,
  type Project,
  SEVERITIES,
  type Severity,
  STATUSES,
} from "../../domain/types";
import {
  Button,
  cx,
  Dialog,
  Field,
  IconButton,
  Menu,
  SEVERITY_CLASS,
  SeverityBadge,
  TextArea,
} from "../../ui/primitives";
import { CvssDialog } from "../cvss/CvssDialog";
import { DocEditor } from "../editor/DocEditor";

export const STATUS_DOT: Record<Finding["status"], string> = {
  Open: "bg-sev-high",
  "Partially fixed": "bg-sev-medium",
  Fixed: "bg-ok",
  "Risk accepted": "bg-sev-info",
};

export function FindingEditor({
  finding,
  reference,
  project,
  onChange,
  onDuplicate,
  onDelete,
}: {
  finding: Finding;
  reference: string;
  project: Project;
  onChange: (patch: Partial<Finding>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [cvssOpen, setCvssOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(!!finding.notes.trim());
  const rating = rate(finding);

  return (
    <div className="flex min-h-full">
      <article className="mx-auto w-full min-w-0 max-w-[780px] px-6 pb-8 pt-12 sm:px-12">
        <div className="flex items-center gap-1 text-[12.5px] text-ink-faint">
          <span className="font-mono font-semibold text-accent">{reference}</span>
          <div className="flex-1" />
          <IconButton
            label={notesOpen ? "Hide private notes" : "Private notes"}
            onClick={() => setNotesOpen((o) => !o)}
            aria-pressed={notesOpen}
            className={cx(notesOpen && "bg-hover text-ink")}
          >
            <NotebookPen />
          </IconButton>
          <Menu
            align="end"
            width={200}
            trigger={({ toggle, ref, open }) => (
              <IconButton ref={ref} label="Finding actions" onClick={toggle} aria-expanded={open}>
                <MoreHorizontal />
              </IconButton>
            )}
            items={[
              { value: "duplicate", label: "Duplicate", icon: <Copy /> },
              { value: "delete", label: "Delete finding", icon: <Trash2 />, danger: true },
            ]}
            onSelect={(v) => (v === "duplicate" ? onDuplicate() : onDelete())}
          />
        </div>

        <Title
          value={finding.title}
          onChange={(title) => onChange({ title })}
          focusWhenEmpty={finding.id}
        />

        <dl className="mt-5 border-b border-line pb-5">
          <Property icon={<Gauge />} label="Severity">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {rating.source === "manual" ? (
                <Menu
                  heading="Severity"
                  value={finding.manualSeverity}
                  items={SEVERITIES.map((s) => ({
                    value: s,
                    label: <SeverityLabel severity={s} />,
                  }))}
                  onSelect={(s) => onChange({ manualSeverity: s })}
                  trigger={({ toggle, ref, open }) => (
                    <button
                      ref={ref}
                      type="button"
                      onClick={toggle}
                      aria-expanded={open}
                      aria-label="Severity"
                      className="rounded-md hover:opacity-85"
                    >
                      <SeverityBadge severity={finding.manualSeverity} />
                    </button>
                  )}
                />
              ) : (
                <SeverityBadge severity={rating.severity} />
              )}
              <span className="text-[13px] text-ink-faint">
                {rating.source === "cvss" ? (
                  <>
                    from the CVSS score
                    <button
                      type="button"
                      onClick={() => setOverrideOpen(true)}
                      className="ml-2 text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink"
                    >
                      Override
                    </button>
                  </>
                ) : rating.source === "override" ? (
                  <>
                    adjusted from{" "}
                    <span className={SEVERITY_CLASS[rating.cvssSeverity ?? "Info"].text}>
                      {rating.cvssSeverity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOverrideOpen(true)}
                      className="ml-2 text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink"
                    >
                      Edit
                    </button>
                  </>
                ) : (
                  "set by hand. Add a CVSS score to derive it."
                )}
              </span>
            </div>
          </Property>

          <Property icon={<Hash />} label="CVSS">
            <button
              type="button"
              onClick={() => setCvssOpen(true)}
              aria-label={rating.cvss ? "Edit CVSS score" : "Add CVSS score"}
              className="-mx-1.5 flex min-w-0 max-w-full items-baseline gap-2.5 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-hover"
            >
              {rating.cvss ? (
                <>
                  <span
                    className={cx(
                      "text-[14px] font-semibold",
                      SEVERITY_CLASS[rating.cvss.severity].text,
                    )}
                  >
                    {formatScore(rating.cvss.score)}
                  </span>
                  <span className="min-w-0 truncate font-mono text-[12px] text-ink-muted">
                    {rating.cvss.vector}
                  </span>
                </>
              ) : (
                <span className="text-[13.5px] text-ink-faint">Add score</span>
              )}
            </button>
          </Property>

          <Property icon={<CircleDot />} label="Status">
            <Menu
              heading="Status"
              value={finding.status}
              items={STATUSES.map((s) => ({
                value: s,
                label: (
                  <span className="flex items-center gap-2">
                    <span className={cx("size-2 rounded-full", STATUS_DOT[s])} />
                    {s}
                  </span>
                ),
              }))}
              onSelect={(s) => onChange({ status: s })}
              trigger={({ toggle, ref, open }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-label="Status"
                  className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-0.5 text-[13.5px] hover:bg-hover"
                >
                  <span className={cx("size-2 rounded-full", STATUS_DOT[finding.status])} />
                  {finding.status}
                </button>
              )}
            />
          </Property>

          <Property icon={<Server />} label="Affected">
            <InlineText
              value={finding.affected}
              onChange={(affected) => onChange({ affected })}
              placeholder="Hosts or URLs, one per line"
              multiline
              mono
              label="Affected assets"
            />
          </Property>

          <Property icon={<ShieldAlert />} label="CWE / CVE">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="w-[120px] shrink-0">
                <InlineText
                  value={finding.cwe}
                  onChange={(cwe) => onChange({ cwe })}
                  placeholder="CWE-639"
                  mono
                  label="CWE"
                />
              </div>
              <InlineText
                value={finding.cve}
                onChange={(cve) => onChange({ cve })}
                placeholder="CVE, if any"
                mono
                label="CVE"
              />
            </div>
          </Property>
        </dl>

        {rating.source === "override" && finding.override?.reason ? (
          <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
            <span className="text-ink">Override reason:</span> {finding.override.reason}
          </p>
        ) : null}

        <div className="mt-7">
          <DocEditor
            key={finding.id}
            label="Finding write-up"
            projectId={finding.projectId}
            value={finding.body}
            onChange={(body) => onChange({ body })}
            placeholder="Write the finding. Use ## headings for sections such as Description, Impact, Steps to reproduce and Remediation."
          />
        </div>
      </article>

      {notesOpen ? (
        <aside className="sticky top-0 flex h-screen w-[340px] shrink-0 flex-col border-l border-line bg-surface-1">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line pl-5 pr-2">
            <span className="text-[13px] font-semibold">Private notes</span>
            <span className="text-[12px] text-ink-faint">never in the report</span>
            <div className="flex-1" />
            <IconButton label="Close notes" onClick={() => setNotesOpen(false)} className="size-7">
              <X />
            </IconButton>
          </div>
          <div className="notes-editor min-h-0 flex-1 overflow-y-auto px-5 pt-3">
            <DocEditor
              key={`notes-${finding.id}`}
              label="Private notes"
              projectId={finding.projectId}
              value={finding.notes}
              onChange={(notes) => onChange({ notes })}
              placeholder="Credentials used, retest notes, open questions."
            />
          </div>
        </aside>
      ) : null}

      <CvssDialog
        open={cvssOpen}
        onClose={() => setCvssOpen(false)}
        vector={finding.cvssVector}
        defaultVersion={project.defaultCvssVersion}
        onApply={(v) => onChange({ cvssVector: v })}
      />
      <OverrideDialog
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        finding={finding}
        cvssSeverity={rating.cvssSeverity ?? rating.severity}
        onSave={(override) => onChange({ override })}
      />
    </div>
  );
}

/** A large, borderless, auto-growing title, as in a document app. */
export function Title({
  value,
  onChange,
  focusWhenEmpty,
  placeholder = "Untitled finding",
}: {
  value: string;
  onChange: (value: string) => void;
  focusWhenEmpty?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the text changes
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when a different document opens
  useEffect(() => {
    if (!value) ref.current?.focus();
  }, [focusWhenEmpty]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          document.querySelector<HTMLElement>("article .doc-editor .cm-content")?.focus();
        }
      }}
      placeholder={placeholder}
      rows={1}
      spellCheck={false}
      autoCorrect="off"
      aria-label="Title"
      className="mt-3 block w-full resize-none overflow-hidden bg-transparent text-[32px] font-semibold leading-[1.18] tracking-[-0.022em] text-ink outline-none placeholder:text-ink-faint"
    />
  );
}

export function Property({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[34px] items-start gap-3 py-[3px]">
      <dt className="flex h-7 w-[124px] shrink-0 items-center gap-2 text-[13px] text-ink-faint [&_svg]:size-[15px]">
        {icon}
        {label}
      </dt>
      <dd className="flex min-h-7 min-w-0 flex-1 items-center">{children}</dd>
    </div>
  );
}

/** Text that reads as plain text until hovered or focused, like a property value. */
export function InlineText({
  value,
  onChange,
  placeholder,
  multiline,
  mono,
  label,
  className,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  mono?: boolean;
  label: string;
  className?: string;
  type?: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the text changes
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  const cls = cx(
    "-mx-1.5 block w-full min-w-0 rounded-md bg-transparent px-1.5 py-[3px] text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-faint hover:bg-hover focus:bg-hover",
    mono && "font-mono text-[12.5px] placeholder:font-sans placeholder:text-[13.5px]",
    className,
  );
  const proofing = {
    spellCheck: false,
    autoCorrect: "off",
    autoComplete: "off",
    "aria-label": label,
  } as const;
  return multiline ? (
    <textarea
      ref={area}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      {...proofing}
      className={cx(cls, "resize-none overflow-hidden leading-relaxed")}
    />
  ) : (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      {...proofing}
      className={cls}
    />
  );
}

function SeverityLabel({ severity }: { severity: Severity }) {
  return (
    <span className={cx("flex items-center gap-2 font-medium", SEVERITY_CLASS[severity].text)}>
      <span className={cx("size-2 rounded-[2px]", SEVERITY_CLASS[severity].dot)} />
      {severity}
    </span>
  );
}

function OverrideDialog({
  open,
  onClose,
  finding,
  cvssSeverity,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  finding: Finding;
  cvssSeverity: Severity;
  onSave: (override: Finding["override"]) => void;
}) {
  const [severity, setSeverity] = useState<Severity>(cvssSeverity);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!open) return;
    setSeverity(finding.override?.severity ?? cvssSeverity);
    setReason(finding.override?.reason ?? "");
  }, [open, finding.override, cvssSeverity]);
  const changed = severity !== cvssSeverity;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={500}
      title="Override severity"
      description={
        <>
          The CVSS score rates this finding{" "}
          <span className={SEVERITY_CLASS[cvssSeverity].text}>{cvssSeverity}</span>. If the context
          justifies a different rating, the report shows both and your reason.
        </>
      }
      footer={
        <>
          {finding.override ? (
            <Button
              variant="ghost"
              icon={<Undo2 />}
              onClick={() => {
                onSave(null);
                onClose();
              }}
              className="mr-auto"
            >
              Use CVSS rating
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!changed || reason.trim().length < 10}
            onClick={() => {
              onSave({ severity, reason: reason.trim() });
              onClose();
            }}
          >
            Save override
          </Button>
        </>
      }
    >
      <fieldset className="grid min-w-0 grid-cols-5 gap-1.5">
        <legend className="sr-only">Severity</legend>
        {SEVERITIES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={severity === s}
            onClick={() => setSeverity(s)}
            className={cx(
              "flex h-16 flex-col items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold transition-colors",
              severity === s
                ? cx(SEVERITY_CLASS[s].soft, SEVERITY_CLASS[s].text)
                : "border-line-strong text-ink-muted hover:text-ink",
            )}
          >
            <span className={cx("size-2 rounded-[2px]", SEVERITY_CLASS[s].dot)} />
            {s}
            {s === cvssSeverity ? (
              <span className="-mt-1 text-[9.5px] font-medium uppercase tracking-wide opacity-70">
                CVSS
              </span>
            ) : null}
          </button>
        ))}
      </fieldset>
      <Field
        label="Reason"
        hint="Required. Printed in the report next to the rating."
        className="mt-5"
      >
        {(id) => (
          <TextArea
            id={id}
            data-autofocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="The service is reachable only from the management network, which requires VPN and MFA."
          />
        )}
      </Field>
    </Dialog>
  );
}
