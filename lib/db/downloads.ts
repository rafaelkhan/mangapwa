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

export interface DownloadedChapterSummary {
  chapterId: string;
  chapterNumber?: number;
  chapterTitle?: string;
  bytes: number;
  downloadedAt: number;
}

export interface DownloadedMangaGroup {
  sourceId: string;
  mangaId: string;
  mangaTitle: string;
  bytes: number;
  chapters: DownloadedChapterSummary[];
}

/**
 * All downloads grouped by manga, sorted for display. Pure IndexedDB — never
 * touches a source or the network, so it works fully offline and backs the
 * /downloads entry point.
 */
export async function listDownloadedManga(): Promise<DownloadedMangaGroup[]> {
  const db = await getDB();
  const all = await db.getAll("downloads");
  const groups = new Map<string, DownloadedMangaGroup>();
  for (const d of all) {
    const gk = `${d.sourceId}::${d.mangaId}`;
    let g = groups.get(gk);
    if (!g) {
      g = {
        sourceId: d.sourceId,
        mangaId: d.mangaId,
        mangaTitle: d.mangaTitle ?? d.mangaId,
        bytes: 0,
        chapters: [],
      };
      groups.set(gk, g);
    } else if (d.mangaTitle && g.mangaTitle === d.mangaId) {
      g.mangaTitle = d.mangaTitle;
    }
    g.bytes += d.bytes;
    g.chapters.push({
      chapterId: d.chapterId,
      chapterNumber: d.chapterNumber,
      chapterTitle: d.chapterTitle,
      bytes: d.bytes,
      downloadedAt: d.downloadedAt,
    });
  }
  const list = [...groups.values()];
  for (const g of list) {
    g.chapters.sort(
      (a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0)
    );
  }
  list.sort((a, b) => a.mangaTitle.localeCompare(b.mangaTitle));
  return list;
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
  mangaTitle?: string;
  chapterNumber?: number;
  chapterTitle?: string;
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
      mangaTitle: input.mangaTitle,
      chapterNumber: input.chapterNumber,
      chapterTitle: input.chapterTitle,
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
