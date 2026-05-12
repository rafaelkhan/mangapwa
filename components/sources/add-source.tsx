"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { installRepo, listRepos, uninstallRepo, updateRepo } from "@/lib/sources/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { InstalledRepo } from "@/lib/db/schema";

export function AddSource(): React.ReactElement {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const repos = useQuery<InstalledRepo[]>({
    queryKey: ["repos"],
    queryFn: listRepos,
  });
  const install = useMutation({
    mutationFn: (u: string) => installRepo(u),
    onSuccess: () => {
      setUrl("");
      qc.invalidateQueries({ queryKey: ["repos"] });
      toast("Source installed", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });
  const uninstall = useMutation({
    mutationFn: (u: string) => uninstallRepo(u),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
  const update = useMutation({
    mutationFn: (u: string) => updateRepo(u),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repos"] });
      toast("Source updated", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
        Only add repos you trust. Source code runs in your browser with full
        network access.
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={install.isPending}
        />
        <Button
          onClick={() => install.mutate(url)}
          disabled={!url || install.isPending}
        >
          {install.isPending ? "Installing…" : "Install"}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {repos.data?.map((r) => (
          <div
            key={r.repoUrl}
            className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {r.owner}/{r.repo}
                </p>
                <p className="text-xs text-zinc-500">@{r.ref.slice(0, 7)}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update.mutate(r.repoUrl)}
                  disabled={update.isPending}
                >
                  Update
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => uninstall.mutate(r.repoUrl)}
                >
                  Remove
                </Button>
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {r.manifest.sources.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="text-zinc-500">
                    {s.lang} · v{s.version}
                    {s.nsfw ? " · NSFW" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {repos.data && repos.data.length === 0 && (
          <p className="text-sm text-zinc-500">No sources installed yet.</p>
        )}
      </div>
    </div>
  );
}
