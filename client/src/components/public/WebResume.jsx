import { Mail, Phone, MapPin, Globe, Link2 } from "lucide-react";
import { LinkedinIcon as Linkedin, GithubIcon as Github } from "../BrandIcons";
import { templateById } from "@/pdf/registry";
import { splitBullets, splitList, dateRange, toHref, prettyUrl } from "@/lib/resume";

const ICONS = { email: Mail, phone: Phone, city: MapPin, linkedin: Linkedin, github: Github, website: Globe, link: Link2 };

function Section({ title, children }) {
  return (
    <section className="border-t border-slate-100 py-7 first:border-t-0">
      <h2 className="mb-4 text-xs font-bold tracking-[0.18em] text-slate-400 uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** Web (HTML) version of a shared resume — readable by people and search engines. */
export default function WebResume({ resume }) {
  const tpl = templateById(resume.template);
  const accent = resume.theme.accent || (tpl.id.includes("Dark") ? "#4f46e5" : tpl.accent);
  const p = resume.personal;
  const contacts = [
    p.email && { type: "email", text: p.email, href: `mailto:${p.email}` },
    p.phone && { type: "phone", text: p.phone, href: `tel:${p.phone.replace(/[^\d+]/g, "")}` },
    p.city && { type: "city", text: p.city },
    p.linkedin && { type: "linkedin", text: prettyUrl(p.linkedin), href: toHref(p.linkedin) },
    p.github && { type: "github", text: prettyUrl(p.github), href: toHref(p.github) },
    p.website && { type: "website", text: prettyUrl(p.website), href: toHref(p.website) },
    ...resume.links.filter((l) => l.url).map((l) => ({ type: "link", key: `link-${l.id}`, text: l.label || prettyUrl(l.url), href: toHref(l.url) })),
  ].filter(Boolean);
  const skills = splitList(resume.skills);
  const languages = splitList(resume.languages);
  const interests = splitList(resume.interests);
  const hasAside = skills.length > 0 || languages.length > 0 || interests.length > 0 || resume.certifications.length > 0 || resume.courses.length > 0 || resume.awards.length > 0;

  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,31,42,0.25)]">
      <header className="relative px-6 pt-10 pb-8 text-white sm:px-12" style={{ background: `linear-gradient(135deg, ${accent}, #0f1f2a)` }}>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {p.profilePic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.profilePic} alt={p.name} className="h-28 w-28 rounded-full object-cover ring-4 ring-white/30" />
          ) : null}
          <div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{p.name || "Resume"}</h1>
            {p.title ? <p className="mt-1 text-lg text-white/80">{p.title}</p> : null}
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
              {contacts.map((c) => {
                const Icon = ICONS[c.type];
                const inner = (
                  <>
                    <Icon size={14} /> {c.text}
                  </>
                );
                return (
                  <li key={c.key || c.type}>
                    {c.href ? (
                      <a href={c.href} className="inline-flex items-center gap-1.5 text-white/85 hover:text-white hover:underline" target={["linkedin", "github", "website", "link"].includes(c.type) ? "_blank" : undefined} rel="noopener noreferrer">
                        {inner}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </header>

      <div className={`grid gap-x-12 px-6 sm:px-12 ${hasAside ? "md:grid-cols-[1fr_240px]" : ""}`}>
        <div>
          {resume.summary ? (
            <Section title="About">
              <p className="leading-relaxed whitespace-pre-line text-slate-700">{resume.summary}</p>
            </Section>
          ) : null}
          {resume.experience.length ? (
            <Section title="Experience">
              <ol className="space-y-6">
                {resume.experience.map((e) => (
                  <li key={e.id} className="relative border-l-2 pl-5" style={{ borderColor: `${accent}33` }}>
                    <span className="absolute top-1.5 -left-[7px] h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: accent }} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-semibold text-ink">{e.title}</h3>
                      <span className="text-sm text-slate-400">{dateRange(e.startDate, e.endDate)}</span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: accent }}>
                      {e.company}
                      {[e.location, e.employmentType].filter(Boolean).map((x) => (
                        <span key={x} className="font-normal text-slate-400"> · {x}</span>
                      ))}
                    </p>
                    {splitBullets(e.description).length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-[15px] text-slate-600 marker:text-slate-300">
                        {splitBullets(e.description).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}
          {resume.projects.length ? (
            <Section title="Projects">
              <ul className="space-y-4">
                {resume.projects.map((pr) => (
                  <li key={pr.id}>
                    <h3 className="font-semibold text-ink">
                      {pr.name}
                      {pr.link ? (
                        <a href={toHref(pr.link)} target="_blank" rel="noopener noreferrer" className="ml-2 text-sm font-normal hover:underline" style={{ color: accent }}>
                          {prettyUrl(pr.link)}
                        </a>
                      ) : null}
                    </h3>
                    {pr.role || pr.startDate || pr.endDate ? <p className="text-sm text-slate-400">{[pr.role, dateRange(pr.startDate, pr.endDate)].filter(Boolean).join(" · ")}</p> : null}
                    {pr.technologies ? (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {splitList(pr.technologies).map((t) => (
                          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t}</span>
                        ))}
                      </p>
                    ) : null}
                    <ul className="mt-1 space-y-0.5 text-[15px] text-slate-600">
                      {splitBullets(pr.description).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {resume.education.length ? (
            <Section title="Education">
              <ul className="space-y-4">
                {resume.education.map((ed) => (
                  <li key={ed.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-semibold text-ink">{ed.degree || ed.institution}</h3>
                      <span className="text-sm text-slate-400">{dateRange(ed.startYear, ed.endYear)}</span>
                    </div>
                    {ed.degree ? <p className="text-sm text-slate-600">{[ed.institution, ed.location].filter(Boolean).join(" · ")}</p> : null}
                    {ed.gpa ? <p className="text-sm text-slate-500">GPA: {ed.gpa}</p> : null}
                    {ed.details ? <p className="text-sm text-slate-500">{ed.details}</p> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {resume.volunteering.length ? (
            <Section title="Volunteering">
              <ul className="space-y-4">
                {resume.volunteering.map((v) => (
                  <li key={v.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-semibold text-ink">{v.role}</h3>
                      <span className="text-sm text-slate-400">{dateRange(v.startDate, v.endDate)}</span>
                    </div>
                    <p className="text-sm" style={{ color: accent }}>{[v.organization, v.location].filter(Boolean).join(" · ")}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[15px] text-slate-600 marker:text-slate-300">
                      {splitBullets(v.description).map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {resume.publications.length ? (
            <Section title="Publications">
              <ul className="space-y-3">
                {resume.publications.map((pub) => (
                  <li key={pub.id}>
                    <h3 className="font-semibold text-ink">
                      {pub.link ? <a href={toHref(pub.link)} target="_blank" rel="noopener noreferrer" className="hover:underline">{pub.title}</a> : pub.title}
                    </h3>
                    <p className="text-sm text-slate-500">{[pub.publisher, pub.date].filter(Boolean).join(" · ")}</p>
                    {pub.description ? <p className="text-[15px] text-slate-600">{pub.description}</p> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {resume.customSections.filter((sec) => sec.items.length).map((sec) => (
            <Section key={sec.id} title={sec.title || "Other"}>
              <ul className="space-y-4">
                {sec.items.map((it) => (
                  <li key={it.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-semibold text-ink">{it.title}</h3>
                      <span className="text-sm text-slate-400">{it.date}</span>
                    </div>
                    {it.subtitle ? <p className="text-sm" style={{ color: accent }}>{it.subtitle}</p> : null}
                    <ul className="mt-1 space-y-0.5 text-[15px] text-slate-600">
                      {splitBullets(it.description).map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            </Section>
          ))}
          {resume.references.length || resume.referencesOnRequest ? (
            <Section title="References">
              {resume.references.length ? (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {resume.references.map((r) => (
                    <li key={r.id} className="text-sm">
                      <p className="font-semibold text-ink">{r.name}</p>
                      <p className="text-slate-500">{[r.position, r.company].filter(Boolean).join(", ")}</p>
                      {r.email ? <a href={`mailto:${r.email}`} className="block text-slate-600 hover:underline">{r.email}</a> : null}
                      {r.phone ? <p className="text-slate-600">{r.phone}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 italic">Available on request.</p>
              )}
            </Section>
          ) : null}
        </div>

        <aside className={hasAside ? "md:border-l md:border-slate-100 md:pl-8" : "hidden"}>
          {skills.length ? (
            <Section title="Skills">
              <ul className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <li key={s} className="rounded-lg px-2.5 py-1 text-sm font-medium" style={{ backgroundColor: `${accent}14`, color: accent }}>
                    {s}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {resume.certifications.length ? (
            <Section title="Certifications">
              <ul className="space-y-3">
                {resume.certifications.map((c) => (
                  <li key={c.id}>
                    <p className="text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-xs text-slate-500">{[c.issuer, c.date].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {resume.awards.length ? (
            <Section title="Awards">
              <ul className="space-y-3">
                {resume.awards.map((a) => (
                  <li key={a.id}>
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-slate-500">{[a.issuer, a.date].filter(Boolean).join(" · ")}</p>
                    {a.description ? <p className="text-xs text-slate-500">{a.description}</p> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {resume.courses.length ? (
            <Section title="Courses">
              <ul className="space-y-2">
                {resume.courses.map((c) => (
                  <li key={c.id}>
                    <p className="text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-xs text-slate-500">{[c.institution, c.date].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {interests.length ? (
            <Section title="Interests">
              <p className="text-sm text-slate-600">{interests.join(" · ")}</p>
            </Section>
          ) : null}
          {languages.length ? (
            <Section title="Languages">
              <ul className="space-y-1 text-sm text-slate-600">
                {languages.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
