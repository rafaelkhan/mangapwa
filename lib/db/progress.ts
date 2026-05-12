import { getDB, progressKey, type ProgressEntry } from "./schema";

export async function getProgress(
  sourceId: string,
  mangaId: string,
  chapterId: string
): Promise<ProgressEntry | undefined> {
  const db = await getDB();
  return db.get("progress", progressKey(sourceId, mangaId, chapterId));
}

export async function saveProgress(input: {
  sourceId: string;
  mangaId: string;
  chapterId: string;
  page: number;
  totalPages: number;
  completed?: boolean;
}): Promise<void> {
  const db = await getDB();
  const entry: ProgressEntry = {
    key: progressKey(input.sourceId, input.mangaId, input.chapterId),
    sourceId: input.sourceId,
    mangaId: input.mangaId,
    chapterId: input.chapterId,
    page: input.page,
    totalPages: input.totalPages,
    completed: input.completed ?? input.page >= input.totalPages - 1,
    updatedAt: Date.now(),
  };
  await db.put("progress", entry);
}

export async function listMangaProgress(
  sourceId: string,
  mangaId: string
): Promise<ProgressEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("progress", "by-manga", [sourceId, mangaId]);
}
