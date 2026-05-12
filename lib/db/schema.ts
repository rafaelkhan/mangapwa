import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface LibraryEntry {
  key: string;
  sourceId: string;
  mangaId: string;
  title: string;
  coverUrl: string;
  addedAt: number;
  lastReadAt?: number;
  unreadCount?: number;
}

export interface ProgressEntry {
  key: string;
  sourceId: string;
  mangaId: string;
  chapterId: string;
  page: number;
  totalPages: number;
  updatedAt: number;
  completed: boolean;
}

export interface InstalledRepo {
  repoUrl: string;
  owner: string;
  repo: string;
  ref: string;
  installedAt: number;
  manifest: {
    schemaVersion: 1;
    sources: Array<{
      id: string;
      name: string;
      lang: string;
      version: string;
      nsfw: boolean;
      iconUrl?: string;
      entry: string;
    }>;
  };
}

export interface CacheMetaEntry {
  url: string;
  sourceId: string;
  mangaId: string;
  chapterId: string;
  size: number;
  cachedAt: number;
  bucket: "auto" | "download";
}

export interface DownloadedChapter {
  key: string;
  sourceId: string;
  mangaId: string;
  chapterId: string;
  pageUrls: string[];
  downloadedAt: number;
  bytes: number;
}

interface MangaPwaDB extends DBSchema {
  library: {
    key: string;
    value: LibraryEntry;
    indexes: { "by-source": string; "by-addedAt": number };
  };
  progress: {
    key: string;
    value: ProgressEntry;
    indexes: { "by-manga": [string, string]; "by-updatedAt": number };
  };
  repos: {
    key: string;
    value: InstalledRepo;
  };
  cache_meta: {
    key: string;
    value: CacheMetaEntry;
    indexes: { "by-chapter": [string, string, string]; "by-bucket": string };
  };
  downloads: {
    key: string;
    value: DownloadedChapter;
    indexes: { "by-manga": [string, string] };
  };
}

const DB_NAME = "mangapwa";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MangaPwaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MangaPwaDB>> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB unavailable (likely SSR)");
  }
  if (!dbPromise) {
    dbPromise = openDB<MangaPwaDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const library = db.createObjectStore("library", { keyPath: "key" });
          library.createIndex("by-source", "sourceId");
          library.createIndex("by-addedAt", "addedAt");

          const progress = db.createObjectStore("progress", { keyPath: "key" });
          progress.createIndex("by-manga", ["sourceId", "mangaId"]);
          progress.createIndex("by-updatedAt", "updatedAt");

          db.createObjectStore("repos", { keyPath: "repoUrl" });

          const cache = db.createObjectStore("cache_meta", { keyPath: "url" });
          cache.createIndex("by-chapter", ["sourceId", "mangaId", "chapterId"]);
          cache.createIndex("by-bucket", "bucket");

          const downloads = db.createObjectStore("downloads", {
            keyPath: "key",
          });
          downloads.createIndex("by-manga", ["sourceId", "mangaId"]);
        }
      },
    });
  }
  return dbPromise;
}

export function libraryKey(sourceId: string, mangaId: string): string {
  return `${sourceId}::${mangaId}`;
}

export function progressKey(
  sourceId: string,
  mangaId: string,
  chapterId: string
): string {
  return `${sourceId}::${mangaId}::${chapterId}`;
}

export function downloadKey(
  sourceId: string,
  mangaId: string,
  chapterId: string
): string {
  return `${sourceId}::${mangaId}::${chapterId}`;
}
