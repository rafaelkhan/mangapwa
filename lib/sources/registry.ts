import { getDB, type InstalledRepo } from "@/lib/db/schema";
import {
  fetchRepoManifest,
  parseGitHubUrl,
  resolveCommitSha,
  loadSource,
  getLoadedSource,
} from "./loader";
import type { Source } from "./types";

export async function listRepos(): Promise<InstalledRepo[]> {
  const db = await getDB();
  return db.getAll("repos");
}

export async function installRepo(repoUrl: string): Promise<InstalledRepo> {
  const parsed = parseGitHubUrl(repoUrl);
  const pinned = await resolveCommitSha(parsed);
  const manifest = await fetchRepoManifest(pinned);
  const entry: InstalledRepo = {
    repoUrl,
    owner: pinned.owner,
    repo: pinned.repo,
    ref: pinned.ref,
    installedAt: Date.now(),
    manifest,
  };
  const db = await getDB();
  await db.put("repos", entry);
  return entry;
}

export async function uninstallRepo(repoUrl: string): Promise<void> {
  const db = await getDB();
  await db.delete("repos", repoUrl);
}

export async function updateRepo(repoUrl: string): Promise<InstalledRepo> {
  const db = await getDB();
  const existing = await db.get("repos", repoUrl);
  if (!existing) throw new Error("Repo not installed");
  return installRepo(repoUrl);
}

export async function findRepoForSource(
  sourceId: string
): Promise<{ repo: InstalledRepo; source: InstalledRepo["manifest"]["sources"][number] } | null> {
  const repos = await listRepos();
  for (const r of repos) {
    const s = r.manifest.sources.find((s) => s.id === sourceId);
    if (s) return { repo: r, source: s };
  }
  return null;
}

export async function getSource(sourceId: string): Promise<Source> {
  const cached = getLoadedSource(sourceId);
  if (cached) return cached;
  const found = await findRepoForSource(sourceId);
  if (!found) throw new Error(`Source ${sourceId} not installed`);
  return loadSource(
    { owner: found.repo.owner, repo: found.repo.repo, ref: found.repo.ref },
    found.source
  );
}

export async function listInstalledSources(): Promise<
  Array<{
    repoUrl: string;
    id: string;
    name: string;
    lang: string;
    version: string;
    nsfw: boolean;
    iconUrl?: string;
  }>
> {
  const repos = await listRepos();
  return repos.flatMap((r) =>
    r.manifest.sources.map((s) => ({
      repoUrl: r.repoUrl,
      id: s.id,
      name: s.name,
      lang: s.lang,
      version: s.version,
      nsfw: s.nsfw,
      iconUrl: s.iconUrl,
    }))
  );
}
