import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { TEMPLATES, templateBySlug, templatesIn, categoryById, isPremiumTemplate } from "@/pdf/registry";
import TemplateCta from "@/components/billing/TemplateCta";
import { categoryPageFor, abs, jsonLdHtml } from "@/lib/seo";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import TemplateCard from "@/components/TemplateCard";

export const dynamicParams = false;
export const generateStaticParams = () => TEMPLATES.map((t) => ({ slug: t.slug }));

const layoutText = (t) =>
  t.tags.includes("Sidebar") ? "a sidebar layout" : t.tags.includes("Two column") ? "a two-column layout" : t.tags.includes("Side headings") ? "a single column with side headings" : "a single-column layout";
const atsSafe = (t) => !t.tags.some((x) => /Sidebar|Two column|Photo/.test(x));

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const t = templateBySlug(slug);
  if (!t) return {};
  const cat = categoryById(t.category);
  const title = `${t.name} Resume Template – Free ${atsSafe(t) ? "ATS-Friendly " : ""}PDF`;
  const description = `${t.description} A free ${cat.name.toLowerCase()} resume template with ${layoutText(t)}. Edit it online, change colours and fonts, and download a PDF in minutes.`;
  return {
    title,
    description,
    alternates: { canonical: `/templates/${t.slug}` },
    openGraph: { title, description, url: `/templates/${t.slug}`, images: [{ url: `/templates/${t.id}.jpg`, width: 827, height: 1170, alt: `${t.name} resume template` }] },
    twitter: { card: "summary_large_image", title, description, images: [`/templates/${t.id}.jpg`] },
  };
}

export default async function TemplatePage({ params }) {
  const { slug } = await params;
  const t = templateBySlug(slug);
  if (!t) notFound();
  const cat = categoryById(t.category);
  const catPage = categoryPageFor(t.category);
  const related = templatesIn(t.category).filter((x) => x.id !== t.id).slice(0, 4);
  const safe = atsSafe(t);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: `${t.name} resume template`,
    description: t.description,
    image: abs(`/templates/${t.id}.jpg`),
    url: abs(`/templates/${t.slug}`),
    isAccessibleForFree: true,
    genre: cat.name,
    publisher: { "@type": "Organization", name: "ResumeX", url: abs("/") },
  };

  return (
    <div className="bg-gradient-to-b from-brand-50/60 to-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(jsonLd)} />
      <div className="container-x py-10 md:py-14">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Resume templates", path: "/templates" },
            { name: cat.name, path: `/templates/category/${catPage.slug}` },
            { name: t.name, path: `/templates/${t.slug}` },
          ]}
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,31,42,.35)] lg:sticky lg:top-24">
            <Image src={`/templates/${t.id}.jpg`} alt={`${t.name} resume template preview`} width={827} height={1170} priority sizes="(min-width: 1024px) 440px, 90vw" className="h-auto w-full" />
          </div>
          <div>
            <Link href={`/templates/category/${catPage.slug}`} className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand-100">{cat.name}</Link>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{t.name} resume template</h1>
            <p className="mt-4 text-lg text-slate-600">
              {t.description} It uses {layoutText(t)}{t.tags.includes("Photo") ? " with room for a photo" : ""} and the {t.font} font by default. You can switch to any colour or font, and your content moves with you if you change templates later.
            </p>
            <div className={`mt-6 flex gap-3 rounded-2xl border p-4 ${safe ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              {safe ? <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={20} /> : <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />}
              <div className="text-sm">
                <p className="font-semibold text-ink">{safe ? "ATS-friendly" : "Best for sending directly to people"}</p>
                <p className="mt-0.5 text-slate-600">
                  {safe
                    ? "Real text, standard headings and a single reading order, so applicant tracking systems read it cleanly."
                    : "Columns and photos look great to people, but some older applicant tracking systems read them out of order. Run the built-in ATS check before applying online."}
                </p>
              </div>
            </div>
            <ul className="mt-6 grid gap-2.5 text-slate-700 sm:grid-cols-2">
              {[isPremiumTemplate(t) ? "Edit and download as a PDF" : "Free to edit and download", "Live PDF preview as you type", "Any colour, 11 fonts, A4 or Letter", "Built-in ATS score and keyword match", "AI help with bullet points", "Private mode: nothing saved"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm"><Check size={16} className="shrink-0 text-brand" /> {f}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <TemplateCta template={{ id: t.id, name: t.name }} />
              <Link href={`/templates/category/${catPage.slug}`} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-ink hover:border-brand-200 hover:text-brand">
                More {cat.name.toLowerCase()} templates
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              New to resumes? Read <Link href="/resume-guide" className="font-medium text-brand hover:underline">how to write a good resume</Link> or check an existing one with our <Link href="/ats-checker" className="font-medium text-brand hover:underline">free ATS checker</Link>.
            </p>
          </div>
        </div>

        {related.length ? (
          <section className="mt-20">
            <h2 className="font-display text-2xl font-bold text-ink">Similar templates</h2>
            <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => <TemplateCard key={r.id} template={r} />)}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
