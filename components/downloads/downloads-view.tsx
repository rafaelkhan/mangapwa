"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import {
  deleteDownload,
  listDownloadedManga,
  type DownloadedMangaGroup,
} from "@/lib/db/downloads";
import { toast } from "@/components/ui/toast";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function DownloadsView(): React.ReactElement {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<DownloadedMangaGroup[]>({
    queryKey: ["downloaded-manga"],
    queryFn: listDownloadedManga,
  });

  async function remove(
    sourceId: string,
    mangaId: string,
    chapterId: string,
    label: string
  ) {
    try {
      await deleteDownload(sourceId, mangaId, chapterId);
      toast(`Removed ${label}`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      qc.invalidateQueries({ queryKey: ["downloaded-manga"] });
      qc.invalidateQueries({ queryKey: ["downloads"] });
      qc.invalidateQueries({ queryKey: ["download-stats"] });
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-zinc-500">Loading…</p>;
  }
  if (error) {
    return <p className="p-4 text-sm text-red-500">{String(error)}</p>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="mb-2 text-lg font-medium">No downloads yet</p>
        <p className="text-sm text-zinc-500">
          Open a manga and tap the download icon on a chapter. Downloaded
          chapters read fully offline from here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {data.map((g) => (
        <section
          key={`${g.sourceId}::${g.mangaId}`}
          className="border-b border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-baseline justify-between gap-2 px-4 py-3">
            <h2 className="line-clamp-1 text-sm font-semibold">
              {g.mangaTitle}
            </h2>
            <span className="shrink-0 text-xs text-zinc-500">
              {g.chapters.length} ch · {formatBytes(g.bytes)}
            </span>
          </div>
          <ul>
            {g.chapters.map((c) => {
              const label =
                c.chapterNumber != null
                  ? `Ch. ${c.chapterNumber}${
                      c.chapterTitle ? ` — ${c.chapterTitle}` : ""
                    }`
                  : c.chapterTitle ?? c.chapterId;
              return (
                <li
                  key={c.chapterId}
                  className="flex items-center border-t border-zinc-200 dark:border-zinc-800"
                >
                  <Link
                    href={`/read/${g.sourceId}/${encodeURIComponent(
                      g.mangaId
                    )}/${encodeURIComponent(c.chapterId)}`}
                    className="flex flex-1 items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="line-clamp-1">{label}</span>
                    <span className="ml-2 shrink-0 text-xs text-zinc-500">
                      {formatBytes(c.bytes)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      remove(g.sourceId, g.mangaId, c.chapterId, label)
                    }
                    aria-label="Delete download"
                    title="Delete download"
                    className="shrink-0 px-4 py-3 text-emerald-500 transition-colors hover:text-red-500"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
