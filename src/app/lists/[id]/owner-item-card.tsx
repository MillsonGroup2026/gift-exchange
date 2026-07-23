"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { RichText } from "@/components/rich-text";
import { RichTextEditor } from "@/components/rich-text-editor";
import { LinkCard } from "@/components/link-card";
import {
  PRIORITY_LABELS,
  type ItemLink,
  type LinkMeta,
  type ListItem,
  type Priority,
  type RichText as RichTextT,
} from "@/lib/types";

export type ItemPatch = {
  title?: string;
  description?: RichTextT;
  links?: ItemLink[];
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
  const [links, setLinks] = useState<ItemLink[]>(item.links ?? []);
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [saving, setSaving] = useState(false);

  async function addLink() {
    let u = newUrl.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    setFetchingMeta(true);
    let meta: LinkMeta | null = null;
    try {
      const r = await fetch(`/api/link-meta?url=${encodeURIComponent(u)}`);
      if (r.ok) meta = (await r.json()) as LinkMeta;
    } catch {
      /* preview is best-effort */
    }
    setFetchingMeta(false);
    setLinks((prev) => [...prev, { url: u, label: newLabel.trim() || null, link_meta: meta }]);
    setNewUrl("");
    setNewLabel("");
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    await onSave({ title: title.trim() || "Untitled item", description: desc, links, priority, quantity });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setTitle(item.title);
    setDesc(item.description);
    setLinks(item.links ?? []);
    setPriority(item.priority);
    setQuantity(item.quantity);
    setNewUrl("");
    setNewLabel("");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-brand/40 bg-card p-4 shadow-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it? (e.g. Yankees jersey)"
          autoFocus
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />

        {/* Links */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Links (optional) — add as many options as you like
          </label>
          {links.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {links.map((l, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {l.label || l.link_meta?.title || l.url}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{l.url}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    className="flex-none text-muted-foreground hover:text-brand-strong"
                    aria-label="Remove link"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              placeholder="Paste a product link…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring sm:w-40"
            />
            <button
              type="button"
              onClick={addLink}
              disabled={fetchingMeta || !newUrl.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              {fetchingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </div>
        </div>

        {/* Notes */}
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

        {/* Priority + quantity */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">How much? (priority)</span>
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
        {item.links?.length > 0 && (
          <div className="mt-3 space-y-2">
            {item.links.map((l, i) => (
              <LinkCard key={i} url={l.url} meta={l.link_meta} label={l.label} />
            ))}
          </div>
        )}
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
