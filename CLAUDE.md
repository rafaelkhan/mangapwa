# CLAUDE.md

This file gives Claude Code the context it needs to work productively in this repository.

---

## Project Overview

**MangaPWA** — a self-hosted, installable Progressive Web App (PWA) for reading manga, inspired by Tachimanga / Tachiyomi / Aidoku. Deployed on Vercel, installed on iOS/iPadOS via "Add to Home Screen", and extended at runtime by pointing it at user-supplied GitHub repos that contain *source modules* (scrapers for manga sites).

The user owns this instance. There is no public auth, no shared backend, no content shipped with the app. The app is a **reader + library manager + extension host**.

### Why a PWA, not native
- Apple does not allow App Store distribution of this type of app.
- Sideloading (AltStore, TrollStore) is fragile and time-limited.
- A PWA installed via "Add to Home Screen" gives a near-native UX on iOS 16.4+ (web push, fullscreen, splash screen, offline via service worker).
- Vercel hosting is free for personal use and trivial to deploy from a GitHub repo.

### Architectural North Star
The app must be **content-agnostic**. It ships zero scrapers. Everything comes from user-added GitHub repos which expose a manifest + a set of JavaScript source modules conforming to a documented interface. This keeps the deployed app legally clean (it's just a reader) and makes the source ecosystem upgradable without redeploying.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (strict)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State**: Zustand for client state; TanStack Query for async/cached reads
- **Storage** (client-only, no server DB):
  - IndexedDB via `idb` for library, read progress, source registry, image cache metadata
  - Cache Storage API for cached chapter images (managed by the service worker)
- **PWA**: `@serwist/next` (modern successor to next-pwa) for service worker + manifest
- **HTTP**: native `fetch` from the client; a thin Next.js API route (`/api/proxy`) handles CORS-blocked source requests
- **HTML parsing in browser**: `DOMParser` (native); `linkedom` only if a source needs Node-style parsing on the server
- **Runtime for source modules**: dynamic `import()` of ES modules fetched from GitHub's raw content CDN (`raw.githubusercontent.com`) or jsDelivr (`cdn.jsdelivr.net/gh/...`) — jsDelivr is preferred (CORS-friendly, cached, immutable when pinned to a commit hash)
- **Deployment**: Vercel (Hobby tier is fine)

---

## Repository Layout

```
mangapwa/
├── app/                          # Next.js App Router
│   ├── (reader)/                 # Route group with reader-specific layout
│   │   └── read/[sourceId]/[mangaId]/[chapterId]/page.tsx
│   ├── library/page.tsx          # User's saved manga
│   ├── browse/[sourceId]/page.tsx# Browse a specific source
│   ├── search/page.tsx           # Cross-source search
│   ├── sources/page.tsx          # Add / manage source repos
│   ├── settings/page.tsx
│   ├── api/
│   │   └── proxy/route.ts        # CORS-bypass proxy for sources that need it
│   ├── layout.tsx
│   └── manifest.ts               # PWA manifest (Next 15 metadata API)
├── components/
│   ├── reader/                   # Page renderer, paginator, vertical/horizontal modes
│   ├── library/
│   ├── sources/
│   └── ui/                       # shadcn primitives
├── lib/
│   ├── sources/
│   │   ├── loader.ts             # Loads source modules from GitHub
│   │   ├── registry.ts           # IndexedDB-backed registry of installed sources
│   │   ├── sandbox.ts            # Safe-ish execution context for source code
│   │   └── types.ts              # The Source SDK interface (see below)
│   ├── db/
│   │   ├── schema.ts             # IndexedDB schema + migrations
│   │   ├── library.ts
│   │   ├── progress.ts
│   │   └── cache.ts
│   ├── reader/
│   │   └── prefetch.ts           # Prefetch next-N images on chapter open
│   └── utils/
├── public/
│   ├── icons/                    # PWA icons (192, 512, maskable)
│   └── splash/                   # iOS splash screens
├── sw.ts                         # Serwist service worker source
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## The Source SDK (most important contract in the codebase)

A "source" is an ES module that conforms to this interface. Source repos on GitHub publish these modules; the app loads them at runtime.

```ts
// lib/sources/types.ts
export interface SourceManifest {
  id: string;              // stable unique id, e.g. "mangadex-en"
  name: string;            // display name
  lang: string;            // BCP-47, e.g. "en", "de", "multi"
  version: string;         // semver
  nsfw: boolean;
  iconUrl?: string;
  entry: string;           // relative path to the ES module, e.g. "./dist/source.js"
}

export interface MangaListItem {
  id: string;              // source-local id
  title: string;
  coverUrl: string;
}

export interface MangaDetails extends MangaListItem {
  author?: string;
  artist?: string;
  description?: string;
  genres: string[];
  status: "ongoing" | "completed" | "hiatus" | "cancelled" | "unknown";
  chapters: ChapterListItem[];
}

export interface ChapterListItem {
  id: string;
  number: number;          // chapter number as float (e.g. 12.5)
  title?: string;
  volume?: number;
  uploadedAt?: string;     // ISO date
  scanlator?: string;
  lang: string;
}

export interface Page {
  index: number;
  url: string;             // absolute URL to the image
  headers?: Record<string, string>; // any required Referer / User-Agent
}

export interface Source {
  manifest: SourceManifest;
  search(query: string, page: number): Promise<MangaListItem[]>;
  getPopular(page: number): Promise<MangaListItem[]>;
  getLatest(page: number): Promise<MangaListItem[]>;
  getDetails(mangaId: string): Promise<MangaDetails>;
  getPages(chapterId: string): Promise<Page[]>;
}
```

A source repo's `manifest.json` at the repo root looks like:

```json
{
  "schemaVersion": 1,
  "sources": [
    { "id": "mangadex-en", "name": "MangaDex (EN)", "lang": "en", "version": "0.1.0", "nsfw": false, "entry": "./dist/mangadex-en.js" }
  ]
}
```

The user pastes a GitHub URL (e.g. `https://github.com/someone/manga-sources`) and the loader does:

1. Fetch `manifest.json` from `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<commitOrTag>/manifest.json` (pinning to a commit hash for reproducibility).
2. For each declared source, dynamic-import the entry URL.
3. Validate the default export against the `Source` interface at runtime (zod).
4. Persist `{ repoUrl, commit, manifest }` in IndexedDB.

---

## Critical Implementation Notes

### CORS and the proxy
Many manga sites set strict CORS or require a `Referer`. The browser will block these. Strategy:

1. Source code first attempts a direct `fetch`. If it fails, it calls the SDK helper `ctx.fetch(url, { proxy: true, headers })`.
2. The helper routes through `/api/proxy?url=...` which is a Next.js API route running on Vercel's edge. It forwards the request server-side with the requested headers and streams the response back.
3. The proxy must:
   - Whitelist only `http(s)` schemes.
   - Strip hop-by-hop headers.
   - Cap response size (e.g. 25 MB) to avoid abuse.
   - Pass through `Content-Type` so images render.
4. Image `<img>` tags can use the proxy URL directly: `<img src="/api/proxy?url=...">`.

### Source sandboxing (be honest about the threat model)
Loaded JS runs with full DOM/network access — there is no real sandbox in the browser short of an iframe with a sandboxed origin. For a personal-use app this is acceptable, but document it loudly in the Add-Source UI: **"Only add sources from repos you trust. Source code runs in your browser with full network access."**

Optional hardening (later): run sources inside a same-origin iframe with `sandbox="allow-scripts"`, communicate via `postMessage`. Not in the MVP.

### iOS PWA gotchas
- Service worker storage on iOS can be **evicted aggressively** after ~7 days of non-use. Don't treat cached chapters as durable storage; mark explicit downloads with the `navigator.storage.persist()` request.
- iOS Safari needs `apple-touch-icon`, `apple-mobile-web-app-capable`, and per-device splash screens. Generate these and place in `/public`.
- Background sync and Web Push are limited on iOS — don't rely on them for the reader.
- Test the installed PWA, not just the in-browser tab. Some APIs (like `window.open`) behave differently.

### Reader UX
- Two modes: vertical-scroll (webtoon) and paginated (RTL/LTR).
- Prefetch the next 3 images of the current chapter and the first image of the next chapter.
- Use `decoding="async"` and `loading="eager"` for the visible page, `loading="lazy"` for the rest in scroll mode.
- Persist read progress on page change with a debounced IndexedDB write.

### Storage budget
- Library + metadata: tiny, IndexedDB.
- Image cache: bounded LRU in Cache Storage, configurable (default 500 MB). Evict on quota errors.
- Explicit downloads: separate cache bucket, never auto-evicted.

---

## Development Workflow

### Setup
```bash
pnpm install
pnpm dev          # localhost:3000
```

### Useful commands
```bash
pnpm lint
pnpm typecheck    # tsc --noEmit
pnpm build        # production build, run before pushing big changes
pnpm test         # vitest, when tests exist
```

### Deploying
- Push to `main` → Vercel auto-deploys.
- Preview branches get their own URLs; use them to test new source-loader changes without breaking the installed PWA.
- Bump the service worker version on any change that affects caching, or stale SWs will serve old code.

### Installing on iPhone/iPad
1. Open the Vercel URL in Safari (not Chrome — Chrome on iOS can't install PWAs).
2. Share → Add to Home Screen.
3. Open from the home screen icon to get the standalone (no Safari chrome) experience.

---

## Coding Conventions

- **TypeScript strict**, no `any` unless commented and justified.
- React Server Components for static shells; everything interactive is a client component marked with `"use client"`.
- Don't fetch source data from server components — sources are a client-side concept. Server components render the chrome, client components fetch.
- One concern per file. Source loader, registry, and sandbox are deliberately separate.
- Prefer composition over hooks-with-side-effects. Keep IndexedDB access behind small named functions in `lib/db/*`, not inline in components.
- Errors from sources must never crash the app. Wrap every source method call in `try/catch` and surface a toast.

---

## What to Build First (MVP Roadmap)

1. **Scaffold** Next 15 + Tailwind + shadcn + Serwist. Verify it installs as a PWA on iOS.
2. **IndexedDB layer** (`lib/db/*`) with library + progress + sources tables and a tiny migration system.
3. **Source registry UI** (`/sources`): paste GitHub URL → fetch manifest → preview → install. Store in IndexedDB.
4. **Source loader** (`lib/sources/loader.ts`): jsDelivr URL builder, dynamic import, zod validation, in-memory cache of loaded modules.
5. **Proxy route** (`/api/proxy`) with size cap + scheme whitelist.
6. **Browse a source** (`/browse/[sourceId]`): popular / latest / search, infinite scroll.
7. **Manga details + add to library**.
8. **Reader** with both modes, prefetch, progress save.
9. **Offline download** for a chapter (write image blobs into a dedicated Cache Storage bucket; mark chapter as downloaded in IDB).
10. **Settings**: storage usage, clear caches, export/import library JSON.

Stretch:
- Tracker sync (AniList OAuth, client-side PKCE flow).
- Cross-source search.
- Backup/restore to a user-provided GitHub Gist.

---

## Things NOT to do

- Do not ship any bundled source / scraper in this repo. The app must remain content-neutral.
- Do not add a database or auth. This is single-user, client-storage only.
- Do not load source code from arbitrary HTTPS URLs that aren't pinned to a commit. Pin to commits to prevent silent updates.
- Do not request `unsafe-eval` CSP. Dynamic `import()` of ES modules works without it.
- Do not log proxied URLs server-side beyond what Vercel does by default; treat the proxy as transient.

---

## Open Questions / Decisions to Revisit

- Should sources run inside a sandboxed iframe in v2? (Probably yes if this ever leaves personal use.)
- Should the proxy be moved off Vercel (where it shares a domain with the app) to reduce abuse exposure? Cloudflare Worker is an option.
- Should we support the Tachiyomi extension format directly via a Kotlin→JS shim, or only a native JS SDK? Current answer: native JS SDK only.
