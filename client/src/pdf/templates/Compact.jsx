import { Page, View, Text } from "@react-pdf/renderer";
import { contactItems, MaybeLink, visibleSections, SECTION_TITLES, splitList } from "../primitives";
import { ExperienceList, EducationList, ProjectList, keepTogether } from "../blocks";

/**
 * Plain single-column layout for applicant tracking systems: no photo, no
 * icons, no columns, standard headings and real text everywhere.
 */
export default function Compact({ data, accent, font, size }) {
  const c = { heading: "#111111", text: "#262626", muted: "#525252" };
  const k = { font, headingFont: font, text: c.text, muted: c.muted, heading: c.heading, accent: c.heading, size: 9.6, subtitleColor: c.text, bulletColor: c.text, entryGap: 8 };
  const show = visibleSections(data);
  const p = data.personal;
  const contacts = contactItems(p);
  const titles = { ...SECTION_TITLES, summary: "Summary" };

  const Section = ({ id, children }) =>
    show[id] ? (
      <View wrap={!keepTogether(id, data)} style={{ marginTop: 11 }}>
        <Text minPresenceAhead={36} style={{ fontSize: 10.5, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 1, borderBottomWidth: 1, borderBottomColor: accent, paddingBottom: 2, marginBottom: 7 }}>
          {titles[id]}
        </Text>
        {children}
      </View>
    ) : null;

  return (
    <Page size={size} style={{ fontFamily: font, backgroundColor: "#ffffff", paddingVertical: 36, paddingHorizontal: 42 }}>
      <Text style={{ fontSize: 21, fontWeight: 700, color: c.heading }}>{p.name || "Your Name"}</Text>
      {p.title ? <Text style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{p.title}</Text> : null}
      {contacts.length ? (
        <Text style={{ fontSize: 9, color: c.text, marginTop: 6 }}>
          {contacts.map((item, i) => (
            <Text key={item.type}>
              {i ? "  |  " : ""}
              <MaybeLink href={item.href} style={{ color: c.text }}>
                {item.text}
              </MaybeLink>
            </Text>
          ))}
        </Text>
      ) : null}

      <Section id="summary">
        <Text style={{ fontSize: k.size, color: c.text, lineHeight: 1.45 }}>{data.summary}</Text>
      </Section>
      <Section id="skills">
        <Text style={{ fontSize: k.size, color: c.text, lineHeight: 1.45 }}>{splitList(data.skills).join(", ")}</Text>
      </Section>
      <Section id="experience">
        <ExperienceList items={data.experience} k={k} />
      </Section>
      <Section id="projects">
        <ProjectList items={data.projects} k={k} />
      </Section>
      <Section id="education">
        <EducationList items={data.education} k={k} />
      </Section>
      <Section id="certifications">
        {data.certifications.map((item) => (
          <Text key={item.id} style={{ fontSize: k.size, color: c.text, marginBottom: 3 }}>
            <Text style={{ fontWeight: 700 }}>{item.name}</Text>
            {[item.issuer, item.date].filter(Boolean).length ? ` – ${[item.issuer, item.date].filter(Boolean).join(", ")}` : ""}
          </Text>
        ))}
      </Section>
      <Section id="languages">
        <Text style={{ fontSize: k.size, color: c.text }}>{splitList(data.languages).join(", ")}</Text>
      </Section>
    </Page>
  );
}
