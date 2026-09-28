import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { GUIDES } from "@/content/guides";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { abs, jsonLdHtml } from "@/lib/seo";
import { BuilderLink } from "@/components/BuilderLauncher";

const TITLE = "Resume & CV Writing Guides";
const DESCRIPTION = "Free, practical guides to writing a resume that gets interviews: fresh graduate resumes, ATS-friendly formatting, internships, action verbs, CV vs resume and more.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/guides" },
};

const ALL = [
  {
    slug: null,
    href: "/resume-guide",
    title: "How to Write a Good Resume (Step-by-Step Guide)",
    description: "Structure, bullet points, keywords, formatting and the mistakes to avoid. Start here.",
    readMinutes: 8,
  },
  ...GUIDES.map((g) => ({ ...g, href: `/guides/${g.slug}` })),
];

export default function GuidesPage() {
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    itemListElement: ALL.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: abs(g.href), name: g.title })),
  };
  return (
    <div className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(list)} />
      <div className="container-x py-10 md:py-14">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }]} />
        <div className="mt-8 max-w-2xl">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Resume &amp; CV guides</h1>
          <p className="mt-4 text-lg text-slate-600">{DESCRIPTION}</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ALL.map((g, i) => (
            <Link key={g.href} href={g.href} className={`group flex flex-col rounded-2xl border p-6 transition hover:-translate-y-0.5 hover:shadow-lg ${i === 0 ? "border-brand/40 bg-brand-50/60" : "border-slate-200 bg-white"}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white"><BookOpen size={18} /></span>
              <h2 className="mt-4 font-display text-lg font-bold text-ink group-hover:text-brand">{g.title}</h2>
              <p className="mt-2 flex-1 text-sm text-slate-600">{g.description}</p>
              <p className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><Clock size={13} /> {g.readMinutes} min read</span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand">Read <ArrowRight size={13} /></span>
              </p>
            </Link>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl bg-gradient-to-br from-brand to-navy p-8 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-2xl font-bold">Ready to write yours?</p>
            <p className="mt-1 text-white/80">Pick one of 50 free templates and download a PDF in minutes.</p>
          </div>
          <BuilderLink className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-navy">Build my resume <ArrowRight size={16} /></BuilderLink>
        </div>
      </div>
    </div>
  );
}
