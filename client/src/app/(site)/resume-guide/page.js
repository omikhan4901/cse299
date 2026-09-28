import { ArrowRight } from "lucide-react";
import { RESUME_GUIDE } from "@/content/resumeGuide";
import Markdown, { parseMarkdown, slugify } from "@/components/Markdown";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { abs, jsonLdHtml } from "@/lib/seo";
import { LEGAL_UPDATED } from "@/lib/config";
import { BuilderLink } from "@/components/BuilderLauncher";

const TITLE = "How to Write a Good Resume (Step-by-Step Guide)";
const DESCRIPTION = "A practical guide to writing a resume that gets interviews: how to structure sections, write strong bullet points, tailor keywords for ATS, avoid common mistakes and format it right.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/resume-guide" },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION, url: "/resume-guide" },
};

export default function ResumeGuidePage() {
  const sections = parseMarkdown(RESUME_GUIDE).filter((b) => b.type === "h2");
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    url: abs("/resume-guide"),
    dateModified: new Date(LEGAL_UPDATED).toISOString(),
    author: { "@type": "Organization", name: "ResumeX", url: abs("/") },
    publisher: { "@type": "Organization", name: "ResumeX", logo: { "@type": "ImageObject", url: abs("/logo.svg") } },
  };
  return (
    <div className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(article)} />
      <div className="container-x py-10 md:py-14">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: "How to write a good resume", path: "/resume-guide" }]} />
        <div className="mt-8 grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-24" aria-label="Contents">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Contents</p>
              <ul className="space-y-1 text-sm">
                {sections.map((s) => (
                  <li key={s.text}><a href={`#${slugify(s.text)}`} className="block rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-brand">{s.text}</a></li>
                ))}
              </ul>
              <BuilderLink className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">
                Start my resume <ArrowRight size={16} />
              </BuilderLink>
            </nav>
          </aside>
          <article className="max-w-3xl text-[17px] leading-relaxed text-slate-700">
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">How to write a good resume</h1>
            <p className="mt-3 text-sm text-slate-500">Updated {LEGAL_UPDATED} · 8 min read</p>
            <div className="mt-8">
              <Markdown markdown={RESUME_GUIDE} large skipTitle />
            </div>
            <div className="mt-12 rounded-2xl bg-gradient-to-br from-brand to-navy p-8 text-white">
              <p className="font-display text-2xl font-bold">Put it into practice</p>
              <p className="mt-2 text-white/80">Build your resume with a live PDF preview, then check it with our free ATS checker. Our AI assistant follows this same guide.</p>
              <BuilderLink className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-navy">Build my resume <ArrowRight size={16} /></BuilderLink>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
