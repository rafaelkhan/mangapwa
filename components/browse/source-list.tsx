"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listInstalledSources } from "@/lib/sources/registry";

export function SourceList(): React.ReactElement {
  const { data, isLoading } = useQuery({
    queryKey: ["installed-sources"],
    queryFn: listInstalledSources,
  });
  if (isLoading) return <p className="p-4 text-sm text-zinc-500">Loading…</p>;
  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        No sources installed.{" "}
        <Link href="/sources" className="underline">
          Add one
        </Link>
        .
      </div>
    );
  }
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {data.map((s) => (
        <li key={s.id}>
          <Link
            href={`/browse/${encodeURIComponent(s.id)}`}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-zinc-500">
                {s.lang} · v{s.version}
                {s.nsfw ? " · NSFW" : ""}
              </p>
            </div>
            <span className="text-zinc-400">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
