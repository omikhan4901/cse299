import { Page, View, Text } from "@react-pdf/renderer";
import { contactItems, ContactRow, Photo, Initials, visibleSections, SECTION_TITLES, tint } from "../primitives";
import { ExperienceList, EducationList, ProjectList, CertificationList, SkillList, Paragraph, keepTogether } from "../blocks";

const SIDEBAR = "33%";

/** Sidebar layout. The sidebar colour is a fixed layer so it repeats on every page. */
export default function Modern({ data, accent, font, size, dark = false }) {
  const c = dark
    ? { side: "#1f2937", main: "#111827", heading: "#f9fafb", text: "#d1d5db", muted: "#9ca3af", rule: "#374151", sideText: "#d1d5db", sideMuted: "#9ca3af", sideRule: "#374151" }
    : { side: "#1e293b", main: "#ffffff", heading: "#0f172a", text: "#475569", muted: "#64748b", rule: "#e2e8f0", sideText: "#cbd5e1", sideMuted: "#94a3b8", sideRule: "#475569" };
  const k = { font, headingFont: font, text: c.text, muted: c.muted, heading: c.heading, accent: dark ? tint(accent, 0.25) : accent, size: 9.3 };
  const sk = { ...k, text: c.sideText, muted: c.sideMuted, heading: "#ffffff", accent: tint(accent, 0.45), size: 8.8 };
  const show = visibleSections(data);
  const p = data.personal;

  const SideTitle = ({ children }) => (
    <Text minPresenceAhead={30} style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: c.sideMuted, borderBottomWidth: 0.8, borderBottomColor: c.sideRule, paddingBottom: 4, marginBottom: 8, marginTop: 18 }}>
      {children}
    </Text>
  );

  const MainSection = ({ id, children }) =>
    show[id] ? (
      <View wrap={!keepTogether(id, data)} style={{ marginBottom: 14 }}>
        <View minPresenceAhead={36} style={{ flexDirection: "row", alignItems: "center", marginBottom: 9 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: c.heading, textTransform: "uppercase", letterSpacing: 1.2 }}>{SECTION_TITLES[id]}</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: c.rule, marginLeft: 8 }} />
        </View>
        {children}
      </View>
    ) : null;

  const timeline = { line: dark ? "#374151" : tint(accent, 0.8), dot: k.accent, fill: c.main };

  return (
    <Page size={size} style={{ fontFamily: font, backgroundColor: c.main, flexDirection: "row", paddingVertical: 34 }}>
      <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: SIDEBAR, backgroundColor: c.side }} />

      <View style={{ width: SIDEBAR, paddingHorizontal: 20 }}>
        <View style={{ alignItems: "center" }}>
          {p.profilePic ? (
            <Photo src={p.profilePic} size={96} border={{ width: 3, color: c.sideRule }} />
          ) : (
            <Initials name={p.name} size={78} bg={c.sideRule} color="#ffffff" font={font} />
          )}
          <Text style={{ fontSize: 17, fontWeight: 700, color: "#ffffff", textAlign: "center", marginTop: 12, textTransform: "uppercase", letterSpacing: 0.8, lineHeight: 1.2 }}>
            {p.name || "Your Name"}
          </Text>
          {p.title ? (
            <Text style={{ fontSize: 8.5, color: tint(accent, 0.5), textAlign: "center", marginTop: 5, textTransform: "uppercase", letterSpacing: 1.6 }}>{p.title}</Text>
          ) : null}
        </View>

        {contactItems(p).length ? <SideTitle>Contact</SideTitle> : null}
        {contactItems(p).map((item) => (
          <ContactRow key={item.type} item={item} color={c.sideText} iconColor={tint(accent, 0.45)} size={8.3} style={{ marginBottom: 6 }} />
        ))}

        {show.skills ? (
          <>
            <SideTitle>Skills</SideTitle>
            <SkillList text={data.skills} k={sk} chip={{ bg: dark ? "#374151" : "#334155", color: "#e2e8f0", radius: 8 }} />
          </>
        ) : null}
        {show.languages ? (
          <>
            <SideTitle>Languages</SideTitle>
            <SkillList text={data.languages} k={sk} variant="bullets" />
          </>
        ) : null}
        {show.certifications ? (
          <>
            <SideTitle>Certifications</SideTitle>
            <CertificationList items={data.certifications} k={sk} />
          </>
        ) : null}
      </View>

      <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 4 }}>
        <MainSection id="summary">
          <Paragraph text={data.summary} k={k} />
        </MainSection>
        <MainSection id="experience">
          <ExperienceList items={data.experience} k={k} timeline={timeline} />
        </MainSection>
        <MainSection id="education">
          <EducationList items={data.education} k={k} />
        </MainSection>
        <MainSection id="projects">
          <ProjectList items={data.projects} k={k} />
        </MainSection>
      </View>
    </Page>
  );
}
