import Link from "next/link";
import { CATEGORIES, TEMPLATES, templatesIn } from "@/pdf/registry";
import { categoryPageFor, abs } from "@/lib/seo";
import TemplateCard from "@/components/TemplateCard";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export const metadata = {
  title: "50+ Free Resume Templates (ATS-Friendly & Creative)",
  description: `${TEMPLATES.length} free, professionally designed resume templates in seven styles — ATS-optimized, modern minimalist, creative, executive, academic, student and two-column. Customise colours and fonts and download as PDF.`,
  alternates: { canonical: "/templates" },
};

export default function TemplatesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Resume templates",
    itemListElement: TEMPLATES.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: `${t.name} resume template`, url: abs(`/templates/${t.slug}`) })),
  };
  return (
    <div className="bg-gradient-to-b from-brand-50/70 to-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-x py-14 md:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Free resume templates</h1>
          <p className="mt-4 text-lg text-slate-600">
            Pick a design to start. You can switch templates any time without losing your content, and every one can be tuned with your own colours and fonts.
          </p>
        </Reveal>
        <nav className="sticky top-16 z-20 -mx-4 mt-10 overflow-x-auto bg-white/80 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:border-slate-200 md:px-3 md:shadow-sm" aria-label="Template categories">
          <ul className="flex w-max gap-1 md:w-auto md:flex-wrap md:justify-center">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="block rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-brand-50 hover:text-brand">
                  {c.name} <span className="text-slate-400">{templatesIn(c.id).length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {CATEGORIES.map((c, ci) => (
          <section key={c.id} id={c.id} className="scroll-mt-36 pt-14">
            <Reveal className="mb-8 max-w-2xl">
              <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                <Link href={`/templates/category/${categoryPageFor(c.id).slug}`} className="hover:text-brand">{categoryPageFor(c.id).title}</Link>
              </h2>
              <p className="mt-1.5 text-slate-600">{c.description}</p>
            </Reveal>
            <Stagger className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4" gap={0.06}>
              {templatesIn(c.id).map((t, i) => (
                <StaggerItem key={t.id}>
                  <TemplateCard template={t} priority={ci === 0 && i < 4} />
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        ))}
        <Reveal className="mx-auto mt-20 max-w-3xl rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="font-display text-xl font-bold text-ink">Which template should I choose?</h2>
          <ul className="mt-4 space-y-3 text-slate-600">
            <li><b className="text-ink">Applying through online portals?</b> Pick anything from <b>ATS-Optimized</b>, or a one-column design without a photo. Single-column layouts with standard headings are the easiest for applicant tracking systems to read.</li>
            <li><b className="text-ink">Sending your resume directly to a person?</b> <b>Aesthetic / Creative</b> and <b>Two-Column</b> designs make a strong visual first impression.</li>
            <li><b className="text-ink">Senior, academic or just starting out?</b> <b>Executive</b> templates lead with experience, <b>Academic</b> ones make room for research and publications, and <b>Student</b> layouts put education and projects first.</li>
            <li><b className="text-ink">Printing it?</b> Avoid the dark templates, which use a lot of ink. Everything else prints cleanly on A4 or US Letter.</li>
          </ul>
        </Reveal>
      </div>
    </div>
  );
}
