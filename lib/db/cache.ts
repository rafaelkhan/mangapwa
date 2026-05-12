import { getDB, type CacheMetaEntry } from "./schema";

const IMAGE_CACHE = "manga-images-v1";
const DOWNLOAD_CACHE = "manga-downloads-v1";

export function imageCacheName(bucket: "auto" | "download"): string {
  return bucket === "download" ? DOWNLOAD_CACHE : IMAGE_CACHE;
}

export async function recordCached(entry: CacheMetaEntry): Promise<void> {
  const db = await getDB();
  await db.put("cache_meta", entry);
}

export async function listCacheByChapter(
  sourceId: string,
  mangaId: string,
  chapterId: string
): Promise<CacheMetaEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("cache_meta", "by-chapter", [
    sourceId,
    mangaId,
    chapterId,
  ]);
}

export async function totalCachedBytes(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll("cache_meta");
  return all.reduce((sum, e) => sum + e.size, 0);
}

export async function clearAutoCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(IMAGE_CACHE);
  const db = await getDB();
  const tx = db.transaction("cache_meta", "readwrite");
  const auto = await tx.store.index("by-bucket").getAllKeys("auto");
  await Promise.all(auto.map((k) => tx.store.delete(k)));
  await tx.done;
}

export async function evictLRUIfOverQuota(maxBytes: number): Promise<void> {
  const db = await getDB();
  const all = await db.getAllFromIndex("cache_meta", "by-bucket", "auto");
  let total = all.reduce((s, e) => s + e.size, 0);
  if (total <= maxBytes) return;
  const sorted = all.sort((a, b) => a.cachedAt - b.cachedAt);
  const cache =
    typeof caches !== "undefined" ? await caches.open(IMAGE_CACHE) : null;
  for (const entry of sorted) {
    if (total <= maxBytes) break;
    if (cache) await cache.delete(entry.url);
    await db.delete("cache_meta", entry.url);
    total -= entry.size;
  }
}
