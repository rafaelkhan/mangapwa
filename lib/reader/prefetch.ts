import { proxyImageUrl } from "@/lib/sources/sandbox";
import type { Page } from "@/lib/sources/types";

export function buildPageSrc(page: Page): string {
  if (page.headers && Object.keys(page.headers).length > 0) {
    return proxyImageUrl(page.url, page.headers);
  }
  return page.url;
}

export function prefetchPages(pages: Page[], startIndex: number, count = 3): void {
  if (typeof window === "undefined") return;
  for (let i = startIndex; i < Math.min(pages.length, startIndex + count); i++) {
    const src = buildPageSrc(pages[i]);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}
