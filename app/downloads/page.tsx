import { DownloadsView } from "@/components/downloads/downloads-view";

export default function DownloadsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <h1 className="text-lg font-semibold">Downloads</h1>
        <p className="text-xs text-zinc-500">Available offline</p>
      </header>
      <DownloadsView />
    </div>
  );
}
