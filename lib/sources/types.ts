import { z } from "zod";

export const SourceManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lang: z.string().min(1),
  version: z.string().min(1),
  nsfw: z.boolean(),
  iconUrl: z.string().url().optional(),
  entry: z.string().min(1),
});
export type SourceManifest = z.infer<typeof SourceManifestSchema>;

export const RepoManifestSchema = z.object({
  schemaVersion: z.literal(1),
  sources: z.array(SourceManifestSchema).min(1),
});
export type RepoManifest = z.infer<typeof RepoManifestSchema>;

export const MangaListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  coverUrl: z.string(),
});
export type MangaListItem = z.infer<typeof MangaListItemSchema>;

export const ChapterListItemSchema = z.object({
  id: z.string().min(1),
  number: z.number(),
  title: z.string().optional(),
  volume: z.number().optional(),
  uploadedAt: z.string().optional(),
  scanlator: z.string().optional(),
  lang: z.string(),
});
export type ChapterListItem = z.infer<typeof ChapterListItemSchema>;

export const MangaDetailsSchema = MangaListItemSchema.extend({
  author: z.string().optional(),
  artist: z.string().optional(),
  description: z.string().optional(),
  genres: z.array(z.string()),
  status: z.enum(["ongoing", "completed", "hiatus", "cancelled", "unknown"]),
  chapters: z.array(ChapterListItemSchema),
});
export type MangaDetails = z.infer<typeof MangaDetailsSchema>;

export const PageSchema = z.object({
  index: z.number().int().nonnegative(),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type Page = z.infer<typeof PageSchema>;

export interface SourceContext {
  fetch: (
    url: string,
    init?: RequestInit & { proxy?: boolean }
  ) => Promise<Response>;
  parseHTML: (html: string) => Document;
}

export interface Source {
  manifest: SourceManifest;
  search(query: string, page: number): Promise<MangaListItem[]>;
  getPopular(page: number): Promise<MangaListItem[]>;
  getLatest(page: number): Promise<MangaListItem[]>;
  getDetails(mangaId: string): Promise<MangaDetails>;
  getPages(chapterId: string): Promise<Page[]>;
}

export type SourceFactory = (ctx: SourceContext) => Source;
