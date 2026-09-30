import Link from "next/link";
import { FileSearch, ListChecks, Target, CheckCircle2, ShieldCheck } from "lucide-react";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { abs, faqSchema, jsonLdHtml } from "@/lib/seo";
import { SITE_NAME } from "@/lib/config";
import AtsUpload from "@/components/ats/AtsUpload";

const TITLE = "Free ATS Resume Checker – Test Your Resume Score";
const DESCRIPTION = "Upload your resume PDF and check it against applicant tracking systems for free. We read your PDF the way an ATS does, run 30+ checks and match it to a job description's keywords.";

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
    text: "Can software read your PDF? We extract its text and find its sections the way an ATS parser does.",
    checks: ["Real, selectable text", "Standard section headings", "Email and phone are readable", "Characters come through cleanly", "Columns and images", "Page count"],
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
  { n: 1, title: "Upload your PDF", text: "The resume you're about to send, exported as a PDF." },
  { n: 2, title: "Add the job description", text: "Optional, but it shows exactly which keywords you're missing." },
  { n: 3, title: "Fix and re-check", text: "Every issue comes with a specific fix. Checks inside the builder are unlimited." },
];

const FAQS = [
  { q: "What is an ATS?", a: "An applicant tracking system is software that companies use to collect, parse and rank job applications. It reads the text of your resume, sorts it into fields and matches it against the job, often before a recruiter sees it." },
  { q: "Is the ATS checker free?", a: `Yes. You can check resume PDFs here without an account (a fair-use limit per hour applies), and run as many checks as you like inside the ${SITE_NAME} builder.` },
  { q: "How is the ATS score calculated?", a: "Your score combines three groups: parsing (can the PDF be read), content quality (verbs, numbers, structure) and, if you paste a job description, keyword and requirement match. Critical problems such as unreadable text cap the score." },
  { q: "What is a good ATS score?", a: "85 or above is excellent and 70 to 84 is good. More important than the number is fixing the items marked as failures, especially parsing problems and missing keywords from the job." },
  { q: "Does the checker read my actual PDF?", a: "Yes. We extract the text from the PDF you upload and find its sections the way an ATS does, so layout problems such as columns, images and unreadable fonts show up too." },
  { q: "Is my resume stored?", a: "No. The PDF you upload is sent over an encrypted connection, read once to extract its text, and discarded. It isn't saved or used for anything else. The checks themselves run in your browser." },
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
          <AtsUpload
            intro={
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand"><ShieldCheck size={12} /> Free · No sign-up · Never stored</span>
                <h1 className="mt-5 font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-ink sm:text-5xl">Free ATS resume checker</h1>
                <p className="mt-5 max-w-xl text-lg text-slate-600">
                  Find out if applicant tracking systems can read your resume before you apply. Upload your PDF: we read it the way an ATS does, run 30+ checks and show you exactly what to fix.
                </p>
                <Link href="/templates/category/ats-friendly" className="mt-6 inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
                  Browse ATS-friendly templates
                </Link>
              </>
            }
          />
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
