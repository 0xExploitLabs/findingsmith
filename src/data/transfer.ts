import { APP_NAME } from "../brand";
import { createProject, newId, normalizeFinding, normalizeProject } from "../domain/factories";
import type { Asset, Finding, Project } from "../domain/types";
import { blobToDataUrl, dataUrlToBlob } from "./assets";
import { listAssets, listFindings, putProjectBundle } from "./db";

// The marker predates the name Findingsmith; it stays, so older project files still open.
const FORMAT = "debrief-project";
const FORMAT_VERSION = 1;

interface ExportedAsset extends Omit<Asset, "blob"> {
  data: string;
}

interface ProjectFile {
  format: typeof FORMAT;
  formatVersion: number;
  exportedAt: string;
  project: Project;
  findings: Finding[];
  assets: ExportedAsset[];
}

export async function exportProject(project: Project): Promise<Blob> {
  const [findings, assets] = await Promise.all([listFindings(project.id), listAssets(project.id)]);
  const file: ProjectFile = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    findings,
    assets: await Promise.all(
      assets.map(async ({ blob, ...meta }) => ({ ...meta, data: await blobToDataUrl(blob) })),
    ),
  };
  return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
}

/**
 * Imports a project file as a new project. Every id is regenerated, so the
 * same file can be imported twice without overwriting anything, and asset
 * references inside the Markdown are rewritten to the new ids.
 */
export async function importProject(text: string): Promise<Project> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const file = parsed as Partial<ProjectFile>;
  if (file.format !== FORMAT || !file.project || !Array.isArray(file.findings)) {
    throw new Error(`This is not a ${APP_NAME} project file.`);
  }
  if ((file.formatVersion ?? 0) > FORMAT_VERSION) {
    throw new Error(`This file was made by a newer version of ${APP_NAME}.`);
  }

  const assetIds = new Map<string, string>();
  for (const a of file.assets ?? []) assetIds.set(a.id, newId());
  const remap = (md: string) =>
    md.replace(/asset:([0-9a-f-]{36})/g, (whole, id: string) => {
      const next = assetIds.get(id);
      return next ? `asset:${next}` : whole;
    });

  const now = new Date().toISOString();
  const base = normalizeProject({ ...createProject("Imported project"), ...file.project });
  const project: Project = {
    ...base,
    id: newId(),
    body: remap(base.body),
    logoAssetId: base.logoAssetId ? (assetIds.get(base.logoAssetId) ?? null) : null,
    createdAt: now,
    updatedAt: now,
  };
  const findings = file.findings.map((raw, i) => {
    const f = normalizeFinding({ ...raw, projectId: project.id, order: raw.order ?? i });
    const next: Finding = { ...f, id: newId(), projectId: project.id };
    return { ...next, body: remap(f.body), notes: remap(f.notes) };
  });
  const assets: Asset[] = await Promise.all(
    (file.assets ?? []).map(async ({ data, ...meta }) => ({
      ...meta,
      id: assetIds.get(meta.id) as string,
      projectId: project.id,
      blob: await dataUrlToBlob(data),
    })),
  );
  await putProjectBundle(project, findings, assets);
  return project;
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\p{L}\p{N}._ -]+/gu, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "report"
  );
}
