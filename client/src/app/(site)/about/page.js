import Link from "next/link";
import { Lightbulb, Layers, Hammer, Rocket, ArrowRight } from "lucide-react";
import { GithubIcon as Github } from "@/components/BrandIcons";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export const metadata = {
  title: "About ResumeX & FAQ",
  description: "ResumeX is a free resume builder built as a CSE299 project. Learn how it works, what's under the hood and answers to common questions.",
  alternates: { canonical: "/about" },
};

const JOURNEY = [
  { icon: Lightbulb, title: "The problem", text: "Formatting a resume is tedious, and the good tools are expensive or lock the PDF behind a paywall. Students needed a smart, free alternative." },
  { icon: Layers, title: "The architecture", text: "A MongoDB, Express and Node.js API with JWT authentication, and a React front end — now on Next.js so every public page is fast and search-friendly." },
  { icon: Hammer, title: "The hard part: PDFs", text: "Browser printing made layouts break across pages. Version 2 renders real PDFs with a dedicated layout engine, so the preview and the download are identical." },
  { icon: Rocket, title: "Version 2.0", text: "Fifty templates in seven categories, custom colours and fonts, live PDF preview, share links, master profiles and a builder that works without an account." },
];

const FAQ = [
  { q: "Is ResumeX really free?", a: "Yes. Building, downloading and sharing resumes is free, with no watermarks. It's a student project, not a business." },
  { q: "Do I need an account?", a: "No. You can build and download a resume straight away — your draft is kept in your browser. Create an account when you want to save several resumes, sync them across devices or share a public link." },
  { q: "Will my resume get through applicant tracking systems (ATS)?", a: "Every template exports a text-based PDF, so ATS software can read it. For online applications, the single-column templates (Compact ATS, Classic and Basic Stylish) are the safest choice." },
  { q: "Why does my PDF look exactly like the preview?", a: "Because the preview is the PDF. We render the real file as you type and show you its pages, instead of printing a web page." },
  { q: "Is my data private?", a: "Your resumes are stored in a database protected by your account and are private unless you turn on sharing. Passwords are hashed with bcrypt and we never sell your data." },
  { q: "What is a master profile?", a: "A resume that holds all your experience in one place. When you create a resume for a specific job, you can fill it from your master profile in one click and then trim it down." },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="container-x py-16 text-center md:py-24">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand-200">CSE299 project</span>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Smarter resumes, built by students for students
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            ResumeX turns your experience into a polished, professional PDF in minutes — with a live preview, beautiful templates and no paywalls.
          </p>
        </div>
      </section>

      <section className="container-x py-16">
        <h2 className="text-center font-display text-3xl font-bold text-ink">The journey</h2>
        <Stagger as="ol" className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2" gap={0.1}>
          {JOURNEY.map((j) => (
            <StaggerItem as="li" key={j.title} className="group flex gap-4 rounded-2xl border border-slate-200 p-6 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand transition duration-300 group-hover:scale-110 group-hover:-rotate-6">
                <j.icon size={20} />
              </span>
              <div>
                <h3 className="font-semibold text-ink">{j.title}</h3>
                <p className="mt-1 text-slate-600">{j.text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container-x">
          <h2 className="text-center font-display text-3xl font-bold text-ink">The team</h2>
          <Stagger className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2" gap={0.15}>
            {[
              { name: "Mehboob Ehsan Khan", role: "Lead developer", gh: "omikhan4901" },
              { name: "Nabigah Bin Sayeed", role: "Developer", gh: "Nabigah274" },
            ].map((m) => (
              <StaggerItem key={m.gh} className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-navy font-display text-xl font-bold text-white">
                  {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <h3 className="mt-4 font-semibold text-ink">{m.name}</h3>
                <p className="text-sm text-slate-500">{m.role}</p>
                <a href={`https://github.com/${m.gh}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                  <Github size={15} /> {m.gh}
                </a>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
            Built with Next.js, React, Tailwind CSS, Ant Design, react-pdf, Node.js, Express, MongoDB and Google Gemini.
          </p>
        </div>
      </section>

      <section className="container-x py-16">
        <h2 className="text-center font-display text-3xl font-bold text-ink">Frequently asked questions</h2>
        <Reveal className="mx-auto mt-10 max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-ink">
                {f.q}
                <span className="text-xl text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </Reveal>
        <div className="mt-12 text-center">
          <Link href="/builder" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark">
            Start building <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
