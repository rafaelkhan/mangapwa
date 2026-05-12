import { AddSource } from "@/components/sources/add-source";

export default function SourcesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <h1 className="text-lg font-semibold">Sources</h1>
      </header>
      <AddSource />
    </div>
  );
}
