/**
 * Renders stored rich-text HTML. Content is sanitised on write (see
 * lib/sanitize.ts) and constrained to Tiptap's safe schema.
 */
export function RichText({
  html,
  className,
}: {
  html?: string | null;
  className?: string;
}) {
  if (!html) return null;
  return (
    <div
      className={`rich ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
