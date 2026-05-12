"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getSource } from "@/lib/sources/registry";
import { saveProgress, getProgress } from "@/lib/db/progress";
import { touchLibraryLastRead } from "@/lib/db/library";
import { recordChapterRead } from "@/lib/db/tracker";
import { buildPageSrc, prefetchPages } from "@/lib/reader/prefetch";
import { debounce } from "@/lib/utils/debounce";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import type { MangaDetails, Page } from "@/lib/sources/types";

type Mode = "vertical" | "paginated";

const MODE_KEY = "mangapwa.readerMode";

export function Reader({
  sourceId,
  mangaId,
  chapterId,
}: {
  sourceId: string;
  mangaId: string;
  chapterId: string;
}): React.ReactElement {
  const [mode, setMode] = useState<Mode>("vertical");
  const [showChrome, setShowChrome] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(MODE_KEY) : null;
    if (saved === "paginated" || saved === "vertical") setMode(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const pagesQuery = useQuery<Page[], Error>({
    queryKey: ["pages", sourceId, mangaId, chapterId],
    queryFn: async () => {
      const s = await getSource(sourceId);
      return s.getPages(chapterId);
    },
  });

  // Shares the cache with the manga details page so this is usually a hit.
  const detailsQuery = useQuery<MangaDetails, Error>({
    queryKey: ["details", sourceId, mangaId],
    queryFn: async () => {
      const s = await getSource(sourceId);
      return s.getDetails(mangaId);
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    (async () => {
      const prog = await getProgress(sourceId, mangaId, chapterId);
      if (prog) setCurrentIndex(prog.page);
    })();
  }, [sourceId, mangaId, chapterId]);

  const persistProgress = useMemo(
    () =>
      debounce((idx: number, total: number) => {
        saveProgress({
          sourceId,
          mangaId,
          chapterId,
          page: idx,
          totalPages: total,
        }).catch(() => {});
        touchLibraryLastRead(sourceId, mangaId).catch(() => {});
      }, 400),
    [sourceId, mangaId, chapterId]
  );

  const pages = pagesQuery.data ?? [];

  useEffect(() => {
    if (pages.length > 0) persistProgress(currentIndex, pages.length);
  }, [currentIndex, pages.length, persistProgress]);

  useEffect(() => {
    if (pages.length > 0) prefetchPages(pages, currentIndex + 1, 3);
  }, [pages, currentIndex]);

  // Log this chapter to the tracker once the reader reaches the last page.
  const trackedRef = useRef(false);
  useEffect(() => {
    trackedRef.current = false;
  }, [sourceId, mangaId, chapterId]);
  useEffect(() => {
    if (trackedRef.current) return;
    if (pages.length === 0 || currentIndex < pages.length - 1) return;
    const details = detailsQuery.data;
    const chapter = details?.chapters.find((c) => c.id === chapterId);
    trackedRef.current = true;
    recordChapterRead({
      sourceId,
      mangaId,
      mangaTitle: details?.title ?? mangaId,
      chapterId,
      chapterNumber: chapter?.number ?? 0,
      chapterTitle: chapter?.title,
    }).catch(() => {
      trackedRef.current = false;
    });
  }, [currentIndex, pages.length, detailsQuery.data, sourceId, mangaId, chapterId]);

  const containerRef = useRef<HTMLDivElement>(null);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || mode !== "vertical") return;
    const children = el.querySelectorAll<HTMLImageElement>("img[data-page]");
    const center = el.scrollTop + el.clientHeight / 2;
    let best = 0;
    let bestDist = Infinity;
    children.forEach((img) => {
      const top = img.offsetTop;
      const mid = top + img.clientHeight / 2;
      const d = Math.abs(mid - center);
      if (d < bestDist) {
        bestDist = d;
        best = Number(img.dataset.page);
      }
    });
    setCurrentIndex(best);
  }, [mode]);

  if (pagesQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading chapter…
      </div>
    );
  }
  if (pagesQuery.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
        <p className="text-sm text-red-400">{pagesQuery.error.message}</p>
        <Link
          href={`/manga/${sourceId}/${encodeURIComponent(mangaId)}`}
          className="text-xs underline"
        >
          Back to chapters
        </Link>
      </div>
    );
  }
  if (pages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Empty chapter.
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header
        className={cn(
          "absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3 transition-opacity",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0))",
        }}
      >
        <Link
          href={`/manga/${sourceId}/${encodeURIComponent(mangaId)}`}
          className="rounded-full bg-black/60 p-2"
        >
          <X className="h-5 w-5" />
        </Link>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "vertical" ? "default" : "outline"}
            onClick={() => setMode("vertical")}
          >
            Scroll
          </Button>
          <Button
            size="sm"
            variant={mode === "paginated" ? "default" : "outline"}
            onClick={() => setMode("paginated")}
          >
            Pages
          </Button>
        </div>
      </header>

      {mode === "vertical" ? (
        <div
          ref={containerRef}
          onScroll={onScroll}
          onClick={() => setShowChrome((v) => !v)}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          {pages.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.index}
              data-page={i}
              src={buildPageSrc(p)}
              alt={`Page ${p.index + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className="block w-full min-h-[50vh] object-contain"
            />
          ))}
        </div>
      ) : (
        <PaginatedView
          pages={pages}
          index={currentIndex}
          onIndexChange={setCurrentIndex}
          onToggleChrome={() => setShowChrome((v) => !v)}
        />
      )}

      <footer
        className={cn(
          "absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-3 px-4 py-3 text-xs transition-opacity",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))",
        }}
      >
        <span>
          {currentIndex + 1} / {pages.length}
        </span>
      </footer>
    </div>
  );
}

function PaginatedView({
  pages,
  index,
  onIndexChange,
  onToggleChrome,
}: {
  pages: Page[];
  index: number;
  onIndexChange: (i: number) => void;
  onToggleChrome: () => void;
}): React.ReactElement {
  const safeIndex = Math.min(Math.max(0, index), pages.length - 1);
  const next = () => onIndexChange(Math.min(pages.length - 1, safeIndex + 1));
  const prev = () => onIndexChange(Math.max(0, safeIndex - 1));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") next();
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipe support: up = next page, down = previous (so it reads "panel for
  // panel, downward"); left/right work too. A detected swipe suppresses the
  // click that iOS also fires, so we don't double-advance.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const THRESHOLD = 40;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > THRESHOLD) {
      swipedRef.current = true;
      if (dy < 0) next();
      else prev();
    } else if (Math.abs(dx) > THRESHOLD) {
      swipedRef.current = true;
      if (dx < 0) next();
      else prev();
    }
  }

  function onTap(e: React.MouseEvent<HTMLDivElement>) {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) prev();
    else if (x > rect.width - third) next();
    else onToggleChrome();
  }

  const page = pages[safeIndex];
  return (
    <div
      onClick={onTap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative flex flex-1 items-center justify-center overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={page.index}
        src={buildPageSrc(page)}
        alt={`Page ${page.index + 1}`}
        decoding="async"
        loading="eager"
        className="max-h-full max-w-full object-contain"
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2"
        aria-label="previous"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2"
        aria-label="next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
