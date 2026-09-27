import { TEMPLATES } from "@/pdf/registry";
import TemplateCard from "@/components/TemplateCard";

export const metadata = {
  title: "Free Resume Templates",
  description: "Ten free, professionally designed resume templates — ATS-friendly single-column layouts, modern sidebars and creative designs. Customise colours and fonts and download as PDF.",
  alternates: { canonical: "/templates" },
};

export default function TemplatesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Resume templates",
    itemListElement: TEMPLATES.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: `${t.name} resume template`, description: t.description })),
  };
  return (
    <div className="bg-gradient-to-b from-brand-50/70 to-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-x py-14 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Free resume templates</h1>
          <p className="mt-4 text-lg text-slate-600">
            Pick a design to start. You can switch templates any time without losing your content, and every one can be tuned with your own colours and fonts.
          </p>
        </div>
        <div className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t, i) => (
            <TemplateCard key={t.id} template={t} priority={i < 4} />
          ))}
        </div>
        <div className="mx-auto mt-20 max-w-3xl rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="font-display text-xl font-bold text-ink">Which template should I choose?</h2>
          <ul className="mt-4 space-y-3 text-slate-600">
            <li><b className="text-ink">Applying through online portals?</b> Choose <b>Compact ATS</b>, <b>Classic</b> or <b>Basic Stylish</b>. Single-column layouts are the easiest for applicant tracking systems to read.</li>
            <li><b className="text-ink">Sending your resume directly to a person?</b> <b>Modern</b>, <b>Creative</b> and <b>Cool Blue</b> make a strong visual first impression.</li>
            <li><b className="text-ink">Printing it?</b> Avoid the dark templates, which use a lot of ink. Everything else prints cleanly on A4 or US Letter.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
