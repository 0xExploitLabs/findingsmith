import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { normalizeFinding, normalizeProject } from "../domain/factories";
import type { Asset, Finding, Project } from "../domain/types";

/**
 * Everything lives in this browser's IndexedDB. Nothing is sent anywhere.
 * IndexedDB rather than localStorage because reports carry screenshots, and
 * localStorage is capped at a few megabytes of strings per origin.
 */
interface AppDB extends DBSchema {
  projects: { key: string; value: Project };
  findings: { key: string; value: Finding; indexes: { projectId: string } };
  assets: { key: string; value: Asset; indexes: { projectId: string } };
}

// The tool was first called Debrief. Stored data keeps that name, so a rename loses nothing.
const DB_NAME = "debrief";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

function db(): Promise<IDBPDatabase<AppDB>> {
  dbPromise ??= openDB<AppDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore("projects", { keyPath: "id" });
      database
        .createObjectStore("findings", { keyPath: "id" })
        .createIndex("projectId", "projectId");
      database.createObjectStore("assets", { keyPath: "id" }).createIndex("projectId", "projectId");
    },
  });
  return dbPromise;
}

/** Asks the browser not to evict this origin's data under storage pressure. */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Not supported or refused; data still persists under normal conditions.
  }
}

export async function listProjects(): Promise<Project[]> {
  const all = await (await db()).getAll("projects");
  return all.map(normalizeProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const p = await (await db()).get("projects", id);
  return p ? normalizeProject(p) : undefined;
}

export async function putProject(project: Project): Promise<void> {
  await (await db()).put("projects", project);
}

export async function deleteProject(id: string): Promise<void> {
  const tx = (await db()).transaction(["projects", "findings", "assets"], "readwrite");
  await tx.objectStore("projects").delete(id);
  for (const store of ["findings", "assets"] as const) {
    const keys = await tx.objectStore(store).index("projectId").getAllKeys(id);
    for (const key of keys) await tx.objectStore(store).delete(key);
  }
  await tx.done;
}

export async function listFindings(projectId: string): Promise<Finding[]> {
  const all = await (await db()).getAllFromIndex("findings", "projectId", projectId);
  return all.map(normalizeFinding).sort((a, b) => a.order - b.order);
}

export async function countFindings(projectId: string): Promise<number> {
  return (await db()).countFromIndex("findings", "projectId", projectId);
}

export async function putFinding(finding: Finding): Promise<void> {
  await (await db()).put("findings", finding);
}

export async function putFindings(findings: Finding[]): Promise<void> {
  const tx = (await db()).transaction("findings", "readwrite");
  await Promise.all([...findings.map((f) => tx.store.put(f)), tx.done]);
}

export async function deleteFinding(id: string): Promise<void> {
  await (await db()).delete("findings", id);
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  return (await db()).get("assets", id);
}

export async function listAssets(projectId: string): Promise<Asset[]> {
  return (await db()).getAllFromIndex("assets", "projectId", projectId);
}

export async function putAsset(asset: Asset): Promise<void> {
  await (await db()).put("assets", asset);
}

/** Writes a whole project in one transaction, used by import. */
export async function putProjectBundle(
  project: Project,
  findings: Finding[],
  assets: Asset[],
): Promise<void> {
  const tx = (await db()).transaction(["projects", "findings", "assets"], "readwrite");
  await tx.objectStore("projects").put(project);
  for (const f of findings) await tx.objectStore("findings").put(f);
  for (const a of assets) await tx.objectStore("assets").put(a);
  await tx.done;
}
