"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Strikethrough,
  List as BulletIcon,
  ListOrdered,
  Heading2,
  Heading3,
  Undo2,
  Redo2,
} from "lucide-react";

function TB({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-40 ${
        active
          ? "bg-brand/15 text-brand-strong"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  initialHtml,
  onChange,
}: {
  initialHtml?: string | null;
  onChange: (value: { html: string; text: string }) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: initialHtml || "",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich min-h-[7rem] px-3 py-2 focus:outline-none" },
    },
    onUpdate: ({ editor }) => {
      onChange({
        html: editor.isEmpty ? "" : editor.getHTML(),
        text: editor.getText(),
      });
    },
  });

  if (!editor) {
    return <div className="h-40 rounded-lg border border-border bg-background" />;
  }

  const icon = "h-4 w-4";
  return (
    <div className="rounded-lg border border-border bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
        <TB title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className={icon} />
        </TB>
        <TB title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className={icon} />
        </TB>
        <TB title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className={icon} />
        </TB>
        <span className="mx-1 h-5 w-px bg-border" />
        <TB title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className={icon} />
        </TB>
        <TB title="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className={icon} />
        </TB>
        <span className="mx-1 h-5 w-px bg-border" />
        <TB title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <BulletIcon className={icon} />
        </TB>
        <TB title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className={icon} />
        </TB>
        <span className="mx-1 h-5 w-px bg-border" />
        <TB title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className={icon} />
        </TB>
        <TB title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className={icon} />
        </TB>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
