import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Eye, Download, Share2, Crown, Palette, ScanSearch, Sparkles, FileText, MousePointerClick, CheckCircle2, Star,
} from "lucide-react";
import { TEMPLATES } from "@/pdf/registry";
import TemplateCard from "@/components/TemplateCard";
import { AI_ENABLED, SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/config";

export const metadata = { alternates: { canonical: "/" } };

const FEATURES = [
  { icon: Eye, title: "Live PDF preview", text: "What you see is exactly the file you download — real pages, real page breaks, no surprises." },
  { icon: Download, title: "One-click download", text: "No print dialogs or browser settings. Get a crisp, text-based PDF named after you." },
  { icon: Palette, title: "Your colours & fonts", text: "Pick an accent colour, choose from six professional fonts and switch between A4 and US Letter." },
  { icon: ScanSearch, title: "ATS-friendly", text: "Selectable text and clean structure, so applicant tracking systems can read every word." },
  { icon: Share2, title: "Share with a link", text: "Publish your resume as a web page with a PDF download — perfect for LinkedIn and email." },
  { icon: Crown, title: "Master profile", text: "Keep everything in one master resume, then spin off tailored versions for each job." },
];

const STEPS = [
  { icon: MousePointerClick, title: "Pick a template", text: "Start from ten designs — from classic single-column to bold sidebars." },
  { icon: FileText, title: "Fill in your story", text: "Guided sections with tips for each part. Your progress saves as you type." },
  { icon: Download, title: "Download & apply", text: "Export a pixel-perfect PDF or share a public link in seconds." },
];

const REVIEWS = [
  { name: "Wasif Haider", role: "CS Student", text: "Seeing the real PDF update while I type is a game changer. My resume finally fits on one page." },
  { name: "Oni Hasan", role: "Intern Applicant", text: "I used the Modern template and got compliments on the design during my first interview!" },
  { name: "Samin Yeaser", role: "Business Major", text: "Finally, a resume builder that doesn't charge me to download the PDF. Lifesaver." },
];

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  const hero = ["Modern", "Classic", "CoolBlue"].map((id) => TEMPLATES.find((t) => t.id === id));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="container-x relative grid items-center gap-12 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand shadow-sm">
              <Sparkles size={13} /> Free · No sign-up needed to start
            </span>
            <h1 className="mt-5 font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Build the resume that <span className="bg-gradient-to-r from-brand to-teal-500 bg-clip-text text-transparent">lands the job</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Pick a designer template, fill in your story and watch a real PDF update as you type. Download it in one click — no watermarks, no paywalls.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/builder" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark">
                Build my resume <ArrowRight size={18} />
              </Link>
              <Link href="/templates" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-ink transition hover:border-brand-200 hover:text-brand">
                Browse templates
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {["10 professional templates", "Pixel-perfect PDF", "A4 & US Letter"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-brand" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto h-[420px] w-full max-w-[520px] sm:h-[520px]">
            {hero.map((t, i) => (
              <div
                key={t.id}
                className="absolute top-1/2 left-1/2 w-[58%] overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-slate-900/10"
                style={{ transform: `translate(-50%, -50%) translateX(${(i - 1) * 34}%) rotate(${(i - 1) * 7}deg) scale(${i === 1 ? 1 : 0.9})`, zIndex: i === 1 ? 3 : 1 }}
              >
                <Image src={`/templates/${t.id}.jpg`} alt={`${t.name} resume template`} width={827} height={1170} priority className="h-auto w-full" />
              </div>
            ))}
            <div className="absolute top-10 -left-2 z-10 hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-ink shadow-lg ring-1 ring-slate-900/5 sm:flex">
              <Eye size={16} className="text-brand" /> Live preview
            </div>
            <div className="absolute right-0 bottom-12 z-10 hidden items-center gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-white shadow-lg sm:flex">
              <Download size={16} className="text-teal-300" /> Resume.pdf ready
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-x py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wider text-brand uppercase">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Three steps to a standout resume</h2>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-slate-200 bg-white p-7">
              <span className="absolute top-6 right-6 font-display text-5xl font-extrabold text-slate-100">{i + 1}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand">
                <s.icon size={22} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Templates */}
      <section className="bg-slate-50 py-20">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-wider text-brand uppercase">Templates</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Designs recruiters remember</h2>
              <p className="mt-2 max-w-xl text-slate-600">Every template works with any colour and font, and every one exports to a clean PDF.</p>
            </div>
            <Link href="/templates" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
              See all {TEMPLATES.length} templates <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.slice(0, 4).map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-x py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wider text-brand uppercase">Why ResumeX</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Everything you need, nothing you don&apos;t</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-6 transition hover:border-brand-200 hover:shadow-md">
              <f.icon size={22} className="text-brand" />
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-gradient-to-r from-navy to-brand p-7 text-white sm:flex-row sm:items-center">
          <Sparkles size={28} className="shrink-0 text-teal-200" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              AI writing assistant {AI_ENABLED ? null : <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 align-middle text-xs font-medium">Coming back soon</span>}
            </h3>
            <p className="mt-1 text-white/75">Polish bullet points, check your resume against a job description and draft cover letters — powered by Google Gemini.</p>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-slate-50 py-20">
        <div className="container-x">
          <h2 className="text-center font-display text-3xl font-bold text-ink sm:text-4xl">Loved by students</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {REVIEWS.map((r) => (
              <figure key={r.name} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
                <div className="flex gap-0.5 text-amber-400">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={16} className="fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 text-slate-700">“{r.text}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand">{r.name[0]}</span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{r.name}</span>
                    <span className="block text-xs text-slate-500">{r.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-x py-20">
        <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-16 text-center sm:px-16">
          <div className="bg-grid absolute inset-0 opacity-20" />
          <h2 className="relative font-display text-3xl font-bold text-white sm:text-4xl">Ready to build your resume?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/70">It takes about ten minutes. Start now — you can create an account later to save your work.</p>
          <Link href="/builder" className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-semibold text-navy shadow-lg transition hover:bg-brand-50">
            Create my resume <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
