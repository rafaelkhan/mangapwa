"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getSource } from "@/lib/sources/registry";
import { addToLibrary, isInLibrary, removeFromLibrary } from "@/lib/db/library";
import { listMangaProgress } from "@/lib/db/progress";
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
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
        <h2 className="px-4 py-3 text-sm font-semibold">
          Chapters ({m.chapters.length})
        </h2>
        <ul>
          {m.chapters.map((c) => {
            const prog = progByChapter.get(c.id);
            return (
              <li
                key={c.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <Link
                  href={`/read/${sourceId}/${encodeURIComponent(
                    mangaId
                  )}/${encodeURIComponent(c.id)}`}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p
                      className={
                        prog?.completed
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
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
