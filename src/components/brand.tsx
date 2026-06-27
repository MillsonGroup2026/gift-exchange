import Link from "next/link";

export function GiftMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
      <path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5h4Z" />
      <path d="M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5h-4Z" />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-foreground">
        <GiftMark className="h-4 w-4" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Wishwell
      </span>
    </Link>
  );
}
