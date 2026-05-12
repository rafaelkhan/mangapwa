"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { listInstalledSources, getSource } from "@/lib/sources/registry";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { MangaListItem } from "@/lib/sources/types";

interface Hit {
  sourceId: string;
  sourceName: string;
  item: MangaListItem;
}

export function CrossSearch(): React.ReactElement {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");

  const installed = useQuery({
    queryKey: ["installed-sources"],
    queryFn: listInstalledSources,
  });

  const search = useQuery<Hit[], Error>({
    queryKey: ["cross-search", active],
    enabled: active.length > 0 && !!installed.data,
    queryFn: async () => {
      const sources = installed.data!;
      const results = await Promise.allSettled(
        sources.map(async (sm) => {
          const src = await getSource(sm.id);
          const items = await src.search(active, 1);
          return items.slice(0, 8).map((item) => ({
            sourceId: sm.id,
            sourceName: sm.name,
            item,
          }));
        })
      );
      return results
        .filter((r): r is PromiseFulfilledResult<Hit[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex flex-col gap-2 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <h1 className="text-lg font-semibold">Search</h1>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setActive(q);
          }}
        >
          <Input
            placeholder="Search across all sources"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit">Go</Button>
        </form>
      </header>
      {search.isFetching && (
        <p className="p-4 text-sm text-zinc-500">Searching…</p>
      )}
      {search.data && search.data.length === 0 && !search.isFetching && (
        <p className="p-4 text-sm text-zinc-500">No results.</p>
      )}
      <div className="flex flex-col">
        {search.data?.map((h) => (
          <Link
            key={`${h.sourceId}-${h.item.id}`}
            href={`/manga/${h.sourceId}/${encodeURIComponent(h.item.id)}`}
            className="flex gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800"
          >
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
              {h.item.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={h.item.coverUrl}
                  alt={h.item.title}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="line-clamp-2 text-sm">{h.item.title}</p>
              <p className="text-xs text-zinc-500">{h.sourceName}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
