"use client";

import { LinkCard } from "./link-card";
import { ItemIcon } from "./item-icon";
import type { LinkMeta } from "@/lib/types";

type Opt = {
  name: string | null;
  url: string | null;
  link_meta: LinkMeta | null;
  note: string | null;
};

// Renders a sub-item that may be a link, a note, or both.
export function SubItemDisplay({ option }: { option: Opt }) {
  if (option.url) {
    return (
      <div className="space-y-1.5">
        <LinkCard url={option.url} meta={option.link_meta} label={option.name} />
        {option.note && <p className="pl-1 text-xs text-muted-foreground">{option.note}</p>}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-background p-3 text-sm">
      <ItemIcon title={option.name || option.note || ""} className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
      <span className="min-w-0">
        {option.name && <span className="font-medium text-foreground">{option.name}</span>}
        {option.name && option.note && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{option.note}</span>
        )}
        {!option.name && option.note && <span className="text-foreground">{option.note}</span>}
      </span>
    </div>
  );
}
