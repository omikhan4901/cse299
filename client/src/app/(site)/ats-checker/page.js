import Link from "next/link";
import { ArrowRight, FileSearch, ListChecks, Target, CheckCircle2, AlertTriangle, XCircle, Lock } from "lucide-react";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { abs, faqSchema, jsonLdHtml } from "@/lib/seo";
import { SITE_NAME } from "@/lib/config";

const TITLE = "Free ATS Resume Checker – Test Your Resume Score";
const DESCRIPTION = "Check your resume against applicant tracking systems for free. We read your real PDF the way an ATS does, run 30+ checks and match it to a job description's keywords.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["ATS resume checker", "ATS checker", "resume scanner", "ATS score", "resume keyword checker", "free ATS check"],
  alternates: { canonical: "/ats-checker" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/ats-checker" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const GROUPS = [
  {
    icon: FileSearch,
    title: "ATS parsing",
    text: "Can software read your PDF? We render your real file and extract its text like an ATS parser.",
    checks: ["Real, selectable text", "Standard section headings", "Email and phone are readable", "Text survives extraction", "Reading order of columns", "Page count and photo"],
  },
  {
    icon: ListChecks,
    title: "Content quality",
    text: "What recruiters and ranking engines reward, checked line by line.",
    checks: ["Action verbs", "Quantified results", "Bullet length and count", "No clichés or pronouns", "Consistent dates, most recent first", "Summary, skills and education"],
  },
  {
    icon: Target,
    title: "Job match",
    text: "Paste a job description to see how well your resume fits it.",
    checks: ["Keywords weighted by importance", "Missing keywords list", "Job title alignment", "Years of experience", "Degree requirement"],
  },
];

const STEPS = [
  { n: 1, title: "Open the builder", text: "Start from a template, or import your existing resume." },
  { n: 2, title: "Click “ATS check”", text: "Optionally paste the job description you're applying for." },
  { n: 3, title: "Fix and re-check", text: "Every issue comes with a specific fix. Edit, then scan again." },
];

const FAQS = [
  { q: "What is an ATS?", a: "An applicant tracking system is software that companies use to collect, parse and rank job applications. It reads the text of your resume, sorts it into fields and matches it against the job, often before a recruiter sees it." },
  { q: "Is the ATS checker free?", a: `Yes. The ATS check in ${SITE_NAME} is free to use and runs in your browser, so you don't need an account to try it.` },
  { q: "How is the ATS score calculated?", a: "Your score combines three groups: parsing (can the PDF be read), content quality (verbs, numbers, structure) and, if you paste a job description, keyword and requirement match. Critical problems such as unreadable text cap the score." },
  { q: "What is a good ATS score?", a: "85 or above is excellent and 70 to 84 is good. More important than the number is fixing the items marked as failures, especially parsing problems and missing keywords from the job." },
  { q: "Does the checker read my actual PDF?", a: "Yes. Most checkers only look at the text you type. We render the real PDF you would download and extract its text the way an ATS does, so layout problems show up too." },
  { q: "Is my resume uploaded anywhere?", a: "No. The ATS check runs entirely in your browser. Your resume is only sent to our servers if you choose the optional AI review afterwards." },
];

const SAMPLE = [
  { icon: CheckCircle2, tone: "text-emerald-600", label: "Text can be extracted", note: "Every word is real, selectable text." },
  { icon: CheckCircle2, tone: "text-emerald-600", label: "Starts with action verbs", note: "82% of your points start with a strong verb." },
  { icon: AlertTriangle, tone: "text-amber-500", label: "Quantified results", note: "25% of points include a number. Aim for 40%+." },
  { icon: XCircle, tone: "text-rose-500", label: "Missing keywords", note: "SQL, stakeholder management, Power BI" },
];

export default function AtsCheckerPage() {
  const app = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${SITE_NAME} ATS Resume Checker`,
    url: abs("/ats-checker"),
    description: DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(app)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(faqSchema(FAQS))} />
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="container-x py-10 md:py-14">
          <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "ATS resume checker", path: "/ats-checker" }]} />
          <div className="mt-8 grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand"><Lock size={12} /> Free · Runs in your browser</span>
              <h1 className="mt-5 font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-ink sm:text-5xl">Free ATS resume checker</h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600">
                Find out if applicant tracking systems can read your resume before you apply. We read your real PDF the way an ATS does, run 30+ checks and show you exactly what to fix.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/builder?check=ats" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark">
                  Check my resume <ArrowRight size={18} />
                </Link>
                <Link href="/templates/category/ats-friendly" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-ink hover:border-brand-200 hover:text-brand">
                  ATS-friendly templates
                </Link>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(15,31,42,.35)]" aria-label="Example ATS report">
              <div className="flex items-center gap-4">
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-[6px] border-teal-500 font-display text-2xl font-extrabold text-ink">78</span>
                <div>
                  <p className="font-display text-lg font-bold text-ink">Good</p>
                  <p className="text-sm text-slate-500">ATS score for “Data Analyst”</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {SAMPLE.map((s) => (
                  <li key={s.label} className="flex gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <s.icon size={18} className={`mt-0.5 shrink-0 ${s.tone}`} />
                    <span><span className="block text-sm font-semibold text-ink">{s.label}</span><span className="text-xs text-slate-500">{s.note}</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-center text-xs text-slate-400">Example report</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-x py-16">
        <h2 className="text-center font-display text-3xl font-bold text-ink">What the ATS checker looks at</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.title} className="rounded-2xl border border-slate-200 p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand"><g.icon size={20} /></span>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{g.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{g.text}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                {g.checks.map((c) => <li key={c} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand" /> {c}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container-x">
          <h2 className="text-center font-display text-3xl font-bold text-ink">How to check your resume</h2>
          <ol className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl bg-white p-6 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand font-bold text-white">{s.n}</span>
                <h3 className="mt-3 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl font-bold text-ink">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer list-none font-semibold text-ink">{f.q}</summary>
                <p className="mt-2 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-slate-600">
            Want to go deeper? Read <Link href="/guides/ats-friendly-resume" className="font-medium text-brand underline">how to make an ATS-friendly resume</Link> and{" "}
            <Link href="/guides/tailor-resume-to-job-description" className="font-medium text-brand underline">how to tailor your resume to a job description</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
