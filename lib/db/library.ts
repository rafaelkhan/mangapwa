import { getDB, libraryKey, type LibraryEntry } from "./schema";

export async function listLibrary(): Promise<LibraryEntry[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex("library", "by-addedAt");
  return items.reverse();
}

export async function isInLibrary(
  sourceId: string,
  mangaId: string
): Promise<boolean> {
  const db = await getDB();
  const entry = await db.get("library", libraryKey(sourceId, mangaId));
  return !!entry;
}

export async function addToLibrary(input: {
  sourceId: string;
  mangaId: string;
  title: string;
  coverUrl: string;
}): Promise<void> {
  const db = await getDB();
  const key = libraryKey(input.sourceId, input.mangaId);
  const existing = await db.get("library", key);
  if (existing) return;
  const entry: LibraryEntry = {
    key,
    sourceId: input.sourceId,
    mangaId: input.mangaId,
    title: input.title,
    coverUrl: input.coverUrl,
    addedAt: Date.now(),
  };
  await db.put("library", entry);
}

export async function removeFromLibrary(
  sourceId: string,
  mangaId: string
): Promise<void> {
  const db = await getDB();
  await db.delete("library", libraryKey(sourceId, mangaId));
}

export async function touchLibraryLastRead(
  sourceId: string,
  mangaId: string
): Promise<void> {
  const db = await getDB();
  const key = libraryKey(sourceId, mangaId);
  const entry = await db.get("library", key);
  if (!entry) return;
  entry.lastReadAt = Date.now();
  await db.put("library", entry);
}
