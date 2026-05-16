"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Circle, Download, Loader2, Trash2 } from "lucide-react";
import { getSource } from "@/lib/sources/registry";
import { addToLibrary, isInLibrary, removeFromLibrary } from "@/lib/db/library";
import {
  downloadChapter,
  deleteDownload,
  listDownloadsByManga,
} from "@/lib/db/downloads";
import { listMangaProgress } from "@/lib/db/progress";
import {
  listTrackerByManga,
  recordChapterRead,
  unrecordChapterRead,
} from "@/lib/db/tracker";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { MangaDetails } from "@/lib/sources/types";

export function MangaDetailsView({
  sourceId,
  mangaId,
}: {
  sourceId: string;
  mangaId: string;
}): React.ReactElement {
  const qc = useQueryClient();
  const details = useQuery<MangaDetails, Error>({
    queryKey: ["details", sourceId, mangaId],
    queryFn: async () => {
      const s = await getSource(sourceId);
      return s.getDetails(mangaId);
    },
  });
  const inLib = useQuery({
    queryKey: ["library-status", sourceId, mangaId],
    queryFn: () => isInLibrary(sourceId, mangaId),
  });
  const progress = useQuery({
    queryKey: ["progress", sourceId, mangaId],
    queryFn: () => listMangaProgress(sourceId, mangaId),
  });
  const tracker = useQuery({
    queryKey: ["tracker", sourceId, mangaId],
    queryFn: () => listTrackerByManga(sourceId, mangaId),
  });
  const downloads = useQuery({
    queryKey: ["downloads", sourceId, mangaId],
    queryFn: () => listDownloadsByManga(sourceId, mangaId),
  });

  // chapterId -> progress label ("n/total"); presence means a download is
  // running for that chapter.
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  async function downloadOne(
    chapter: MangaDetails["chapters"][number]
  ): Promise<void> {
    setBusy((b) => ({ ...b, [chapter.id]: "…" }));
    try {
      const s = await getSource(sourceId);
      const pages = await s.getPages(chapter.id);
      await downloadChapter({
        sourceId,
        mangaId,
        chapterId: chapter.id,
        pages,
        onProgress: (done, total) =>
          setBusy((b) => ({ ...b, [chapter.id]: `${done}/${total}` })),
      });
      toast(`Downloaded Ch. ${chapter.number}`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[chapter.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["downloads", sourceId, mangaId] });
      qc.invalidateQueries({ queryKey: ["downloaded"] });
    }
  }

  async function deleteOne(
    chapter: MangaDetails["chapters"][number]
  ): Promise<void> {
    try {
      await deleteDownload(sourceId, mangaId, chapter.id);
      toast(`Removed Ch. ${chapter.number} download`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      qc.invalidateQueries({ queryKey: ["downloads", sourceId, mangaId] });
      qc.invalidateQueries({ queryKey: ["downloaded"] });
    }
  }

  async function downloadMany(
    list: MangaDetails["chapters"][number][]
  ): Promise<void> {
    setBulkBusy(true);
    try {
      for (const c of list) {
        await downloadOne(c);
      }
    } finally {
      setBulkBusy(false);
    }
  }

  const toggleRead = useMutation({
    mutationFn: async (chapter: MangaDetails["chapters"][number]) => {
      const isRead = tracker.data?.some((t) => t.chapterId === chapter.id);
      if (isRead) {
        await unrecordChapterRead(sourceId, mangaId, chapter.id);
      } else {
        await recordChapterRead({
          sourceId,
          mangaId,
          mangaTitle: details.data?.title ?? mangaId,
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracker"] });
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!details.data) return;
      if (inLib.data) {
        await removeFromLibrary(sourceId, mangaId);
      } else {
        await addToLibrary({
          sourceId,
          mangaId,
          title: details.data.title,
          coverUrl: details.data.coverUrl,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["library-status", sourceId, mangaId] });
      toast(inLib.data ? "Removed from library" : "Added to library", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  if (details.isLoading) {
    return <p className="p-4 text-sm text-zinc-500">Loading…</p>;
  }
  if (details.isError) {
    return (
      <p className="p-4 text-sm text-red-500">{details.error.message}</p>
    );
  }
  const m = details.data!;
  const progByChapter = new Map((progress.data ?? []).map((p) => [p.chapterId, p]));
  const readChapterIds = new Set((tracker.data ?? []).map((t) => t.chapterId));
  const readCount = m.chapters.filter(
    (c) => readChapterIds.has(c.id) || progByChapter.get(c.id)?.completed
  ).length;
  const downloadedIds = new Set(
    (downloads.data ?? []).map((d) => d.chapterId)
  );
  const undownloaded = m.chapters.filter((c) => !downloadedIds.has(c.id));
  const anyBusy = bulkBusy || Object.keys(busy).length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link href={`/browse/${sourceId}`} className="text-xs text-zinc-500">
          ‹ Back
        </Link>
        <h1 className="line-clamp-1 text-lg font-semibold">{m.title}</h1>
      </header>
      <div className="flex gap-4 p-4">
        <div className="h-44 w-32 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
          {m.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.coverUrl} alt={m.title} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 text-sm">
          {m.author && <p>{m.author}</p>}
          <p className="text-xs uppercase text-zinc-500">{m.status}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {m.genres.map((g) => (
              <span
                key={g}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
              >
                {g}
              </span>
            ))}
          </div>
          <Button
            className="mt-3 w-fit"
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
          >
            {inLib.data ? "Remove from library" : "Add to library"}
          </Button>
        </div>
      </div>
      {m.description && (
        <p className="px-4 pb-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {m.description}
        </p>
      )}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-semibold">
            Chapters ({m.chapters.length})
            {readCount > 0 && (
              <span className="ml-2 font-normal text-zinc-500">
                · {readCount} read
              </span>
            )}
            {downloadedIds.size > 0 && (
              <span className="ml-2 font-normal text-zinc-500">
                · {downloadedIds.size} downloaded
              </span>
            )}
          </h2>
          {undownloaded.length > 0 && (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={anyBusy}
                onClick={() => downloadMany(undownloaded.slice(0, 5))}
              >
                {bulkBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Download 5"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={anyBusy}
                onClick={() => downloadMany(undownloaded)}
              >
                Download all
              </Button>
            </div>
          )}
        </div>
        <ul>
          {m.chapters.map((c) => {
            const prog = progByChapter.get(c.id);
            const isRead = readChapterIds.has(c.id) || !!prog?.completed;
            return (
              <li
                key={c.id}
                className="flex items-center border-t border-zinc-200 dark:border-zinc-800"
              >
                <Link
                  href={`/read/${sourceId}/${encodeURIComponent(
                    mangaId
                  )}/${encodeURIComponent(c.id)}`}
                  className="flex flex-1 items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p
                      className={
                        isRead
                          ? "text-zinc-400 line-through dark:text-zinc-600"
                          : ""
                      }
                    >
                      Ch. {c.number}
                      {c.title ? ` — ${c.title}` : ""}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {c.scanlator ?? c.lang}
                      {c.uploadedAt
                        ? ` · ${new Date(c.uploadedAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  {prog && !prog.completed && (
                    <span className="text-xs text-zinc-500">
                      p{prog.page + 1}/{prog.totalPages}
                    </span>
                  )}
                </Link>
                {busy[c.id] !== undefined ? (
                  <span className="flex shrink-0 items-center gap-1 px-3 py-3 text-xs text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {busy[c.id]}
                  </span>
                ) : downloadedIds.has(c.id) ? (
                  <button
                    type="button"
                    onClick={() => deleteOne(c)}
                    aria-label="Delete download"
                    title="Delete download"
                    className="shrink-0 px-3 py-3 text-emerald-500 transition-colors hover:text-red-500"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => downloadOne(c)}
                    disabled={anyBusy}
                    aria-label="Download chapter"
                    title="Download chapter"
                    className="shrink-0 px-3 py-3 text-zinc-300 transition-colors hover:text-zinc-600 disabled:opacity-50 dark:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleRead.mutate(c)}
                  disabled={toggleRead.isPending}
                  aria-label={isRead ? "Mark chapter unread" : "Mark chapter read"}
                  title={isRead ? "Mark unread" : "Mark read"}
                  className="shrink-0 px-4 py-3 text-zinc-300 transition-colors hover:text-zinc-600 disabled:opacity-50 dark:text-zinc-600 dark:hover:text-zinc-300"
                >
                  {isRead ? (
                    <Check className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
