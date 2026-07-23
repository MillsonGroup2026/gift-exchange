"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { RichText } from "@/components/rich-text";
import { RichTextEditor } from "@/components/rich-text-editor";
import { LinkCard } from "@/components/link-card";
import { ItemIcon } from "@/components/item-icon";
import {
  PRIORITY_LABELS,
  type ItemOptionInput,
  type LinkMeta,
  type ListItem,
  type Priority,
  type RichText as RichTextT,
} from "@/lib/types";

export type ItemPatch = {
  title?: string;
  description?: RichTextT;
  options?: ItemOptionInput[];
  priority?: Priority;
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
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [options, setOptions] = useState<ItemOptionInput[]>(item.options ?? []);
  const [fetchingIdx, setFetchingIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function updateOption(i: number, patch: Partial<ItemOptionInput>) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, { name: "", url: "" }]);
  }
  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }
  async function fetchOptMeta(i: number) {
    const url = (options[i]?.url ?? "").trim();
    if (!url) return;
    const full = /^https?:\/\//i.test(url) ? url : "https://" + url;
    setFetchingIdx(i);
    try {
      const r = await fetch(`/api/link-meta?url=${encodeURIComponent(full)}`);
      if (r.ok) {
        const meta = (await r.json()) as LinkMeta;
        setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, url: full, link_meta: meta } : o)));
      }
    } catch {
      /* best-effort */
    } finally {
      setFetchingIdx(null);
    }
  }

  async function save() {
    setSaving(true);
    const clean = options.filter((o) => (o.name ?? "").trim() || (o.url ?? "").trim());
    await onSave({ title: title.trim() || "Untitled item", description: desc, priority, options: clean });
    setSaving(false);
    setEditing(false);
  }
  function cancel() {
    setTitle(item.title);
    setDesc(item.description);
    setPriority(item.priority);
    setOptions(item.options ?? []);
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

        {/* Sub-items */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Sub-items (optional) — specific options a giver can claim. Leave empty to make the whole item claimable.
          </label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={o.id ?? `new-${i}`} className="rounded-lg border border-border bg-background p-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-md bg-muted text-muted-foreground">
                    <ItemIcon title={o.name || o.url || ""} className="h-3.5 w-3.5" />
                  </span>
                  <input
                    value={o.name ?? ""}
                    onChange={(e) => updateOption(i, { name: e.target.value })}
                    placeholder="Name (e.g. Aaron Judge jersey)"
                    className="min-w-0 flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="flex-none text-muted-foreground hover:text-brand-strong"
                    aria-label="Remove sub-item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={o.url ?? ""}
                    onChange={(e) => updateOption(i, { url: e.target.value })}
                    onBlur={() => fetchOptMeta(i)}
                    placeholder="Link (optional)"
                    className="min-w-0 flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring"
                  />
                  {fetchingIdx === i && <Loader2 className="h-4 w-4 flex-none animate-spin text-muted-foreground" />}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Add sub-item
          </button>
        </div>

        {/* Notes */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (bold, lists, headings…)</label>
          <RichTextEditor
            key={item.id}
            initialHtml={item.description?.html}
            onChange={(v) => setDesc(v.html ? v : null)}
          />
        </div>

        {/* Priority */}
        <div className="mt-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">How much? (priority)</span>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as Priority)}
              className="h-[38px] w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring sm:w-56"
            >
              <option value={1}>Would love it</option>
              <option value={2}>Would like it</option>
              <option value={3}>Nice extra</option>
            </select>
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
    <div className="group flex gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      {dragHandle}
      <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-muted text-muted-foreground">
        <ItemIcon title={item.title} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-card-foreground">{item.title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle[item.priority]}`}>
            {PRIORITY_LABELS[item.priority]}
          </span>
        </div>
        {item.description?.html && <RichText html={item.description.html} className="mt-2" />}
        {item.options?.length > 0 && (
          <div className="mt-3 space-y-2">
            {item.options.map((o) =>
              o.url ? (
                <LinkCard key={o.id} url={o.url} meta={o.link_meta} label={o.name} />
              ) : (
                <div
                  key={o.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-sm"
                >
                  <ItemIcon title={o.name ?? ""} className="h-4 w-4 flex-none text-muted-foreground" />
                  <span className="font-medium text-foreground">{o.name}</span>
                </div>
              ),
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex h-9 flex-none items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Edit item"
      >
        <Pencil className="h-4 w-4" /> Edit
      </button>
    </div>
  );
}
