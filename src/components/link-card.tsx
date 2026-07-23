"use client";

import { useState } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import type { LinkMeta } from "@/lib/types";

export function LinkCard({
  url,
  meta,
  label,
}: {
  url: string;
  meta?: LinkMeta | null;
  label?: string | null;
}) {
  const [imgOk, setImgOk] = useState(true);
  const [favOk, setFavOk] = useState(true);
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw url */
  }
  const title = label || meta?.title || host;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-brand/40"
    >
      {meta?.image && imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.image}
          alt=""
          onError={() => setImgOk(false)}
          className="h-12 w-12 flex-none rounded-lg object-cover"
        />
      ) : (
        <span className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-muted">
          {meta?.favicon && favOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.favicon} alt="" onError={() => setFavOk(false)} className="h-5 w-5" />
          ) : (
            <Link2 className="h-5 w-5 text-muted-foreground" />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{host}</span>
      </span>
      <ExternalLink className="h-4 w-4 flex-none text-muted-foreground" />
    </a>
  );
}
