"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { clearAutoCache, totalCachedBytes } from "@/lib/db/cache";
import { listLibrary } from "@/lib/db/library";
import { listRepos } from "@/lib/sources/registry";
import { toast } from "@/components/ui/toast";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function SettingsView(): React.ReactElement {
  const qc = useQueryClient();
  const bytes = useQuery({
    queryKey: ["cache-bytes"],
    queryFn: totalCachedBytes,
  });

  async function exportLibrary() {
    const [lib, repos] = await Promise.all([listLibrary(), listRepos()]);
    const blob = new Blob(
      [JSON.stringify({ library: lib, repos }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mangapwa-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function requestPersist() {
    if (!navigator.storage?.persist) {
      toast("Persistent storage not supported here", "error");
      return;
    }
    const ok = await navigator.storage.persist();
    toast(ok ? "Storage is now persistent" : "Browser denied persistence", ok ? "success" : "error");
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Storage</h2>
        <p className="text-sm">
          Image cache: {bytes.data != null ? formatBytes(bytes.data) : "—"}
        </p>
        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await clearAutoCache();
              qc.invalidateQueries({ queryKey: ["cache-bytes"] });
              toast("Auto cache cleared", "success");
            }}
          >
            Clear image cache
          </Button>
          <Button variant="outline" size="sm" onClick={requestPersist}>
            Request persistent storage
          </Button>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold">Backup</h2>
        <Button variant="outline" size="sm" onClick={exportLibrary}>
          Export library JSON
        </Button>
      </section>
      <section className="text-xs text-zinc-500">
        <p>MangaPWA · self-hosted reader.</p>
        <p>
          Sources run in your browser. Only install from repos you trust.
        </p>
      </section>
    </div>
  );
}
