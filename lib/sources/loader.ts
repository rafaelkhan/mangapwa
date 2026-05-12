import { RepoManifestSchema, type Source, type SourceFactory } from "./types";
import { createSourceContext } from "./sandbox";

export interface ParsedRepoRef {
  owner: string;
  repo: string;
  ref: string;
}

export function parseGitHubUrl(input: string): ParsedRepoRef {
  let cleaned = input.trim();
  cleaned = cleaned.replace(/\.git$/, "");
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    throw new Error("Not a valid URL");
  }
  if (
    url.hostname !== "github.com" &&
    url.hostname !== "www.github.com" &&
    url.hostname !== "cdn.jsdelivr.net"
  ) {
    throw new Error("Only github.com or cdn.jsdelivr.net URLs are supported");
  }
  if (url.hostname === "cdn.jsdelivr.net") {
    const m = url.pathname.match(/^\/gh\/([^/]+)\/([^/@]+)@([^/]+)/);
    if (!m) throw new Error("Unrecognized jsDelivr URL");
    return { owner: m[1], repo: m[2], ref: m[3] };
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Missing owner/repo in URL");
  const [owner, repo, ...rest] = parts;
  let ref = "HEAD";
  if (rest[0] === "tree" && rest[1]) ref = rest[1];
  else if (rest[0] === "commit" && rest[1]) ref = rest[1];
  return { owner, repo, ref };
}

export function jsDelivrBase(ref: ParsedRepoRef): string {
  return `https://cdn.jsdelivr.net/gh/${ref.owner}/${ref.repo}@${ref.ref}`;
}

export async function resolveCommitSha(
  ref: ParsedRepoRef
): Promise<ParsedRepoRef> {
  if (/^[0-9a-f]{7,40}$/i.test(ref.ref)) return ref;
  const api = `https://api.github.com/repos/${ref.owner}/${ref.repo}/commits/${
    ref.ref === "HEAD" ? "" : ref.ref
  }`;
  const url = ref.ref === "HEAD"
    ? `https://api.github.com/repos/${ref.owner}/${ref.repo}/commits/HEAD`
    : api;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(`GitHub API failed: ${res.status}`);
  }
  const json = (await res.json()) as { sha: string };
  return { ...ref, ref: json.sha };
}

export async function fetchRepoManifest(ref: ParsedRepoRef) {
  const url = `${jsDelivrBase(ref)}/manifest.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
  const json = await res.json();
  return RepoManifestSchema.parse(json);
}

const loadedSources = new Map<string, Source>();

export function getLoadedSource(sourceId: string): Source | undefined {
  return loadedSources.get(sourceId);
}

export function clearLoadedSources(): void {
  loadedSources.clear();
}

export async function loadSource(
  ref: ParsedRepoRef,
  manifestSource: {
    id: string;
    name: string;
    lang: string;
    version: string;
    nsfw: boolean;
    iconUrl?: string;
    entry: string;
  }
): Promise<Source> {
  const cached = loadedSources.get(manifestSource.id);
  if (cached) return cached;
  const entryRel = manifestSource.entry.replace(/^\.\//, "");
  const entryUrl = `${jsDelivrBase(ref)}/${entryRel}`;
  const mod = (await import(/* webpackIgnore: true */ entryUrl)) as {
    default?: SourceFactory;
  };
  if (typeof mod.default !== "function") {
    throw new Error(`Source ${manifestSource.id} has no default export factory`);
  }
  const ctx = createSourceContext();
  const source = mod.default(ctx);
  if (!source || source.manifest?.id !== manifestSource.id) {
    throw new Error(
      `Source ${manifestSource.id} manifest mismatch (got ${source?.manifest?.id})`
    );
  }
  const required: (keyof Source)[] = [
    "search",
    "getPopular",
    "getLatest",
    "getDetails",
    "getPages",
  ];
  for (const k of required) {
    if (typeof source[k] !== "function") {
      throw new Error(`Source ${manifestSource.id} missing method ${k}`);
    }
  }
  loadedSources.set(manifestSource.id, source);
  return source;
}
