import { getDB, trackerKey, type TrackerEntry } from "./schema";

export interface TrackedManga {
  sourceId: string;
  mangaId: string;
  mangaTitle: string;
  chaptersRead: number;
  lastChapterNumber: number;
  lastReadAt: number;
}

export async function recordChapterRead(input: {
  sourceId: string;
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle?: string;
}): Promise<void> {
  const db = await getDB();
  const key = trackerKey(input.sourceId, input.mangaId, input.chapterId);
  const existing = await db.get("tracker", key);
  const entry: TrackerEntry = {
    key,
    sourceId: input.sourceId,
    mangaId: input.mangaId,
    mangaTitle: input.mangaTitle,
    chapterId: input.chapterId,
    chapterNumber: input.chapterNumber,
    chapterTitle: input.chapterTitle,
    // keep the first time it was read; just refresh metadata on repeats
    readAt: existing?.readAt ?? Date.now(),
  };
  await db.put("tracker", entry);
}

export async function unrecordChapterRead(
  sourceId: string,
  mangaId: string,
  chapterId: string
): Promise<void> {
  const db = await getDB();
  await db.delete("tracker", trackerKey(sourceId, mangaId, chapterId));
}

export async function isChapterRead(
  sourceId: string,
  mangaId: string,
  chapterId: string
): Promise<boolean> {
  const db = await getDB();
  return !!(await db.get("tracker", trackerKey(sourceId, mangaId, chapterId)));
}

export async function listTrackerByManga(
  sourceId: string,
  mangaId: string
): Promise<TrackerEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("tracker", "by-manga", [sourceId, mangaId]);
}

export async function listTrackerEntries(): Promise<TrackerEntry[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex("tracker", "by-readAt");
  return items.reverse();
}

export async function listTrackedManga(): Promise<TrackedManga[]> {
  const entries = await listTrackerEntries();
  const byManga = new Map<string, TrackedManga>();
  for (const e of entries) {
    const key = `${e.sourceId}::${e.mangaId}`;
    const cur = byManga.get(key);
    if (!cur) {
      byManga.set(key, {
        sourceId: e.sourceId,
        mangaId: e.mangaId,
        mangaTitle: e.mangaTitle,
        chaptersRead: 1,
        lastChapterNumber: e.chapterNumber,
        lastReadAt: e.readAt,
      });
    } else {
      cur.chaptersRead += 1;
      if (e.readAt > cur.lastReadAt) {
        cur.lastReadAt = e.readAt;
        cur.lastChapterNumber = e.chapterNumber;
        cur.mangaTitle = e.mangaTitle;
      } else if (e.chapterNumber > cur.lastChapterNumber) {
        cur.lastChapterNumber = e.chapterNumber;
      }
    }
  }
  return [...byManga.values()].sort((a, b) => b.lastReadAt - a.lastReadAt);
}

export async function clearTracker(): Promise<void> {
  const db = await getDB();
  await db.clear("tracker");
}
