import {
  Bug,
  CircleDot,
  Copy,
  Gauge,
  Hash,
  Layers,
  Link2,
  MoreHorizontal,
  NotebookPen,
  Plug,
  Plus,
  Server,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { formatScore, RATING_SCALE, readCvss } from "../../domain/cvss";
import { rate } from "../../domain/severity";
import { type Finding, SEVERITIES, type Severity, STATUSES } from "../../domain/types";
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
import { AddSections, InlineText, Property, Title } from "../doc/DocParts";
import { type DocController, DocEditor } from "../editor/DocEditor";

export const STATUS_DOT: Record<Finding["status"], string> = {
  Open: "bg-sev-high",
  "Partially fixed": "bg-sev-medium",
  Fixed: "bg-ok",
  "Risk accepted": "bg-sev-info",
};

/** The sections a finding usually has, offered under the write-up until present. */
export const FINDING_SECTIONS = [
  "Description",
  "Impact",
  "Steps to reproduce",
  "Request and response",
  "Remediation",
  "References",
];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

type OptionalKey = "endpoint" | "parameter" | "host" | "port" | "affected" | "cwe" | "cve";

/** Properties a finding can have, added from the picker when they apply. */
const OPTIONAL: { key: OptionalKey; label: string; icon: ReactNode; hint: string }[] = [
  {
    key: "endpoint",
    label: "Endpoint",
    icon: <Link2 />,
    hint: "Method and URL of the affected request",
  },
  {
    key: "parameter",
    label: "Parameter",
    icon: <SlidersHorizontal />,
    hint: "The vulnerable parameter",
  },
  { key: "host", label: "Host", icon: <Server />, hint: "IP address or hostname" },
  { key: "port", label: "Port", icon: <Plug />, hint: "Port of the affected service" },
  { key: "affected", label: "Affected", icon: <Layers />, hint: "Other hosts, URLs or components" },
  { key: "cwe", label: "CWE", icon: <Bug />, hint: "Weakness ID, such as CWE-639" },
  { key: "cve", label: "CVE", icon: <ShieldAlert />, hint: "CVE ID, if one exists" },
];

function hasValue(f: Finding, key: OptionalKey): boolean {
  return key === "endpoint" ? !!(f.endpoint || f.method) : !!f[key].trim();
}

export function FindingEditor({
  finding,
  reference,
  onChange,
  onDuplicate,
  onDelete,
}: {
  finding: Finding;
  reference: string;
  onChange: (patch: Partial<Finding>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(!!finding.notes.trim());
  const [override, setOverride] = useState<Severity | null>(null);
  const [shown, setShown] = useState<Set<OptionalKey>>(
    () => new Set(OPTIONAL.filter((p) => hasValue(finding, p.key)).map((p) => p.key)),
  );
  const [justAdded, setJustAdded] = useState<OptionalKey | null>(null);
  const editor = useRef<DocController | null>(null);
  const rating = rate(finding);
  const cvssRead = finding.cvss.trim() ? readCvss(finding.cvss) : null;
  const cvssSeverity = rating.cvssSeverity;

  const pickSeverity = (s: Severity) => {
    if (!cvssSeverity) onChange({ manualSeverity: s });
    else if (s === cvssSeverity) onChange({ override: null });
    else setOverride(s);
  };

  const remove = (key: OptionalKey) => {
    onChange(key === "endpoint" ? { endpoint: "", method: "" } : { [key]: "" });
    setShown((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const hidden = OPTIONAL.filter((p) => !shown.has(p.key));

  return (
    <div className="flex min-h-full">
      <article className="mx-auto w-full min-w-0 max-w-[800px] px-6 pb-10 pt-10 sm:px-14">
        <div className="mb-4 flex items-center gap-2">
          <span
            className={cx(
              "rounded-md px-1.5 py-0.5 font-mono text-[12px] font-semibold",
              SEVERITY_CLASS[rating.severity].soft,
              SEVERITY_CLASS[rating.severity].text,
            )}
          >
            {reference}
          </span>
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
          placeholder="Untitled finding"
        />

        <dl className="mt-6">
          <Property icon={<Gauge />} label="Severity">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <Menu
                heading={cvssSeverity ? `CVSS rates it ${cvssSeverity}` : "Severity"}
                value={rating.severity}
                width={250}
                items={SEVERITIES.map((s) => ({
                  value: s,
                  label: (
                    <span className="flex items-center justify-between gap-3">
                      <SeverityLabel severity={s} />
                      <span className="font-mono text-[11px] text-ink-faint">
                        {RATING_SCALE.find((r) => r.severity === s)?.range.replace(" (None)", "")}
                      </span>
                    </span>
                  ),
                }))}
                onSelect={pickSeverity}
                trigger={({ toggle, ref, open }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label={`Severity: ${rating.severity}`}
                    className="rounded-md transition-opacity hover:opacity-85"
                  >
                    <SeverityBadge severity={rating.severity} />
                  </button>
                )}
              />
              <span className="text-[13px] text-ink-faint">
                {rating.source === "cvss" ? (
                  "from the CVSS score"
                ) : rating.source === "override" ? (
                  <>
                    adjusted from{" "}
                    <span className={SEVERITY_CLASS[rating.cvssSeverity ?? "Info"].text}>
                      {rating.cvssSeverity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOverride(rating.severity)}
                      className="ml-2 text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink"
                    >
                      Reason
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ override: null })}
                      className="ml-2 text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink"
                    >
                      Use CVSS
                    </button>
                  </>
                ) : (
                  "set by you"
                )}
              </span>
            </div>
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
                  aria-label={`Status: ${finding.status}`}
                  className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-0.5 text-[14px] hover:bg-hover"
                >
                  <span className={cx("size-2 rounded-full", STATUS_DOT[finding.status])} />
                  {finding.status}
                </button>
              )}
            />
          </Property>

          <Property icon={<Hash />} label="CVSS">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <InlineText
                value={finding.cvss}
                onChange={(cvss) => onChange({ cvss: cvss.replace(/\s+/g, "") })}
                placeholder="Paste a vector or a score"
                mono
                label="CVSS vector or score"
                fit
                invalid={cvssRead?.ok === false}
              />
              {cvssRead?.ok ? (
                <span
                  className={cx(
                    "shrink-0 font-mono text-[13px] font-semibold",
                    SEVERITY_CLASS[cvssRead.cvss.severity].text,
                  )}
                  title={cvssRead.cvss.nomenclature}
                >
                  {formatScore(cvssRead.cvss.score)}
                </span>
              ) : cvssRead ? (
                <span className="shrink-0 text-[12px] text-danger" title={cvssRead.error}>
                  Not a valid vector or score
                </span>
              ) : null}
            </div>
          </Property>

          {OPTIONAL.filter((p) => shown.has(p.key)).map((p) => (
            <Property key={p.key} icon={p.icon} label={p.label} onRemove={() => remove(p.key)}>
              {p.key === "endpoint" ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Menu
                    heading="Method"
                    value={finding.method as (typeof METHODS)[number]}
                    width={150}
                    items={METHODS.map((m) => ({
                      value: m,
                      label: <span className="font-mono">{m}</span>,
                    }))}
                    onSelect={(method) => onChange({ method })}
                    trigger={({ toggle, ref, open }) => (
                      <button
                        ref={ref}
                        type="button"
                        onClick={toggle}
                        aria-expanded={open}
                        aria-label="HTTP method"
                        className={cx(
                          "h-7 shrink-0 rounded-md border border-line-strong px-2 font-mono text-[11.5px] font-semibold hover:bg-hover",
                          finding.method ? "text-accent" : "text-ink-faint",
                        )}
                      >
                        {finding.method || "METHOD"}
                      </button>
                    )}
                  />
                  <InlineText
                    value={finding.endpoint}
                    onChange={(endpoint) => onChange({ endpoint })}
                    placeholder="https://app.example.com/api/invoices/{id}"
                    mono
                    label="Endpoint URL"
                    autoFocus={justAdded === "endpoint"}
                  />
                </div>
              ) : (
                <InlineText
                  value={finding[p.key]}
                  onChange={(v) => onChange({ [p.key]: v })}
                  placeholder={p.hint}
                  mono={p.key !== "affected"}
                  multiline={p.key === "affected"}
                  label={p.label}
                  autoFocus={justAdded === p.key}
                />
              )}
            </Property>
          ))}
        </dl>

        {hidden.length > 0 ? (
          <Menu
            heading="Add property"
            width={280}
            items={hidden.map((p) => ({
              value: p.key,
              label: p.label,
              hint: p.hint,
              icon: p.icon,
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

        {rating.source === "override" && finding.override?.reason ? (
          <p className="mt-4 rounded-lg border-l-2 border-line-strong bg-surface-1 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">Why {rating.severity}:</span>{" "}
            {finding.override.reason}
          </p>
        ) : null}

        <div className="mt-6 border-t border-line pt-7">
          <DocEditor
            key={finding.id}
            controller={editor}
            label="Finding write-up"
            projectId={finding.projectId}
            value={finding.body}
            onChange={(body) => onChange({ body })}
            placeholder="Describe the finding. Each ## heading becomes a section of the report."
          />
          <AddSections
            body={finding.body}
            sections={FINDING_SECTIONS}
            onAdd={(title) => editor.current?.addSection(title)}
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

      <OverrideDialog
        severity={override}
        onClose={() => setOverride(null)}
        finding={finding}
        cvssSeverity={cvssSeverity ?? rating.severity}
        onSave={(o) => onChange({ override: o })}
      />
    </div>
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

/**
 * Rating a scored finding differently from its CVSS score needs a reason; the
 * report prints both ratings and the reason.
 */
function OverrideDialog({
  severity,
  onClose,
  finding,
  cvssSeverity,
  onSave,
}: {
  /** The severity being chosen; the dialog is open while this is set. */
  severity: Severity | null;
  onClose: () => void;
  finding: Finding;
  cvssSeverity: Severity;
  onSave: (override: Finding["override"]) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (severity) setReason(finding.override?.reason ?? "");
  }, [severity, finding.override]);
  if (!severity) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      width={480}
      title={`Rate this finding ${severity}?`}
      description={
        <>
          Its CVSS score rates it{" "}
          <span className={SEVERITY_CLASS[cvssSeverity].text}>{cvssSeverity}</span>. Say why the
          context changes that; the report shows both ratings and your reason.
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
            disabled={reason.trim().length < 10}
            onClick={() => {
              onSave({ severity, reason: reason.trim() });
              onClose();
            }}
          >
            Rate {severity}
          </Button>
        </>
      }
    >
      <Field label="Reason" hint="At least a sentence. Printed in the report next to the rating.">
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
