import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { breadcrumbs, jsonLdHtml } from "@/lib/seo";

/** Visible breadcrumb trail plus BreadcrumbList structured data. */
export default function Breadcrumbs({ items }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbs(items))} />
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((it, i) => (
            <li key={it.path} className="flex items-center gap-1">
              {i ? <ChevronRight size={14} className="text-slate-300" /> : null}
              {i === items.length - 1 ? (
                <span aria-current="page" className="text-slate-700">{it.name}</span>
              ) : (
                <Link href={it.path} className="hover:text-brand">{it.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
