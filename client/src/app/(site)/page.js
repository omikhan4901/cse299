import Link from "next/link";
import {
  ArrowRight, Eye, Download, Share2, Crown, Palette, ScanSearch, Sparkles, FileText, MousePointerClick, CheckCircle2, Star,
} from "lucide-react";
import { TEMPLATES, templateById } from "@/pdf/registry";
import TemplateCard from "@/components/TemplateCard";
import HeroVisual from "@/components/HeroVisual";
import TemplateMarquee from "@/components/TemplateMarquee";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
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
  { icon: MousePointerClick, title: "Pick a template", text: "Start from 50 designs in seven styles — from ATS-safe single columns to bold sidebars." },
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div aria-hidden className="animate-blob absolute -top-24 -left-24 h-80 w-80 rounded-full bg-teal-200/50 blur-3xl" />
        <div aria-hidden className="animate-blob absolute top-40 right-0 h-96 w-96 rounded-full bg-sky-200/40 blur-3xl" style={{ animationDelay: "-6s" }} />
        <div className="container-x relative grid items-center gap-12 pt-14 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-20">
          <Stagger immediate gap={0.1} delay={0.05}>
            <StaggerItem>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand shadow-sm">
              <Sparkles size={13} /> Free · No sign-up needed to start
            </span>
            </StaggerItem>
            <StaggerItem as="h1" className="mt-5 font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Build the resume that <span className="text-gradient-animated">lands the job</span>
            </StaggerItem>
            <StaggerItem as="p" className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Pick a designer template, fill in your story and watch a real PDF update as you type. Download it in one click — no watermarks, no paywalls.
            </StaggerItem>
            <StaggerItem className="mt-8 flex flex-wrap gap-3">
              <Link href="/builder" className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-xl hover:shadow-brand/30">
                Build my resume <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </Link>
              <Link href="/templates" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-ink transition hover:-translate-y-0.5 hover:border-brand-200 hover:text-brand hover:shadow-md">
                Browse templates
              </Link>
            </StaggerItem>
            <StaggerItem as="p" className="mt-3 text-sm text-slate-500">
              Privacy first?{" "}
              <Link href="/builder?private=1" className="font-medium text-brand hover:underline">Start a private session</Link>{" "}
              — nothing is saved on our servers or in your browser.
            </StaggerItem>
            <StaggerItem as="ul" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {["50 professional templates", "Pixel-perfect PDF", "Private mode: nothing saved"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-brand" /> {t}
                </li>
              ))}
            </StaggerItem>
          </Stagger>

          <HeroVisual />
        </div>
      </section>

      {/* Template strip */}
      <section className="border-y border-slate-100 bg-white py-10">
        <Reveal className="container-x mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold tracking-wider text-brand uppercase">{TEMPLATES.length} templates · any colour · any font</p>
          <p className="text-sm text-slate-500">Hover to pause, click to start with one</p>
        </Reveal>
        <TemplateMarquee />
      </section>

      {/* How it works */}
      <section className="container-x py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wider text-brand uppercase">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Three steps to a standout resume</h2>
        </Reveal>
        <Stagger as="ol" className="mt-12 grid gap-6 md:grid-cols-3" gap={0.12}>
          {STEPS.map((s, i) => (
            <StaggerItem as="li" key={s.title} className="group relative rounded-2xl border border-slate-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <span className="absolute top-6 right-6 font-display text-5xl font-extrabold text-slate-100 transition group-hover:text-brand-100">{i + 1}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand transition duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-brand group-hover:text-white">
                <s.icon size={22} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-slate-600">{s.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Templates */}
      <section className="bg-slate-50 py-20">
        <div className="container-x">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-wider text-brand uppercase">Templates</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Designs recruiters remember</h2>
              <p className="mt-2 max-w-xl text-slate-600">Every template works with any colour and font, and every one exports to a clean PDF.</p>
            </div>
            <Link href="/templates" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
              See all {TEMPLATES.length} templates <ArrowRight size={16} />
            </Link>
          </Reveal>
          <Stagger className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {["Nordic", "Sunset", "Executive", "Metro"].map(templateById).map((t) => (
              <StaggerItem key={t.id}>
                <TemplateCard template={t} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Features */}
      <section className="container-x py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wider text-brand uppercase">Why ResumeX</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Everything you need, nothing you don&apos;t</h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" gap={0.07}>
          {FEATURES.map((f) => (
            <StaggerItem key={f.title} className="group rounded-2xl border border-slate-200 p-6 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand transition duration-300 group-hover:scale-110 group-hover:rotate-6">
                <f.icon size={21} />
              </span>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{f.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-gradient-to-r from-navy to-brand p-7 text-white sm:flex-row sm:items-center bg-[length:200%_100%] animate-[gradient-pan_10s_ease-in-out_infinite]">
          <Sparkles size={28} className="shrink-0 animate-pulse text-teal-200" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              AI writing assistant {AI_ENABLED ? null : <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 align-middle text-xs font-medium">Coming back soon</span>}
            </h3>
            <p className="mt-1 text-white/75">Polish bullet points, check your resume against a job description and draft cover letters — powered by Google Gemini.</p>
          </div>
        </Reveal>
      </section>

      {/* Reviews */}
      <section className="bg-slate-50 py-20">
        <div className="container-x">
          <Reveal as="h2" className="text-center font-display text-3xl font-bold text-ink sm:text-4xl">Loved by students</Reveal>
          <Stagger className="mt-12 grid gap-6 md:grid-cols-3" gap={0.12}>
            {REVIEWS.map((r) => (
              <StaggerItem as="figure" key={r.name} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
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
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section className="container-x py-20">
        <Reveal className="relative overflow-hidden rounded-3xl bg-navy px-6 py-16 text-center sm:px-16">
          <div className="bg-grid absolute inset-0 opacity-20" />
          <div aria-hidden className="animate-blob absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
          <div aria-hidden className="animate-blob absolute -top-24 right-0 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" style={{ animationDelay: "-8s" }} />
          <h2 className="relative font-display text-3xl font-bold text-white sm:text-4xl">Ready to build your resume?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/70">It takes about ten minutes. Start now — you can create an account later to save your work.</p>
          <Link href="/builder" className="btn-shine group relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-semibold text-navy shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-50 hover:shadow-2xl">
            Create my resume <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>
    </>
  );
}
