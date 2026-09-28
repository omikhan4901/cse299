import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { templatesIn } from "@/pdf/registry";
import { CATEGORY_PAGES, categoryPage, faqSchema, jsonLdHtml, abs } from "@/lib/seo";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import TemplateCard from "@/components/TemplateCard";

export const dynamicParams = false;
export const generateStaticParams = () => CATEGORY_PAGES.map((c) => ({ slug: c.slug }));

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const c = categoryPage(slug);
  if (!c) return {};
  return {
    title: c.metaTitle,
    description: c.description,
    alternates: { canonical: `/templates/category/${c.slug}` },
    openGraph: { title: c.metaTitle, description: c.description, url: `/templates/category/${c.slug}` },
  };
}

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const c = categoryPage(slug);
  if (!c) notFound();
  const templates = templatesIn(c.id);
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.title,
    itemListElement: templates.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/templates/${t.slug}`), name: `${t.name} resume template` })),
  };

  return (
    <div className="bg-gradient-to-b from-brand-50/60 to-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(list)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(faqSchema(c.faqs))} />
      <div className="container-x py-10 md:py-14">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Resume templates", path: "/templates" }, { name: c.title, path: `/templates/category/${c.slug}` }]} />
        <div className="mt-8 grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-slate-600">{c.intro}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="font-semibold text-ink">Best for</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {c.bestFor.map((b) => <li key={b} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-brand" /> {b}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t, i) => <TemplateCard key={t.id} template={t} priority={i < 4} />)}
        </div>

        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="font-display text-2xl font-bold text-ink">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {c.faqs.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer list-none font-semibold text-ink">{f.q}</summary>
                <p className="mt-2 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-xl font-bold text-ink">Other template styles</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORY_PAGES.filter((x) => x.slug !== c.slug).map((x) => (
              <Link key={x.slug} href={`/templates/category/${x.slug}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand">{x.title}</Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
