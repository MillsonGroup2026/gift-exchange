"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { RichText } from "@/components/rich-text";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SubItemDisplay } from "@/components/sub-item-display";
import { ItemLinks, effectiveItemLinks } from "@/components/item-links";
import { ItemPhoto } from "@/components/item-photo";
import { ItemIcon } from "@/components/item-icon";
import { uploadItemImage } from "@/lib/upload-image";
import {
  PRIORITY_LABELS,
  type ItemLink,
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
  links?: ItemLink[];
  image_url?: string | null;
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
  const [links, setLinks] = useState<ItemLink[]>(effectiveItemLinks(item));
  const [imageUrl, setImageUrl] = useState<string | null>(item.image_url ?? null);
  const [fetchingIdx, setFetchingIdx] = useState<number | null>(null);
  const [fetchingLinkIdx, setFetchingLinkIdx] = useState<number | null>(null);
  const [uploadingItem, setUploadingItem] = useState(false);
  const [uploadingOptIdx, setUploadingOptIdx] = useState<number | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const itemFileRef = useRef<HTMLInputElement>(null);

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

  function updateLink(i: number, url: string) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, url } : l)));
  }
  function addLink() {
    setLinks((prev) => [...prev, { url: "", label: null, link_meta: null }]);
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }
  async function fetchLinkMeta(i: number) {
    const raw = (links[i]?.url ?? "").trim();
    if (!raw) return;
    const full = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    setFetchingLinkIdx(i);
    try {
      const r = await fetch(`/api/link-meta?url=${encodeURIComponent(full)}`);
      if (r.ok) {
        const meta = (await r.json()) as LinkMeta;
        setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, url: full, link_meta: meta } : l)));
      }
    } catch {
      /* best-effort */
    } finally {
      setFetchingLinkIdx(null);
    }
  }

  async function onItemFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    setPhotoErr(null);
    setUploadingItem(true);
    const r = await uploadItemImage(file);
    if (r.error) setPhotoErr(r.error);
    else if (r.url) setImageUrl(r.url);
    setUploadingItem(false);
  }
  async function onOptFile(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoErr(null);
    setUploadingOptIdx(i);
    const r = await uploadItemImage(file);
    if (r.error) setPhotoErr(r.error);
    else if (r.url) updateOption(i, { image_url: r.url });
    setUploadingOptIdx(null);
  }

  async function save() {
    setSaving(true);
    const clean = options.filter((o) => (o.name ?? "").trim() || (o.url ?? "").trim() || (o.note ?? "").trim());
    const cleanLinks = links.filter((l) => (l.url ?? "").trim());
    await onSave({ title: title.trim() || "Untitled item", description: desc, priority, options: clean, links: cleanLinks, image_url: imageUrl });
    setSaving(false);
    setEditing(false);
  }
  function cancel() {
    setTitle(item.title);
    setDesc(item.description);
    setPriority(item.priority);
    setOptions(item.options ?? []);
    setLinks(effectiveItemLinks(item));
    setImageUrl(item.image_url ?? null);
    setPhotoErr(null);
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

        {/* Photo */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Photo (optional)</label>
          {imageUrl ? (
            <div className="space-y-1.5">
              <div className="relative inline-block">
                <ItemPhoto url={imageUrl} alt={title} maxH="max-h-48" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:text-brand-strong"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => itemFileRef.current?.click()}
                disabled={uploadingItem}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
              >
                {uploadingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Change photo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => itemFileRef.current?.click()}
              disabled={uploadingItem}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
            >
              {uploadingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Add photo
            </button>
          )}
          <input ref={itemFileRef} type="file" accept="image/*" onChange={onItemFile} className="hidden" />
          {photoErr && <p className="mt-1 text-xs text-brand-strong">{photoErr}</p>}
        </div>

        {/* Links */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Link (optional) — where to buy or see it. Add more than one if you like.
          </label>
          {links.length > 0 && (
            <div className="space-y-2">
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={l.url}
                    onChange={(e) => updateLink(i, e.target.value)}
                    onBlur={() => fetchLinkMeta(i)}
                    placeholder="Link (e.g. amazon.com/…)"
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
                  />
                  {fetchingLinkIdx === i && <Loader2 className="h-4 w-4 flex-none animate-spin text-muted-foreground" />}
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    className="flex-none text-muted-foreground hover:text-brand-strong"
                    aria-label="Remove link"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addLink}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Add link
          </button>
        </div>

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
                <input
                  value={o.note ?? ""}
                  onChange={(e) => updateOption(i, { note: e.target.value })}
                  placeholder="Note (optional) — e.g. size L, blue, any color is fine"
                  className="mt-2 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring"
                />
                <div className="mt-2 flex items-center gap-2">
                  {o.image_url && (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.image_url} alt="" className="h-12 w-12 rounded-md border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => updateOption(i, { image_url: null })}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-background text-muted-foreground shadow ring-1 ring-border transition-colors hover:text-brand-strong"
                        aria-label="Remove sub-item photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
                    {uploadingOptIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {o.image_url ? "Change photo" : "Add photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onOptFile(i, e)} />
                  </label>
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
        {item.image_url && <ItemPhoto url={item.image_url} alt={item.title} maxH="max-h-56" className="mt-3" />}
        {item.description?.html && <RichText html={item.description.html} className="mt-2" />}
        <ItemLinks item={item} className="mt-3" />
        {item.options?.length > 0 && (
          <div className="mt-3 space-y-2">
            {item.options.map((o) => (
              <SubItemDisplay key={o.id} option={o} />
            ))}
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
