import { findingGaps } from "../../domain/completeness";
import type { Finding, Project } from "../../domain/types";
import { findSection, splitSections } from "../../markdown/sections";
import { href } from "../../state/router";

export interface Check {
  ok: boolean;
  label: string;
  /** Where to fix it, for a check that has not passed. */
  link?: string;
}

/** What a reader would miss in the report as it stands, and what is already in place. */
export function reportChecks(
  project: Project,
  findings: Finding[],
  refs: Map<string, string>,
): Check[] {
  const list: Check[] = [];
  const details = href({ name: "project", projectId: project.id, view: "details" });
  list.push({ ok: !!project.preparedBy.trim(), label: "“Prepared by” is set" });
  list.push({
    ok: !!findSection(splitSections(project.body), /summary/i),
    label: "Executive summary is written",
    link: details,
  });
  for (const f of findings) {
    const gaps = findingGaps(f);
    if (gaps.length > 0) {
      list.push({
        ok: false,
        label: `${refs.get(f.id) ?? ""} needs ${gaps.join(", ")}`,
        link: href({ name: "finding", projectId: project.id, findingId: f.id }),
      });
    }
  }
  if (findings.length > 0 && list.every((c) => c.ok)) {
    list.push({
      ok: true,
      label:
        findings.length === 1
          ? "The finding is complete"
          : `All ${findings.length} findings are complete`,
    });
  }
  return list;
}
