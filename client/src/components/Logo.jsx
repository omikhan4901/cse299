import Link from "next/link";

export function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#007B7B" />
      <path d="M10 8h8.5a5.5 5.5 0 0 1 1.6 10.76L23.5 24h-4.3l-3-4.8H14V24h-4V8zm4 3.6v4.1h4.3a2.05 2.05 0 0 0 0-4.1H14z" fill="#fff" />
      <circle cx="25" cy="8" r="2.4" fill="#5eead4" />
    </svg>
  );
}

export default function Logo({ href, light = false }) {
  const content = (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className={`font-display text-xl font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Resume<span className="text-brand">X</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="ResumeX home">
      {content}
    </Link>
  ) : (
    content
  );
}
