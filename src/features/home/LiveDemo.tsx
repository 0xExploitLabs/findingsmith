import { ArrowRight } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as db from "../../data/db";
import { formatScore, readCvss } from "../../domain/cvss";
import { createFinding, createProject, newId } from "../../domain/factories";
import { SEVERITY_HEX } from "../../domain/severity";
import { splitSections } from "../../markdown/sections";
import { navigate } from "../../state/router";
import { cx } from "../../ui/primitives";
import { DocEditor } from "../editor/DocEditor";
import { Preview } from "../editor/Preview";

const TITLE = "SQL injection in the login form";
const VECTOR = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";
const REQUEST =
  "```http\nPOST /login HTTP/1.1\nHost: app.example.com\n\nusername=admin'--&password=x\n```";
const BODY = `## Description

The login form builds its SQL query by joining user input into the query text, so anything typed into \`username\` runs as SQL.

## Steps to reproduce

1. Open the login page.
2. Send the request below. The response is the admin dashboard.

${REQUEST}

## Remediation

Use **parameterised queries** for every database call.
`;

/** The sample text in the pieces it is typed in: words, and the request as one block. */
const CHUNKS = BODY.split(REQUEST).flatMap((part, i, all) => [
  ...(part.match(/\s*\S+\s*/g) ?? []),
  ...(i < all.length - 1 ? [REQUEST] : []),
]);

const SCORES = ["9.8", "7.5", "5.3", "2.1"];

/**
 * The product, working, on the first screen: a real editor on the left and the
 * report page it produces on the right. The sample types itself in until the
 * visitor touches it; from then on it is theirs to edit and to keep.
 */
