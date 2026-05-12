"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  Compass,
  ListChecks,
  Plug,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { href: "/library", label: "Library", icon: BookMarked },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/tracker", label: "Tracker", icon: ListChecks },
  { href: "/sources", label: "Sources", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav(): React.ReactElement {
  const pathname = usePathname();
  return (
    <nav
      className="sticky bottom-0 z-30 grid grid-cols-6 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 text-xs",
              active
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 dark:text-zinc-400"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
