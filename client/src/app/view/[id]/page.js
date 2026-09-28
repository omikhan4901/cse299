import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import WebResume from "@/components/public/WebResume";
import PublicActions from "@/components/public/PublicActions";
import SharedResumeView from "@/components/public/SharedResumeView";
import { getPublicResume } from "@/lib/publicResume";
import { splitList, toHref } from "@/lib/resume";
import { SITE_NAME } from "@/lib/config";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { resume } = await getPublicResume(id);
  if (!resume) return { title: "Resume", robots: { index: false } };
  const { name, title } = resume.personal;
  const heading = [name || "Resume", title].filter(Boolean).join(" – ");
  const description = (resume.summary || `${name}'s resume, built with ${SITE_NAME}.`).slice(0, 160);
  return {
    title: heading,
    description,
    // Shared resumes hold personal details: open to anyone with the link, but kept out of search results.
    robots: { index: false, follow: true },
    alternates: { canonical: `/view/${id}` },
    openGraph: { type: "profile", title: heading, description, url: `/view/${id}` },
    twitter: { card: "summary_large_image", title: heading, description },
  };
}

export default async function PublicResumePage({ params }) {
  const { id } = await params;
  const result = await getPublicResume(id);
  if (result.notFound) notFound();

  if (result.unavailable) {
    return (
      <>
        <Navbar />
        <main className="container-x py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This resume is taking a moment to load</h1>
          <p className="mt-2 text-slate-500">Our free server is waking up. Please refresh the page in a few seconds.</p>
          <Link href={`/view/${id}`} className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white">Refresh</Link>
        </main>
      </>
    );
  }

  const { resume } = result;
  const p = resume.personal;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name || undefined,
    jobTitle: p.title || undefined,
    email: p.email ? `mailto:${p.email}` : undefined,
    address: p.city ? { "@type": "PostalAddress", addressLocality: p.city } : undefined,
    sameAs: [p.linkedin, p.website].filter(Boolean).map(toHref),
    knowsAbout: splitList(resume.skills),
    alumniOf: resume.education.map((e) => ({ "@type": "EducationalOrganization", name: e.institution })).filter((e) => e.name),
    worksFor: resume.experience[0]?.company ? { "@type": "Organization", name: resume.experience[0].company } : undefined,
  };

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="min-h-screen bg-slate-100 pb-20">
        <PublicActions resume={resume} />
        <div className="container-x">
          <SharedResumeView resume={resume}>
            <WebResume resume={resume} />
          </SharedResumeView>
          <p className="mt-8 text-center text-sm text-slate-500">
            Made with{" "}
            <Link href="/" className="font-medium text-brand hover:underline">
              {SITE_NAME}
            </Link>{" "}
            — the free resume builder.{" "}
            <Link href="/builder" className="font-medium text-brand hover:underline">
              Create yours →
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
