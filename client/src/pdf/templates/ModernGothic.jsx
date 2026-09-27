import { Page, View, Text } from "@react-pdf/renderer";
import { contactItems, Icon, MaybeLink, Photo, Initials, visibleSections, SECTION_TITLES } from "../primitives";
import { ExperienceList, EducationList, ProjectList, CertificationList, SkillList, keepTogether } from "../blocks";

const PAD = 34;
const SIDE = "35%";

/** Dark header, charcoal sidebar and light grey content with timelines. */
export default function ModernGothic({ data, accent, font, size }) {
  const c = { header: accent, side: "#333333", main: "#e6e6e6", heading: "#1f1f1f", text: "#404040", muted: "#666666", sideText: "#d4d4d4" };
  const k = { font, headingFont: font, text: c.text, muted: c.muted, heading: c.heading, accent: "#555555", size: 9, subtitleColor: "#555555", bulletColor: "#888888" };
  const sk = { ...k, text: c.sideText, heading: "#ffffff", muted: "#a3a3a3", accent: "#a3a3a3", bulletColor: "#a3a3a3" };
  const show = visibleSections(data);
  const p = data.personal;

  const SideTitle = ({ children }) => (
    <Text minPresenceAhead={30} style={{ fontSize: 9.5, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", letterSpacing: 2, borderBottomWidth: 0.8, borderBottomColor: "#737373", paddingBottom: 4, marginBottom: 10, marginTop: 18 }}>
      {children}
    </Text>
  );

  const Section = ({ id, children }) =>
    show[id] ? (
      <View wrap={!keepTogether(id, data)} style={{ marginBottom: 16 }}>
        <View minPresenceAhead={36} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <View style={{ width: 26, height: 2, backgroundColor: c.heading, marginRight: 10 }} />
          <Text style={{ fontSize: 12, fontWeight: 700, color: c.heading, textTransform: "uppercase", letterSpacing: 2.4 }}>{SECTION_TITLES[id]}</Text>
        </View>
        {children}
      </View>
    ) : null;

  const timeline = { line: "#a3a3a3", dot: "#262626", fill: c.main };

  return (
    <Page size={size} style={{ fontFamily: font, backgroundColor: c.main, paddingVertical: PAD }}>
      <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: SIDE, backgroundColor: c.side }} />

      <View style={{ marginTop: -PAD, backgroundColor: c.header, flexDirection: "row", alignItems: "center", paddingVertical: 28, paddingRight: 32 }}>
        <View style={{ width: SIDE, alignItems: "center" }}>
          {p.profilePic ? (
            <Photo src={p.profilePic} size={118} border={{ width: 3, color: "#ffffff" }} />
          ) : (
            <Initials name={p.name} size={96} bg="#262626" color="#ffffff" font={font} style={{ borderWidth: 3, borderColor: "#ffffff" }} />
          )}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 28, fontWeight: 800, color: "#ffffff", textTransform: "uppercase", textAlign: "right", lineHeight: 1.05 }}>{p.name || "Your Name"}</Text>
          {p.title ? <Text style={{ fontSize: 10.5, color: "#d4d4d4", textTransform: "uppercase", letterSpacing: 2, marginTop: 6, textAlign: "right" }}>{p.title}</Text> : null}
          {show.summary ? (
            <Text style={{ fontSize: 8.8, color: "#bdbdbd", lineHeight: 1.5, textAlign: "justify", borderTopWidth: 0.8, borderTopColor: "#737373", paddingTop: 8, marginTop: 10 }}>
              {data.summary}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: "row" }}>
        <View style={{ width: SIDE, paddingHorizontal: 22, paddingTop: 4 }}>
          {contactItems(p).length ? <SideTitle>Contact</SideTitle> : null}
          {contactItems(p).map((item) => (
            <View key={item.type} wrap={false} style={{ flexDirection: "row", marginBottom: 9 }}>
              <View style={{ marginRight: 8, marginTop: 1 }}>
                <Icon name={item.type} size={9} color="#a3a3a3" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7.5, fontWeight: 700, color: "#ffffff", letterSpacing: 1, textTransform: "uppercase", marginBottom: 1.5 }}>{item.label}</Text>
                <MaybeLink href={item.href} style={{ fontSize: 8.3, color: c.sideText }}>
                  {item.text}
                </MaybeLink>
              </View>
            </View>
          ))}
          {show.skills ? (
            <View wrap={false}>
              <SideTitle>Skills</SideTitle>
              <SkillList text={data.skills} k={sk} chip={{ border: "#737373", color: "#e5e5e5", radius: 0, upper: true }} />
            </View>
          ) : null}
          {show.languages ? (
            <View wrap={false}>
              <SideTitle>Languages</SideTitle>
              <SkillList text={data.languages} k={sk} variant="bullets" />
            </View>
          ) : null}
          {show.certifications ? (
            <View wrap={false}>
              <SideTitle>Certifications</SideTitle>
              <CertificationList items={data.certifications} k={sk} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 22 }}>
          <Section id="experience">
            <ExperienceList items={data.experience} k={k} timeline={timeline} companyFirst />
          </Section>
          <Section id="education">
            <EducationList items={data.education} k={k} timeline={timeline} institutionFirst />
          </Section>
          <Section id="projects">
            <ProjectList items={data.projects} k={k} />
          </Section>
        </View>
      </View>
    </Page>
  );
}
