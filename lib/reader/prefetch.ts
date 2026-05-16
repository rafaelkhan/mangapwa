import { proxyImageUrl } from "@/lib/sources/sandbox";
import type { Page } from "@/lib/sources/types";

// `forceProxy` routes the image through /api/proxy even when the source did
// not require headers. Downloaded chapters use this so the rendered <img> src
// is identical to the URL the offline cache was keyed on.
export function buildPageSrc(page: Page, forceProxy = false): string {
  if (forceProxy || (page.headers && Object.keys(page.headers).length > 0)) {
    return proxyImageUrl(page.url, page.headers);
  }
  return page.url;
}

export function prefetchPages(
  pages: Page[],
  startIndex: number,
  count = 3,
  forceProxy = false
): void {
  if (typeof window === "undefined") return;
  for (let i = startIndex; i < Math.min(pages.length, startIndex + count); i++) {
    const src = buildPageSrc(pages[i], forceProxy);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}
