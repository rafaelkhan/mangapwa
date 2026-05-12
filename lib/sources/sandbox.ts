import type { SourceContext } from "./types";

export function createSourceContext(): SourceContext {
  return {
    async fetch(url, init) {
      const opts = init ?? {};
      const useProxy = opts.proxy === true;
      if (!useProxy) {
        return fetch(url, opts);
      }
      const proxied = new URL("/api/proxy", window.location.origin);
      proxied.searchParams.set("url", url);
      const headers = new Headers(opts.headers);
      const fwd: Record<string, string> = {};
      headers.forEach((v, k) => {
        fwd[k] = v;
      });
      if (Object.keys(fwd).length > 0) {
        proxied.searchParams.set("h", btoa(JSON.stringify(fwd)));
      }
      return fetch(proxied.toString(), {
        method: opts.method ?? "GET",
        body: opts.body,
      });
    },
    parseHTML(html) {
      return new DOMParser().parseFromString(html, "text/html");
    },
  };
}

export function proxyImageUrl(
  url: string,
  headers?: Record<string, string>
): string {
  if (typeof window === "undefined") return url;
  const proxied = new URL("/api/proxy", window.location.origin);
  proxied.searchParams.set("url", url);
  if (headers && Object.keys(headers).length > 0) {
    proxied.searchParams.set("h", btoa(JSON.stringify(headers)));
  }
  return proxied.toString();
}
