import {
  getDB,
  downloadKey,
  type CacheMetaEntry,
  type DownloadedChapter,
} from "./schema";
import { imageCacheName } from "./cache";
import { buildPageSrc } from "@/lib/reader/prefetch";
import type { Page } from "@/lib/sources/types";

const BUCKET = "download" as const;

/**
 * Canonical URL a downloaded page is fetched and cached under. Always routed
 * through /api/proxy so the response is CORS-readable (accurate byte
 * accounting, no opaque-response quota penalty on iOS) and so the offline
 * cache key matches exactly what the reader requests.
 */
export function downloadSrc(page: Page): string {
  return buildPageSrc(page, true);
}

export async function getDownloadedChapter(
  sourceId: string,
  mangaId: string,
  chapterId: string
): Promise<DownloadedChapter | undefined> {
  const db = await getDB();
  return db.get("downloads", downloadKey(sourceId, mangaId, chapterId));
}

export async function isChapterDownloaded(
  sourceId: string,
  mangaId: string,
  chapterId: string
): Promise<boolean> {
  return !!(await getDownloadedChapter(sourceId, mangaId, chapterId));
}

export async function listDownloadsByManga(
  sourceId: string,
  mangaId: string
): Promise<DownloadedChapter[]> {
  const db = await getDB();
  return db.getAllFromIndex("downloads", "by-manga", [sourceId, mangaId]);
}

export async function downloadStats(): Promise<{
  chapters: number;
  bytes: number;
}> {
  const db = await getDB();
  const all = await db.getAll("downloads");
  return {
    chapters: all.length,
    bytes: all.reduce((sum, d) => sum + d.bytes, 0),
  };
}

/**
 * Fetch every page of a chapter and persist it into the durable download
 * cache bucket. Best-effort requests persistent storage first so iOS does not
 * evict explicit downloads. On any failure the partial download is rolled
 * back so a chapter is never half-downloaded.
 */
export async function downloadChapter(input: {
  sourceId: string;
  mangaId: string;
  chapterId: string;
  pages: Page[];
  onProgress?: (done: number, total: number) => void;
}): Promise<DownloadedChapter> {
  const { sourceId, mangaId, chapterId, pages } = input;
  if (typeof caches === "undefined") {
    throw new Error("Cache Storage unavailable");
  }
  if (pages.length === 0) {
    throw new Error("Chapter has no pages");
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Persistence is best-effort; downloading still works without it.
  }

  const db = await getDB();
  const cache = await caches.open(imageCacheName(BUCKET));
  const pageUrls: string[] = [];
  let bytes = 0;
  const total = pages.length;

  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const src = downloadSrc(page);
      const res = await fetch(src);
      if (!res.ok) {
        throw new Error(`Page ${page.index + 1} failed (HTTP ${res.status})`);
      }
      const buf = await res.arrayBuffer();
      const size = buf.byteLength;
      const stored = new Response(buf, {
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        },
      });
      await cache.put(src, stored);
      const meta: CacheMetaEntry = {
        url: src,
        sourceId,
        mangaId,
        chapterId,
        size,
        cachedAt: Date.now(),
        bucket: BUCKET,
      };
      await db.put("cache_meta", meta);
      pageUrls.push(src);
      bytes += size;
      input.onProgress?.(i + 1, total);
    }

    const entry: DownloadedChapter = {
      key: downloadKey(sourceId, mangaId, chapterId),
      sourceId,
      mangaId,
      chapterId,
      pageUrls,
      downloadedAt: Date.now(),
      bytes,
    };
    await db.put("downloads", entry);
    return entry;
  } catch (err) {
    // Roll back the partial download so it never reads as available offline.
    await Promise.all(
      pageUrls.map(async (u) => {
        await cache.delete(u);
        await db.delete("cache_meta", u);
      })
    );
    throw err;
  }
}

export async function deleteDownload(
  sourceId: string,
  mangaId: string,
  chapterId: string
): Promise<void> {
  const db = await getDB();
  const key = downloadKey(sourceId, mangaId, chapterId);
  const entry = await db.get("downloads", key);
  if (!entry) return;
  if (typeof caches !== "undefined") {
    const cache = await caches.open(imageCacheName(BUCKET));
    await Promise.all(entry.pageUrls.map((u) => cache.delete(u)));
  }
  await Promise.all(entry.pageUrls.map((u) => db.delete("cache_meta", u)));
  await db.delete("downloads", key);
}

export async function clearAllDownloads(): Promise<void> {
  if (typeof caches !== "undefined") {
    await caches.delete(imageCacheName(BUCKET));
  }
  const db = await getDB();
  const tx = db.transaction(["downloads", "cache_meta"], "readwrite");
  await tx.objectStore("downloads").clear();
  const metaStore = tx.objectStore("cache_meta");
  const downloadKeys = await metaStore
    .index("by-bucket")
    .getAllKeys(BUCKET);
  await Promise.all(downloadKeys.map((k) => metaStore.delete(k)));
  await tx.done;
}
