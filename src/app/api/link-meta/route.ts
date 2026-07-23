import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Best-effort server-side link preview: fetches a URL and scrapes title /
 * description / image / favicon. Degrades to {} on any failure. Auth-gated to
 * limit abuse.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });

  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  if (!target) return NextResponse.json({});

  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return NextResponse.json({});
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return NextResponse.json({});

  const fallback = {
    favicon: `${u.origin}/favicon.ico`,
    siteName: u.hostname.replace(/^www\./, ""),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; WishingWellBot/1.0; +https://wishing-well.app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    const html = (await res.text()).slice(0, 200_000);

    const pick = (re: RegExp) => html.match(re)?.[1]?.trim();
    const meta = (prop: string) =>
      pick(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")) ||
      pick(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));

    const title = meta("og:title") || pick(/<title[^>]*>([^<]+)<\/title>/i);
    const description = meta("og:description") || meta("description");
    const image = meta("og:image") || meta("og:image:url");
    const siteName = meta("og:site_name") || fallback.siteName;

    return NextResponse.json({
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      siteName,
      favicon: fallback.favicon,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
