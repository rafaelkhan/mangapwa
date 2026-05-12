"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { getSource } from "@/lib/sources/registry";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { MangaListItem } from "@/lib/sources/types";

type Tab = "popular" | "latest" | "search";

export function SourceBrowser({ sourceId }: { sourceId: string }): React.ReactElement {
  const [tab, setTab] = useState<Tab>("popular");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const sourceMeta = useQuery({
    queryKey: ["source-meta", sourceId],
    queryFn: async () => {
      const s = await getSource(sourceId);
      return s.manifest;
    },
  });

  const list = useInfiniteQuery<MangaListItem[], Error>({
    queryKey: ["browse", sourceId, tab, activeQuery],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const s = await getSource(sourceId);
      const page = pageParam as number;
      if (tab === "popular") return s.getPopular(page);
      if (tab === "latest") return s.getLatest(page);
      if (!activeQuery) return [];
      return s.search(activeQuery, page);
    },
    getNextPageParam: (last, all) => (last.length === 0 ? undefined : all.length + 1),
  });

  const items = list.data?.pages.flat() ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex flex-col gap-2 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link href="/browse" className="text-xs text-zinc-500">
          ‹ Sources
        </Link>
        <h1 className="text-lg font-semibold">
          {sourceMeta.data?.name ?? sourceId}
        </h1>
        <div className="flex gap-2">
          {(["popular", "latest", "search"] as Tab[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        {tab === "search" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setActiveQuery(query);
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit">Go</Button>
          </form>
        )}
      </header>

      {list.isError && (
        <p className="p-4 text-sm text-red-500">{list.error.message}</p>
      )}

      <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-5">
        {items.map((m) => (
          <Link
            key={`${m.id}`}
            href={`/manga/${sourceId}/${encodeURIComponent(m.id)}`}
            className="group block"
          >
            <div className="aspect-[2/3] overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
              {m.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.coverUrl}
                  alt={m.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-active:scale-95"
                />
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs">{m.title}</p>
          </Link>
        ))}
      </div>

      {list.hasNextPage && (
        <div className="px-4 pb-6">
          <Button
            variant="outline"
            onClick={() => list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
            className="w-full"
          >
            {list.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
