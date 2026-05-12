"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listTrackedManga, type TrackedManga } from "@/lib/db/tracker";
import { useProfileName } from "@/lib/profile";

function relativeDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString();
}

export function TrackerView(): React.ReactElement {
  const name = useProfileName();
  const { data, isLoading, error } = useQuery<TrackedManga[]>({
    queryKey: ["tracker"],
    queryFn: listTrackedManga,
  });

  if (!name) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="mb-2 text-lg font-medium">No tracker profile yet</p>
        <p className="mb-4 text-sm text-zinc-500">
          Add your name in Settings to start tracking the chapters you read.
        </p>
        <Link
          href="/settings"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Set up tracker
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-zinc-500">Loading…</p>;
  }
  if (error) {
    return <p className="p-4 text-sm text-red-500">{String(error)}</p>;
  }

  const manga = data ?? [];
  const totalChapters = manga.reduce((n, m) => n + m.chaptersRead, 0);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm font-medium">{name}&rsquo;s reading log</p>
        <p className="text-xs text-zinc-500">
          {totalChapters} chapter{totalChapters === 1 ? "" : "s"} across{" "}
          {manga.length} title{manga.length === 1 ? "" : "s"}
        </p>
      </div>
      {manga.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <p className="mb-2 text-lg font-medium">Nothing read yet</p>
          <p className="text-sm text-zinc-500">
            Finish a chapter in the reader (or tap the circle on a chapter) and
            it&rsquo;ll show up here.
          </p>
        </div>
      ) : (
        <ul>
          {manga.map((m) => (
            <li
              key={`${m.sourceId}::${m.mangaId}`}
              className="border-b border-zinc-200 dark:border-zinc-800"
            >
              <Link
                href={`/manga/${m.sourceId}/${encodeURIComponent(m.mangaId)}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-medium">
                    {m.mangaTitle}
                  </p>
                  <p className="text-xs text-zinc-500">
                    last read Ch. {m.lastChapterNumber} · {relativeDate(m.lastReadAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {m.chaptersRead} read
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
