import { TrackerView } from "@/components/tracker/tracker-view";

export default function TrackerPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <h1 className="text-lg font-semibold">Tracker</h1>
      </header>
      <TrackerView />
    </div>
  );
}
