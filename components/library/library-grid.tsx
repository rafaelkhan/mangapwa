"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listLibrary } from "@/lib/db/library";
import type { LibraryEntry } from "@/lib/db/schema";

export function LibraryGrid(): React.ReactElement {
  const { data, isLoading, error } = useQuery<LibraryEntry[]>({
    queryKey: ["library"],
    queryFn: listLibrary,
  });

  if (isLoading) {
    return <p className="p-4 text-sm text-zinc-500">Loading…</p>;
  }
  if (error) {
    return <p className="p-4 text-sm text-red-500">{String(error)}</p>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="mb-2 text-lg font-medium">Your library is empty</p>
        <p className="mb-4 text-sm text-zinc-500">
          Add a source repo, browse it, and tap “Add to library”.
        </p>
        <Link
          href="/sources"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Add a source
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {data.map((m) => (
        <Link
          key={m.key}
          href={`/manga/${m.sourceId}/${encodeURIComponent(m.mangaId)}`}
          className="group block"
        >
          <div className="aspect-[2/3] overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
            {m.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.coverUrl}
                alt={m.title}
                className="h-full w-full object-cover transition-transform group-active:scale-95"
                loading="lazy"
              />
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs">{m.title}</p>
        </Link>
      ))}
    </div>
  );
}
