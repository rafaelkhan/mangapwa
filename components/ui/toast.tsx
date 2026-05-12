"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface ToastItem {
  id: string;
  message: string;
  kind: "info" | "error" | "success";
}

interface ToastStore {
  items: ToastItem[];
  push: (msg: string, kind?: ToastItem["kind"]) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (message, kind = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ items: [...s.items, { id, message, kind }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, kind: ToastItem["kind"] = "info"): void {
  useToastStore.getState().push(message, kind);
}

export function Toaster(): React.ReactElement {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    // no-op; presence ensures the store mounts
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            "pointer-events-auto cursor-pointer rounded-md border px-4 py-2 text-sm shadow-md",
            t.kind === "error" &&
              "border-red-500/40 bg-red-500/10 text-red-200",
            t.kind === "success" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
            t.kind === "info" &&
              "border-zinc-700 bg-zinc-900 text-zinc-100"
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
