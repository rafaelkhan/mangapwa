/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DOWNLOAD_CACHE = "manga-downloads-v1";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache-first against the durable download bucket for proxied page
    // images. A hit serves a downloaded chapter fully offline; a miss falls
    // through to the network (online reading) without polluting the bucket —
    // only lib/db/downloads.ts writes here, paired with its IndexedDB
    // bookkeeping. Must precede defaultCache so it wins for /api/proxy.
    {
      matcher: ({ url, request }) =>
        request.method === "GET" && url.pathname === "/api/proxy",
      handler: async ({ request }) => {
        const cache = await caches.open(DOWNLOAD_CACHE);
        const cached = await cache.match(request);
        return cached ?? fetch(request);
      },
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
