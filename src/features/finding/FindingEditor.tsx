import {
  Bug,
  CircleCheck,
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
import { memo, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { findingGaps, listInWords } from "../../domain/completeness";
import { formatScore, readCvss } from "../../domain/cvss";
import { rate } from "../../domain/severity";
import {
  type Finding,
  PROPERTIES,
  type PropertyKey,
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
import { useEvent } from "../../ui/useEvent";
import { AddSections, InlineText, Property, Title } from "../doc/DocParts";
import { type DocController, DocEditor } from "../editor/DocEditor";
import { CvssCalculator } from "./CvssCalculator";

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

/** What to write under each section while it is still empty. */
const FINDING_HINTS = {
  description: "What is wrong and where, in a paragraph or two.",
  impact: "What an attacker gains, and what that costs the business.",
  "steps to reproduce":
    "The first step. One per line, with requests, responses and screenshots as evidence.",
  "request and response": "Type /request for a request and response pair.",
  remediation: "How to fix it, the most effective measure first.",
  references: "Links to the weakness, the standard or the vendor advisory.",
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

/**
 * How each property besides severity and status is shown. Any of them can be
 * removed and added back from the picker. Each shows a real value as its
 * example, never an instruction.
 */
const PROPERTY: Record<PropertyKey, { label: string; icon: ReactNode; example: string }> = {
  cvss: { label: "CVSS", icon: <Hash />, example: "CVSS:3.1/AV:N/…" },
  endpoint: { label: "Endpoint", icon: <Link2 />, example: "GET /api/invoices/{id}" },
  parameter: { label: "Parameter", icon: <SlidersHorizontal />, example: "invoice_id" },
  host: { label: "Host", icon: <Server />, example: "app.example.com" },
  port: { label: "Port", icon: <Plug />, example: "443" },
  affected: { label: "Affected", icon: <Layers />, example: "api.example.com" },
  cwe: { label: "CWE", icon: <Bug />, example: "CWE-79" },
  cve: { label: "CVE", icon: <ShieldAlert />, example: "CVE-2021-44228" },
};

/** Everything of a finding that typing its write-up does not change. */
function sameButText(a: Finding, b: Finding): boolean {
  for (const key of Object.keys(a) as (keyof Finding)[]) {
    if (key !== "body" && key !== "notes" && key !== "updatedAt" && a[key] !== b[key]) return false;
  }
  return true;
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
  const editor = useRef<DocController | null>(null);
  // The head is rendered again only when its own fields change, so its
  // callbacks keep one identity and still act on the finding as it is now.
  const change = useEvent(onChange);
  const duplicate = useEvent(onDuplicate);
  const remove = useEvent(onDelete);
  const toggleNotes = useCallback(() => setNotesOpen((o) => !o), []);

  // What the finding still needs is read from the write-up, which means
  // parsing it: that waits for a pause in the typing.
  const { title, body, cvss, manualSeverity, properties } = finding;
  const [gaps, setGaps] = useState(() => findingGaps(finding));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(
      () =>
        setGaps((before) => {
          const now = findingGaps({ title, body, cvss, manualSeverity, properties });
          return now.join() === before.join() ? before : now;
        }),
      350,
    );
    return () => clearTimeout(timer);
  }, [title, body, cvss, manualSeverity, properties]);

  return (
    <div className="flex min-h-full">
      <article className="mx-auto w-full min-w-0 max-w-[800px] px-6 pb-10 pt-10 sm:px-14">
        <Head
          finding={finding}
          reference={reference}
          gaps={gaps}
          notesOpen={notesOpen}
          onToggleNotes={toggleNotes}
          onChange={change}
          onDuplicate={duplicate}
          onDelete={remove}
        />

        <div className="mt-6 border-t border-line pt-7">
          <DocEditor
            key={finding.id}
            controller={editor}
            label="Finding write-up"
            projectId={finding.projectId}
            value={finding.body}
            onChange={(body) => onChange({ body })}
            placeholder="Describe the finding. Each ## heading becomes a section of the report."
            hints={FINDING_HINTS}
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
    </div>
  );
}

interface HeadProps {
  finding: Finding;
  reference: string;
  gaps: string[];
  notesOpen: boolean;
  onToggleNotes: () => void;
  onChange: (patch: Partial<Finding>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** A finding above its write-up: its number, title and properties. */
const Head = memo(
  function Head({
    finding,
    reference,
    gaps,
    notesOpen,
    onToggleNotes,
    onChange,
    onDuplicate,
    onDelete,
  }: HeadProps) {
    const [override, setOverride] = useState<Severity | null>(null);
    const [justAdded, setJustAdded] = useState<PropertyKey | null>(null);
    const [calculating, setCalculating] = useState(false);
    const rating = rate(finding);
    const cvssRead = finding.cvss.trim() ? readCvss(finding.cvss) : null;
    const cvssSeverity = rating.cvssSeverity;

    const pickSeverity = (s: Severity) => {
      if (!cvssSeverity) onChange({ manualSeverity: s });
      else if (s === cvssSeverity) onChange({ override: null });
      else setOverride(s);
    };

    const shown = PROPERTIES.filter((key) => finding.properties.includes(key));
    const hidden = PROPERTIES.filter((key) => !finding.properties.includes(key));

    const add = (key: PropertyKey) => {
      onChange({ properties: [...finding.properties, key] });
      setJustAdded(key);
    };

    /** A removed property is emptied too, so the report leaves it out. */
    const remove = (key: PropertyKey) => {
      const properties = finding.properties.filter((k) => k !== key);
      if (key === "cvss") {
        // The finding keeps the severity it has, now rated by hand.
        onChange({ properties, cvss: "", override: null, manualSeverity: rating.severity });
      } else if (key === "endpoint") {
        onChange({ properties, endpoint: "", method: "" });
      } else {
        onChange({ properties, [key]: "" });
      }
    };

    return (
      <>
        {calculating ? (
          <CvssCalculator
            open
            vector={finding.cvss}
            onClose={() => setCalculating(false)}
            onUse={(cvss) => {
              onChange({ cvss });
              setCalculating(false);
            }}
          />
        ) : null}
        <div className="mb-4 flex items-center gap-2">
          <span
            className={cx(
              "shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[12px] font-semibold",
              SEVERITY_CLASS[rating.severity].soft,
              SEVERITY_CLASS[rating.severity].text,
            )}
          >
            {reference}
          </span>
          <span
            className={cx(
              "flex min-w-0 items-center gap-1.5 text-[12.5px] [&_svg]:size-3.5 [&_svg]:shrink-0",
              gaps.length > 0 ? "text-ink-faint" : "text-ok",
            )}
          >
            {gaps.length > 0 ? null : <CircleCheck />}
            <span className="truncate">
              {gaps.length > 0 ? `Needs ${listInWords(gaps)}` : "Ready for the report"}
            </span>
          </span>
          <div className="flex-1" />
          <IconButton
            label={notesOpen ? "Hide private notes" : "Private notes"}
            onClick={onToggleNotes}
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
                heading={cvssSeverity ? `CVSS rates it ${cvssSeverity}` : undefined}
                value={rating.severity}
                width={188}
                items={SEVERITIES.map((s) => ({
                  value: s,
                  label: (
                    <span className="flex items-center gap-2.5">
                      <span className={cx("size-2 rounded-full", SEVERITY_CLASS[s].dot)} />
                      {s}
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
              value={finding.status}
              width={188}
              items={STATUSES.map((s) => ({
                value: s,
                label: (
                  <span className="flex items-center gap-2.5">
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

          {shown.map((key) => (
            <Property
              key={key}
              icon={PROPERTY[key].icon}
              label={PROPERTY[key].label}
              onRemove={() => remove(key)}
            >
              {key === "cvss" ? (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <InlineText
                    value={finding.cvss}
                    onChange={(cvss) => onChange({ cvss: cvss.replace(/\s+/g, "") })}
                    placeholder="CVSS:3.1/AV:N/AC:L/… or 9.8"
                    mono
                    label="CVSS vector or score"
                    fit
                    multiline
                    className="break-all"
                    invalid={cvssRead?.ok === false}
                    autoFocus={justAdded === "cvss"}
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
                  <button
                    type="button"
                    onClick={() => setCalculating(true)}
                    className="btn btn-raised h-7 shrink-0 rounded-lg border border-line-strong bg-surface-1 px-2.5 text-[12.5px] text-ink-muted hover:border-line-hover hover:text-ink"
                  >
                    Calculate
                  </button>
                </div>
              ) : key === "endpoint" ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Menu
                    value={finding.method as (typeof METHODS)[number]}
                    width={140}
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
                          "h-7 shrink-0 rounded-md border border-line-strong px-2 transition-colors duration-(--dur-micro) hover:bg-hover",
                          finding.method
                            ? "font-mono text-[12px] font-semibold text-accent"
                            : "text-[13px] text-ink-faint",
                        )}
                      >
                        {finding.method || "Method"}
                      </button>
                    )}
                  />
                  <InlineText
                    value={finding.endpoint}
                    onChange={(endpoint) => onChange({ endpoint })}
                    placeholder="/api/invoices/{id}"
                    mono
                    label="Endpoint URL"
                    autoFocus={justAdded === "endpoint"}
                  />
                </div>
              ) : (
                <InlineText
                  value={finding[key]}
                  onChange={(v) => onChange({ [key]: v })}
                  placeholder={PROPERTY[key].example}
                  mono={key !== "affected"}
                  multiline={key === "affected"}
                  label={PROPERTY[key].label}
                  autoFocus={justAdded === key}
                />
              )}
            </Property>
          ))}
        </dl>

        {hidden.length > 0 ? (
          <Menu
            width={260}
            items={hidden.map((key) => ({
              value: key,
              label: PROPERTY[key].label,
              icon: PROPERTY[key].icon,
              detail: <span className="font-mono text-[11.5px]">{PROPERTY[key].example}</span>,
            }))}
            onSelect={add}
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
          <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-[13.5px] leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">Why {rating.severity}:</span>{" "}
            {finding.override.reason}
          </p>
        ) : null}
        <OverrideDialog
          severity={override}
          onClose={() => setOverride(null)}
          finding={finding}
          cvssSeverity={cvssSeverity ?? rating.severity}
          onSave={(o) => onChange({ override: o })}
        />
      </>
    );
  },
  (a, b) =>
    a.reference === b.reference &&
    a.gaps === b.gaps &&
    a.notesOpen === b.notesOpen &&
    sameButText(a.finding, b.finding),
);

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
