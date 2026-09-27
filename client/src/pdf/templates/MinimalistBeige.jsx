import { Page, View, Text } from "@react-pdf/renderer";
import { contactItems, ContactRow, Photo, visibleSections, SECTION_TITLES } from "../primitives";
import { ExperienceList, EducationList, ProjectList, CertificationList, SkillList, Paragraph, keepTogether, extraSections } from "../blocks";

/** Warm paper background, serif headings, two columns. */
export default function MinimalistBeige({ data, accent, font, size, bodyFont }) {
  const body = bodyFont || font;
  const c = { page: "#fffbf2", heading: "#2d2a26", text: "#555049", muted: "#7a7268", rule: "#e6e2d8" };
  const k = { font: body, headingFont: font, text: c.text, muted: c.muted, heading: c.heading, accent, size: 9.2, subtitleColor: c.muted, dateColor: accent };
  const show = visibleSections(data);
  const p = data.personal;
  const titles = { ...SECTION_TITLES, summary: "Profile", skills: "Skills" };

  const Section = ({ id, title, children }) =>
    title || show[id] ? (
      <View wrap={!keepTogether(id, data)} style={{ paddingBottom: 18 }}>
        <Text minPresenceAhead={36} style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: c.heading, textTransform: "uppercase", letterSpacing: 0.62, marginBottom: 10 }}>
          {title || titles[id]}
        </Text>
        {children}
      </View>
    ) : null;

  return (
    <Page size={size} style={{ fontFamily: body, backgroundColor: c.page, paddingTop: 44, paddingBottom: 40, paddingHorizontal: 44 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
        {p.profilePic ? <Photo src={p.profilePic} size={104} border={{ width: 4, color: "#ffffff" }} style={{ marginRight: 24 }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font, fontSize: 28, fontWeight: 700, color: "#1a1a1a" }}>{p.name || "Your Name"}</Text>
          {p.title ? <Text style={{ fontFamily: font, fontStyle: "italic", fontSize: 12.5, color: c.muted, marginTop: 4 }}>{p.title}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
            {contactItems(p, data.links).map((item) => (
              <ContactRow key={item.key} item={item} color={c.muted} iconColor={accent} size={8.3} style={{ marginRight: 14, marginBottom: 4 }} />
            ))}
          </View>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: c.rule, marginBottom: 20 }} />

      <View style={{ flexDirection: "row" }}>
        <View style={{ width: "36%", paddingRight: 22 }}>
          <Section id="skills">
            <SkillList text={data.skills} k={k} variant="bullets" />
          </Section>
          <Section id="education">
            <EducationList items={data.education} k={k} institutionFirst dateBelow />
          </Section>
          <Section id="languages">
            <SkillList text={data.languages} k={k} variant="bullets" />
          </Section>
          <Section id="certifications">
            <CertificationList items={data.certifications} k={k} />
          </Section>
        </View>
        <View style={{ width: "64%" }}>
          <Section id="summary">
            <Paragraph text={data.summary} k={k} style={{ textAlign: "justify", lineHeight: 1.65 }} />
          </Section>
          <Section id="experience">
            <ExperienceList items={data.experience} k={k} />
          </Section>
          <Section id="projects">
            <ProjectList items={data.projects} k={k} />
          </Section>
          {extraSections(data, k, (id, title, children) => (
            <Section key={id} id={id} title={title}>
              {children}
            </Section>
          ))}
        </View>
      </View>
    </Page>
  );
}
