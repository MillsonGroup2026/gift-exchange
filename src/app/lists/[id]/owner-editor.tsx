"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Eye, GripVertical, Plus, Trash2 } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { OCCASIONS, type ItemOption, type ListItem, type ListShare, type WishList } from "@/lib/types";
import {
  addItem,
  deleteList,
  reorderItem,
  setItemOptions,
  softDeleteItem,
  updateItem,
  updateListMeta,
} from "@/app/lists/actions";
import { OwnerItemCard, type ItemPatch } from "./owner-item-card";
import { SharePanel } from "./share-panel";

function SortableRow({
  item,
  onSave,
  onDelete,
  defaultEditing,
}: {
  item: ListItem;
  onSave: (patch: ItemPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  defaultEditing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      <OwnerItemCard
        item={item}
        onSave={onSave}
        onDelete={onDelete}
        defaultEditing={defaultEditing}
        dragHandle={
          <button
            type="button"
            className="mt-0.5 h-7 w-6 flex-none cursor-grab touch-none text-muted-foreground/50 transition-colors hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        }
      />
    </div>
  );
}

export function OwnerEditor({
  list,
  initialItems,
  shares,
  myGroups,
  shareOrigin,
}: {
  list: WishList;
  initialItems: ListItem[];
  shares: ListShare[];
  myGroups: { id: string; name: string }[];
  shareOrigin: string;
}) {
  const [items, setItems] = useState<ListItem[]>(initialItems);
  const [title, setTitle] = useState(list.title);
  const [occasion, setOccasion] = useState(list.occasion ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function saveMeta() {
    updateListMeta(list.id, { title: title.trim() || "Untitled list", occasion: occasion.trim() || null });
  }

  async function handleSave(itemId: string, patch: ItemPatch) {
    await updateItem(itemId, {
      title: patch.title,
      description: patch.description,
      priority: patch.priority,
    });
    let savedOptions: ItemOption[] | undefined;
    if (patch.options !== undefined) {
      const r = await setItemOptions(itemId, list.id, patch.options);
      if (r?.options) savedOptions = r.options as ItemOption[];
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              ...(patch.title !== undefined ? { title: patch.title } : {}),
              ...(patch.description !== undefined ? { description: patch.description } : {}),
              ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
              ...(savedOptions ? { options: savedOptions } : {}),
            }
          : i,
      ),
    );
  }

  async function handleDelete(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await softDeleteItem(itemId);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const t = newTitle.trim();
    if (!t) return;
    setNewTitle("");
    const r = await addItem(list.id, t);
    if (r?.item) {
      setItems((prev) => [...prev, { ...(r.item as ListItem), options: [] }]);
      setJustAdded((r.item as ListItem).id);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex);
      const before = moved[newIndex - 1];
      const after = moved[newIndex + 1];
      const pos =
        before && after
          ? (before.position + after.position) / 2
          : after
            ? after.position - 1
            : before
              ? before.position + 1
              : 0;
      reorderItem(String(active.id), pos);
      return moved.map((i) => (i.id === active.id ? { ...i, position: pos } : i));
    });
  }

  function onDeleteList() {
    if (confirm("Delete this whole list? This can't be undone.")) deleteList(list.id);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> All lists
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          {/* List meta */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveMeta}
            className="w-full rounded-lg border border-transparent bg-transparent text-3xl font-semibold tracking-tight text-foreground outline-none hover:border-border focus:border-ring focus:bg-background focus:px-2"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              onBlur={saveMeta}
              list="occasions"
              placeholder="Add an occasion"
              className="rounded-md border border-transparent bg-transparent text-sm text-muted-foreground outline-none hover:border-border focus:border-ring focus:bg-background focus:px-2 focus:py-1"
            />
            <datalist id="occasions">
              {OCCASIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {list.status === "shared" ? "Shared" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Click any item to edit it, drag the handle to reorder. You can keep editing after sharing.
          </p>

          {/* Items */}
          <div className="mt-6 space-y-3">
            {items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
                <p className="text-foreground">Nothing here yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first item below — a title is all you need to start.
                </p>
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {items.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      defaultEditing={item.id === justAdded}
                      onSave={(patch) => handleSave(item.id, patch)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Add item */}
          <form onSubmit={handleAdd} className="mt-4 flex items-center gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add an item…"
              className="h-11 flex-1 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </form>

          <button
            type="button"
            onClick={onDeleteList}
            className="mt-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-strong"
          >
            <Trash2 className="h-4 w-4" /> Delete this list
          </button>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <SharePanel
            listId={list.id}
            initialToken={list.public_share_token}
            initialShares={shares}
            myGroups={myGroups}
            shareOrigin={shareOrigin}
          />
          {list.public_share_token && (
            <a
              href={`${shareOrigin}/share/${list.public_share_token}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Eye className="h-4 w-4" /> Preview the public view
            </a>
          )}
        </aside>
      </main>
    </div>
  );
}
