"use client";

// A gift-item / sub-item photo. Shown at natural aspect (no cropping), capped
// so a tall photo doesn't dominate the card. Used in the owner editor + view,
// the giver view, and the public share page.
export function ItemPhoto({
  url,
  alt = "",
  maxH = "max-h-64",
  className = "",
}: {
  url: string;
  alt?: string;
  maxH?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={`${maxH} max-w-full rounded-xl border border-border bg-muted object-contain ${className}`}
    />
  );
}
