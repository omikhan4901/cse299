import { Page, View, Text } from "@react-pdf/renderer";
import { contactItems, ContactRow, visibleSections, SECTION_TITLES } from "../primitives";
import { ExperienceList, EducationList, ProjectList, CertificationList, SkillList, Paragraph, keepTogether, extraSections } from "../blocks";

const PAD = 42;

/** Big uppercase name, grey contact strip and tab-style section labels. */
export default function BasicStylish({ data, accent, font, size }) {
  const c = { strip: "#e2e8f0", heading: "#0f172a", text: "#475569", muted: "#64748b", line: "#cbd5e1" };
  const k = { font, headingFont: font, text: c.text, muted: c.muted, heading: c.heading, accent, size: 9.5, subtitleColor: c.muted, dateColor: c.heading, bulletColor: accent };
  const show = visibleSections(data);
  const p = data.personal;
  const titles = { ...SECTION_TITLES, experience: "Work Experience" };

  const Section = ({ id, title, children }) =>
    title || show[id] ? (
      <View wrap={!keepTogether(id, data)} style={{ marginTop: 16 }}>
        <View minPresenceAhead={36} style={{ marginBottom: 10 }}>
          <Text style={{ alignSelf: "flex-start", backgroundColor: c.strip, color: c.heading, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.48, paddingVertical: 5, paddingHorizontal: 14 }}>
            {title || titles[id]}
          </Text>
          <View style={{ height: 1, backgroundColor: c.line }} />
        </View>
        {children}
      </View>
    ) : null;

  return (
    <Page size={size} style={{ fontFamily: font, backgroundColor: "#ffffff", paddingTop: 40, paddingBottom: 40, paddingHorizontal: PAD }}>
      <Text style={{ fontSize: 30, fontWeight: 800, color: c.heading, textTransform: "uppercase", letterSpacing: 1.5 }}>{p.name || "Your Name"}</Text>
      {p.title ? <Text style={{ fontSize: 13, color: c.muted, marginTop: 4, letterSpacing: 0.6 }}>{p.title}</Text> : null}
      {contactItems(p, data.links).length ? (
        <View style={{ backgroundColor: c.strip, marginHorizontal: -PAD, marginTop: 16, paddingVertical: 8, paddingHorizontal: PAD, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {contactItems(p, data.links).map((item) => (
            <ContactRow key={item.key} item={item} color="#334155" iconColor={accent} size={8.3} style={{ marginVertical: 2, marginRight: 8 }} />
          ))}
        </View>
      ) : null}

      <Section id="summary">
        <Paragraph text={data.summary} k={k} style={{ textAlign: "justify" }} />
      </Section>
      <Section id="education">
        <EducationList items={data.education} k={k} institutionFirst />
      </Section>
      <Section id="skills">
        <SkillList text={data.skills} k={k} variant="grid" />
      </Section>
      <Section id="experience">
        <ExperienceList items={data.experience} k={k} companyFirst />
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
      <Section id="languages">
        <SkillList text={data.languages} k={k} variant="grid" />
      </Section>
    </Page>
  );
}
