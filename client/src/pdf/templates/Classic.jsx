import { Page, View, Text } from "@react-pdf/renderer";
import { contactItems, ContactRow, Photo, visibleSections, SECTION_TITLES, tint } from "../primitives";
import { ExperienceList, EducationList, ProjectList, CertificationList, SkillList, Paragraph, keepTogether, extraSections } from "../blocks";

/** Centered single-column layout. `dark` renders the Classic Dark variant. */
export default function Classic({ data, accent, font, size, dark = false }) {
  const c = dark
    ? { page: "#111827", heading: "#f9fafb", text: "#d1d5db", muted: "#9ca3af", rule: "#374151", chipBg: "#1f2937" }
    : { page: "#ffffff", heading: "#111827", text: "#374151", muted: "#6b7280", rule: "#e5e7eb", chipBg: tint(accent, 0.9) };
  const k = { font, headingFont: font, text: c.text, muted: c.muted, heading: c.heading, accent, size: 9.5 };
  const show = visibleSections(data);
  const p = data.personal;

  const Section = ({ id, title, children }) =>
    title || show[id] ? (
      <View wrap={!keepTogether(id, data)} style={{ marginTop: 14 }}>
        <View minPresenceAhead={36} style={{ borderBottomWidth: 1, borderBottomColor: c.rule, paddingBottom: 3, marginBottom: 8 }}>
          <Text style={{ fontFamily: font, fontWeight: 700, fontSize: 10.5, color: dark ? accent : c.heading, textTransform: "uppercase", letterSpacing: 0.53 }}>
            {title || SECTION_TITLES[id]}
          </Text>
        </View>
        {children}
      </View>
    ) : null;

  return (
    <Page size={size} style={{ fontFamily: font, backgroundColor: c.page, paddingTop: 40, paddingBottom: 40, paddingHorizontal: 46 }}>
      <View style={{ alignItems: "center", paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: dark ? c.rule : c.heading }}>
        {p.profilePic ? <Photo src={p.profilePic} size={72} border={{ width: 2, color: c.rule }} style={{ marginBottom: 10 }} /> : null}
        <Text style={{ fontFamily: font, fontSize: 25, fontWeight: 700, color: c.heading, textAlign: "center" }}>{p.name || "Your Name"}</Text>
        {p.title ? (
          <Text style={{ fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 5, fontWeight: 700, textAlign: "center" }}>
            {p.title}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 9 }}>
          {contactItems(p, data.links).map((item) => (
            <ContactRow key={item.key} item={item} color={c.muted} iconColor={accent} size={8.5} style={{ marginHorizontal: 7, marginBottom: 2 }} />
          ))}
        </View>
      </View>

      <Section id="summary">
        <Paragraph text={data.summary} k={k} style={{ textAlign: "justify" }} />
      </Section>
      <Section id="experience">
        <ExperienceList items={data.experience} k={k} />
      </Section>
      <Section id="education">
        <EducationList items={data.education} k={k} />
      </Section>
      <Section id="projects">
        <ProjectList items={data.projects} k={k} />
      </Section>
      <Section id="certifications">
        <CertificationList items={data.certifications} k={k} />
      </Section>
      {extraSections(data, k, (id, title, children) => (
        <Section key={id} id={id} title={title}>
          {children}
        </Section>
      ))}
      <Section id="skills">
        <SkillList text={data.skills} k={k} chip={{ bg: c.chipBg, color: dark ? tint(accent, 0.3) : accent }} />
      </Section>
      <Section id="languages">
        <SkillList text={data.languages} k={k} variant="inline" />
      </Section>
    </Page>
  );
}