export function LiveDemo() {
  const projectId = useRef(newId()).current;
  const [title, setTitle] = useState(TITLE);
  const [cvss, setCvss] = useState(VECTOR);
  const [body, setBody] = useState("");
  const [typed, setTyped] = useState(0);
  const typing = typed < CHUNKS.length;

  // The sample types itself, a word at a time, unless motion is unwelcome.
  useEffect(() => {
    if (!typing) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(CHUNKS.length);
      setBody(BODY);
      return;
    }
    const timer = setTimeout(
      () => {
        setTyped((n) => n + 1);
        setBody(CHUNKS.slice(0, typed + 1).join(""));
      },
      typed === 0 ? 700 : 55,
    );
    return () => clearTimeout(timer);
  }, [typed, typing]);

  /** The first touch hands the document over, complete. */
  const takeOver = () => {
    if (!typing) return;
    setTyped(CHUNKS.length);
    setBody(BODY);
  };

  const read = cvss.trim() ? readCvss(cvss.trim()) : null;
  const score = read?.ok ? read.cvss : null;
  const sections = useMemo(() => splitSections(body), [body]);

  const keep = async () => {
    const project = { ...createProject("My first report"), id: projectId };
    const finding = {
      ...createFinding(projectId, 0),
      title,
      cvss: cvss.trim(),
      body: typing ? BODY : body,
    };
    await db.putProject(project);
    await db.putFinding(finding);
    navigate({ name: "finding", projectId, findingId: finding.id });
  };

  return (
    <section
      aria-label="Try it: edit the finding and watch the report page change"
      className="grid overflow-hidden rounded-2xl border border-line-strong lg:grid-cols-2"
      onPointerDownCapture={takeOver}
      onKeyDownCapture={takeOver}
    >
      <div className="flex min-w-0 flex-col bg-surface-1">
        <PaneHead
          name="Editor"
          hint={typing ? "Writing a sample finding" : "Yours now: edit anything"}
        />
        <div className="px-6 pt-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Finding title"
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-transparent text-[22px] font-semibold tracking-[-0.02em] text-ink outline-none placeholder:text-ink-faint"
            placeholder="Untitled finding"
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-4">
            <label className="flex min-w-0 flex-1 basis-full items-center gap-3 text-[13px] text-ink-faint sm:basis-0">
              CVSS
              <input
                value={cvss}
                onChange={(e) => setCvss(e.target.value.replace(/\s+/g, ""))}
                aria-label="CVSS vector or score"
                aria-invalid={read?.ok === false || undefined}
                spellCheck={false}
                autoComplete="off"
                placeholder="Paste a vector or a score"
                className={cx(
                  "min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 font-mono text-[12.5px] outline-none hover:bg-hover focus:bg-hover",
                  read?.ok === false ? "text-danger" : "text-ink",
                )}
              />
            </label>
            <fieldset className="flex items-center gap-1">
              <legend className="sr-only">Try another score</legend>
              {SCORES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCvss(s)}
                  aria-pressed={cvss === s}
                  className={cx(
                    "h-7 rounded-md border px-2 font-mono text-[12px] tabular-nums transition-colors duration-(--dur-micro)",
                    cvss === s
                      ? "border-line-hover bg-surface-3 text-ink"
                      : "border-line-strong text-ink-muted hover:bg-hover hover:text-ink",
                  )}
                >
                  {s}
                </button>
              ))}
            </fieldset>
          </div>
        </div>
        <div className="notes-editor h-[340px] overflow-y-auto px-6 pt-3">
          <DocEditor
            label="Sample finding"
            projectId={projectId}
            value={body}
            onChange={setBody}
            placeholder="Describe the finding. Each ## heading becomes a section of the report."
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3">
          <p className="text-[12.5px] text-ink-faint">Type / on an empty line for blocks.</p>
          <button
            type="button"
            onClick={() => void keep()}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-accent transition-colors duration-(--dur-micro) hover:bg-hover [&_svg]:size-3.5"
          >
            Keep this as my first project
            <ArrowRight />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col border-t border-line-strong bg-surface-2 lg:border-l lg:border-t-0">
        <PaneHead name="Report page" hint="Updates as you type" />
        <div className="h-[494px] overflow-y-auto px-6 py-6 sm:px-10">
          <article className="sheet mx-auto min-h-[560px] max-w-[460px] rounded-[2px] bg-sheet px-8 py-7 shadow-page">
            <div className="flex justify-between gap-4 border-b border-line pb-2 text-[10px] text-ink-faint">
              <span>Northwind Traders / External web application test</span>
              <span className="font-semibold text-accent">Confidential</span>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <span className="font-mono text-[10.5px] font-semibold text-accent">F-01</span>
              {score ? (
                <span
                  key={score.severity}
                  className="animate-in rounded-[3px] px-1.5 py-px text-[10px] font-semibold text-sheet"
                  style={{ backgroundColor: SEVERITY_HEX[score.severity] }}
                >
                  {score.severity}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1.5 text-[19px] font-semibold leading-tight tracking-[-0.015em] text-ink">
              {title || "Untitled finding"}
            </h3>
            {score ? (
              <div className="mt-3 flex overflow-hidden rounded-[4px] border border-line">
                <div
                  className="w-[84px] shrink-0 px-3 py-2 transition-colors duration-(--dur-short)"
                  style={{ backgroundColor: `${SEVERITY_HEX[score.severity]}1f` }}
                >
                  <div className="text-[9.5px] text-ink-muted">{score.nomenclature}</div>
                  <div
                    key={score.score}
                    className="animate-rise text-[24px] font-semibold leading-none tabular-nums"
                    style={{ color: SEVERITY_HEX[score.severity] }}
                  >
                    {formatScore(score.score)}
                  </div>
                </div>
                <div className="min-w-0 flex-1 px-3 py-2">
                  <div className="text-[9.5px] text-ink-muted">
                    {score.vector ? "Vector" : "Base score"}
                  </div>
                  <div className="mt-1 break-all font-mono text-[9.5px] leading-snug text-ink">
                    {score.vector ?? "As reported by the assessor."}
                  </div>
                </div>
              </div>
            ) : null}
            {sections.map((s) => (
              <div key={s.title} className="animate-rise mt-4">
                {s.title ? (
                  <h4 className="text-[11px] font-semibold text-accent">{s.title}</h4>
                ) : null}
                <Preview source={s.markdown} className="sheet-prose mt-1" />
              </div>
            ))}
          </article>
        </div>
      </div>
    </section>
  );
}

function PaneHead({ name, hint }: { name: string; hint: string }) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-6 text-[13px]">
      <span className="font-semibold text-ink">{name}</span>
      <span className="truncate text-ink-faint" aria-live="polite">
        {hint}
      </span>
    </div>
  );
}

/** A delay for staggered entrances, in seconds. */
export const after = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;
