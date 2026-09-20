"use client";

import { LinkCard } from "./link-card";
import type { ItemLink, LinkMeta } from "@/lib/types";

type ItemLike = {
  url?: string | null;
  link_meta?: LinkMeta | null;
  links?: ItemLink[] | null;
};

// The links to show for an item. Prefer the `links` array; fall back to the
// legacy single `url` column so nothing an owner saved earlier is ever hidden.
export function effectiveItemLinks(item: ItemLike): ItemLink[] {
  if (item.links && item.links.length > 0) return item.links;
  if (item.url) return [{ url: item.url, label: null, link_meta: item.link_meta ?? null }];
  return [];
}

export function ItemLinks({ item, className = "" }: { item: ItemLike; className?: string }) {
  const links = effectiveItemLinks(item);
  if (links.length === 0) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {links.map((l, i) => (
        <LinkCard key={`${l.url}-${i}`} url={l.url} meta={l.link_meta ?? null} label={l.label ?? null} />
      ))}
    </div>
  );
}
