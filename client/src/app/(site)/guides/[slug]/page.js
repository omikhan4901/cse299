import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { GUIDES, guideBySlug } from "@/content/guides";
import Markdown, { parseMarkdown, slugify } from "@/components/Markdown";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { abs, jsonLdHtml } from "@/lib/seo";

export const dynamicParams = false;
export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));

const fmt = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export async function generateMetadata({ params }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  const url = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: url },
    openGraph: { type: "article", title: guide.title, description: guide.description, url, publishedTime: guide.date, modifiedTime: guide.date },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description },
  };
}

export default async function GuidePage({ params }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const url = `/guides/${guide.slug}`;
  const sections = parseMarkdown(guide.body).filter((b) => b.type === "h2");
  const related = [...GUIDES.filter((g) => g.slug !== guide.slug)].slice(0, 3);
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url: abs(url),
    mainEntityOfPage: abs(url),
    datePublished: guide.date,
    dateModified: guide.date,
    keywords: guide.keywords.join(", "),
    image: abs("/opengraph-image"),
    author: { "@type": "Organization", name: "ResumeX", url: abs("/") },
    publisher: { "@type": "Organization", name: "ResumeX", logo: { "@type": "ImageObject", url: abs("/logo.svg") } },
  };
  return (
    <div className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(article)} />
      <div className="container-x py-10 md:py-14">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: guide.title, path: url }]} />
        <div className="mt-8 grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-24" aria-label="Contents">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Contents</p>
              <ul className="space-y-1 text-sm">
                {sections.map((s) => (
                  <li key={s.text}><a href={`#${slugify(s.text)}`} className="block rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-brand">{s.text}</a></li>
                ))}
              </ul>
              <Link href="/builder" className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">
                Start my resume <ArrowRight size={16} />
              </Link>
            </nav>
          </aside>
          <article className="max-w-3xl text-[17px] leading-relaxed text-slate-700">
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{guide.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <time dateTime={guide.date}>{fmt(guide.date)}</time> · <Clock size={13} /> {guide.readMinutes} min read
            </p>
            <div className="mt-8">
              <Markdown markdown={guide.body} large skipTitle />
            </div>
            <div className="mt-12 rounded-2xl bg-gradient-to-br from-brand to-navy p-8 text-white">
              <p className="font-display text-2xl font-bold">Build your resume in minutes</p>
              <p className="mt-2 text-white/80">50 free templates, a live PDF preview and a real ATS check. No sign-up needed to start.</p>
              <Link href="/builder" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-navy">Build my resume <ArrowRight size={16} /></Link>
            </div>
            <section className="mt-14">
              <h2 className="font-display text-xl font-bold text-ink">Keep reading</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Link href="/resume-guide" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand">How to write a good resume</Link>
                {related.slice(0, 2).map((g) => (
                  <Link key={g.slug} href={`/guides/${g.slug}`} className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand">{g.title}</Link>
                ))}
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
