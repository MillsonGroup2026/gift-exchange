"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { RichText } from "@/components/rich-text";
import { RichTextEditor } from "@/components/rich-text-editor";
import { LinkCard } from "@/components/link-card";
import {
  PRIORITY_LABELS,
  type LinkMeta,
  type ListItem,
  type Priority,
  type RichText as RichTextT,
} from "@/lib/types";

export type ItemPatch = {
  title?: string;
  description?: RichTextT;
  url?: string | null;
  link_meta?: LinkMeta | null;
  priority?: Priority;
  quantity?: number;
};

const priorityStyle: Record<Priority, string> = {
  1: "bg-brand/12 text-brand-strong",
  2: "bg-accent/10 text-accent",
  3: "bg-muted text-muted-foreground",
};

export function OwnerItemCard({
  item,
  onSave,
  onDelete,
  defaultEditing = false,
  dragHandle,
}: {
  item: ListItem;
  onSave: (patch: ItemPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  defaultEditing?: boolean;
  dragHandle?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(defaultEditing);
  const [title, setTitle] = useState(item.title);
  const [desc, setDesc] = useState<RichTextT>(item.description);
  const [url, setUrl] = useState(item.url ?? "");
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [linkMeta, setLinkMeta] = useState<LinkMeta | null>(item.link_meta);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [saving, setSaving] = useState(false);

  async function fetchMeta() {
    const trimmed = url.trim();
    if (!trimmed) {
      setLinkMeta(null);
      return;
    }
    setFetchingMeta(true);
    try {
      const r = await fetch(`/api/link-meta?url=${encodeURIComponent(trimmed)}`);
      if (r.ok) setLinkMeta((await r.json()) as LinkMeta);
    } catch {
      /* preview is best-effort */
    } finally {
      setFetchingMeta(false);
    }
  }

  async function save() {
    setSaving(true);
    await onSave({
      title: title.trim() || "Untitled item",
      description: desc,
      url: url.trim() || null,
      link_meta: url.trim() ? linkMeta : null,
      priority,
      quantity,
    });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setTitle(item.title);
    setDesc(item.description);
    setUrl(item.url ?? "");
    setPriority(item.priority);
    setQuantity(item.quantity);
    setLinkMeta(item.link_meta);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-brand/40 bg-card p-4 shadow-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it?"
          autoFocus
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Notes (bold, lists, headings…)
          </label>
          <RichTextEditor
            key={item.id}
            initialHtml={item.description?.html}
            onChange={(v) => setDesc(v.html ? v : null)}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Link (optional)</span>
            <div className="relative">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={fetchMeta}
                placeholder="https://…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              {fetchingMeta && (
                <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">How much?</span>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as Priority)}
                className="h-[38px] rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring"
              >
                <option value={1}>Would love it</option>
                <option value={2}>Would like it</option>
                <option value={3}>Nice extra</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Quantity</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="h-[38px] rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring"
              />
            </label>
          </div>
        </div>

        {url.trim() && <LinkCard url={url.trim()} meta={linkMeta} />}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      {dragHandle}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-card-foreground">{item.title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle[item.priority]}`}>
            {PRIORITY_LABELS[item.priority]}
          </span>
          {item.quantity > 1 && (
            <span className="text-xs text-muted-foreground">Wants {item.quantity}</span>
          )}
        </div>
        {item.description?.html && <RichText html={item.description.html} className="mt-2" />}
        {item.url && <LinkCard url={item.url} meta={item.link_meta} />}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="h-8 flex-none rounded-lg px-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
        aria-label="Edit item"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
