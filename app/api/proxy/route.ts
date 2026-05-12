import type { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "cookie",
  "set-cookie",
]);

function badRequest(msg: string, status = 400): Response {
  return new Response(msg, { status });
}

export async function GET(request: NextRequest): Promise<Response> {
  return handle(request);
}

export async function HEAD(request: NextRequest): Promise<Response> {
  return handle(request);
}

async function handle(request: NextRequest): Promise<Response> {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) return badRequest("missing url");
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return badRequest("invalid url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return badRequest("scheme not allowed");
  }

  const fwdHeaders = new Headers();
  const hParam = request.nextUrl.searchParams.get("h");
  if (hParam) {
    try {
      const decoded = JSON.parse(atob(hParam)) as Record<string, string>;
      for (const [k, v] of Object.entries(decoded)) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) fwdHeaders.set(k, v);
      }
    } catch {
      return badRequest("invalid headers param");
    }
  }
  if (!fwdHeaders.has("User-Agent")) {
    fwdHeaders.set(
      "User-Agent",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 MangaPWA"
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), {
      method: request.method,
      headers: fwdHeaders,
      redirect: "follow",
    });
  } catch (err) {
    return new Response(`upstream fetch failed: ${(err as Error).message}`, {
      status: 502,
    });
  }

  const declared = upstream.headers.get("content-length");
  if (declared && Number(declared) > MAX_BYTES) {
    return new Response("response too large", { status: 413 });
  }

  const respHeaders = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-length",
    "cache-control",
    "etag",
    "last-modified",
    "expires",
  ];
  for (const h of passthroughHeaders) {
    const v = upstream.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  respHeaders.set("Access-Control-Allow-Origin", "*");

  if (!upstream.body) {
    return new Response(null, {
      status: upstream.status,
      headers: respHeaders,
    });
  }

  let total = 0;
  const reader = upstream.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      total += value.byteLength;
      if (total > MAX_BYTES) {
        controller.error(new Error("response exceeded size cap"));
        await reader.cancel();
        return;
      }
      controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });

  return new Response(stream, {
    status: upstream.status,
    headers: respHeaders,
  });
}
