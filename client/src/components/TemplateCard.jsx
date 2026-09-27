import Link from "next/link";
import Image from "next/image";

export default function TemplateCard({ template, priority = false }) {
  return (
    <Link href={`/builder?template=${template.id}`} className="group block">
      <div className="relative aspect-[1/1.414] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
        <Image src={`/templates/${template.id}.jpg`} alt={`${template.name} resume template preview`} fill sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw" className="object-cover object-top" priority={priority} />
        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink/70 via-ink/0 to-transparent pb-6 opacity-0 transition group-hover:opacity-100">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-lg">Use this template</span>
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-ink">{template.name}</h3>
          <p className="text-sm text-slate-500">{template.description}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {template.tags.map((t) => (
          <span key={t} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t === "ATS" ? "bg-emerald-50 text-emerald-700" : t === "New" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}
