/**
 * Resolve the app's PUBLIC origin from an incoming request.
 *
 * Behind a proxy like Render, `new URL(request.url).origin` is the *internal*
 * address (e.g. http://localhost:10000), so redirecting to it sends the browser
 * somewhere it can't reach. The proxy forwards the real host/scheme in the
 * x-forwarded-* headers, so use those first.
 */
export function getPublicOrigin(request: Request): string {
  const h = request.headers;
  const rawHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const host = rawHost.split(",")[0].trim();
  const rawProto = h.get("x-forwarded-proto");
  const proto =
    (rawProto ? rawProto.split(",")[0].trim() : "") ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
}
