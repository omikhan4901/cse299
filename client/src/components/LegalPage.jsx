import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/config";

/** Shared layout for the privacy policy and terms. */
export default function LegalPage({ title, intro, children }) {
  return (
    <div className="bg-gradient-to-b from-brand-50/60 to-white">
      <article className="container-x max-w-3xl py-14 md:py-20">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-6 text-lg text-slate-600">{intro}</p>
        <div className="legal mt-10 space-y-8 text-[15px] leading-relaxed text-slate-600 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_b]:text-ink">
          {children}
        </div>
      </article>
    </div>
  );
}

export function Contact() {
  return CONTACT_EMAIL ? (
    <>
      email us at{" "}
      <a className="font-medium text-brand hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
    </>
  ) : (
    "contact us through the details on our About page"
  );
}
