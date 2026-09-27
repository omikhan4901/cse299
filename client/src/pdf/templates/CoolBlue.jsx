import { Page, View, Text } from "@react-pdf/renderer";
import { contactItems, ContactRow, Photo, Initials, visibleSections, tint } from "../primitives";
import { ExperienceList, EducationList, ProjectList, CertificationList, SkillList, Paragraph, keepTogether, extraSections } from "../blocks";

const PAD = 34;
const SIDE = 190;

/** Pastel sidebar + pink header with numbered sections. */
export default function CoolBlue({ data, accent, font, size }) {
  const c = { side: "#effafa", sideBorder: "#cffafe", header: "#fff0f3", rose: "#fecdd3", heading: "#334155", text: "#475569", muted: "#64748b" };
  const k = { font, headingFont: font, text: c.text, muted: c.muted, heading: c.heading, accent, size: 9, dateColor: accent };
  const show = visibleSections(data);
  const p = data.personal;
  const [first, ...rest] = (p.name || "First Name").trim().split(/\s+/);

  const SideTitle = ({ children }) => (
    <Text minPresenceAhead={30} style={{ fontSize: 10, fontWeight: 700, color: c.heading, textTransform: "uppercase", letterSpacing: 0.5, borderBottomWidth: 0.8, borderBottomColor: "#cbd5e1", paddingBottom: 4, marginBottom: 9, marginTop: 20 }}>
      {children}
    </Text>
  );

  const order = ["summary", "education", "experience", "projects"].filter((id) => show[id]);
  const titles = { summary: "Professional Profile", education: "Education", experience: "Experience", projects: "Projects" };

  const Numbered = ({ id, title, number, children }) => (
    <View wrap={!keepTogether(id, data)} style={{ paddingBottom: 14 }}>
      <View minPresenceAhead={36} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.rose, alignItems: "center", justifyContent: "center", marginRight: 10, backgroundColor: "#ffffff" }}>
          <Text style={{ fontSize: 9, color: c.muted }}>{String(number ?? order.indexOf(id) + 1).padStart(2, "0")}</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 10, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.5, borderBottomWidth: 0.8, borderBottomColor: c.rose, paddingBottom: 3 }}>
          {title || titles[id]}
        </Text>
      </View>
      <View style={{ paddingLeft: 7 }}>{children}</View>
    </View>
  );

  const timeline = { line: c.rose, dot: accent, fill: accent };

  return (
    <Page size={size} style={{ fontFamily: font, backgroundColor: "#ffffff", flexDirection: "row", paddingVertical: PAD }}>
      <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: SIDE, backgroundColor: c.side, borderRightWidth: 0.8, borderRightColor: c.sideBorder }} />

      <View style={{ width: SIDE, paddingHorizontal: 20 }}>
        <View style={{ alignItems: "center", marginBottom: 4 }}>
          {p.profilePic ? (
            <Photo src={p.profilePic} size={118} border={{ width: 4, color: "#ffffff" }} />
          ) : (
            <Initials name={p.name} size={96} bg="#ffffff" color={accent} font={font} style={{ borderWidth: 4, borderColor: tint(accent, 0.8) }} />
          )}
        </View>
        {contactItems(p, data.links).length ? <SideTitle>Contact</SideTitle> : null}
        {contactItems(p, data.links).map((item) => (
          <ContactRow key={item.key} item={item} color={c.text} iconColor={accent} size={8.3} gap={7} iconSize={10} style={{ marginBottom: 8 }} />
        ))}
        {show.skills ? (
          <View wrap={false}>
            <SideTitle>Skills</SideTitle>
            <SkillList text={data.skills} k={k} variant="bullets" />
          </View>
        ) : null}
        {show.languages ? (
          <View wrap={false}>
            <SideTitle>Languages</SideTitle>
            <SkillList text={data.languages} k={k} variant="bullets" />
          </View>
        ) : null}
        {show.certifications ? (
          <View wrap={false}>
            <SideTitle>Certifications</SideTitle>
            <CertificationList items={data.certifications} k={k} />
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ marginTop: -PAD, backgroundColor: c.header, paddingTop: PAD + 30, paddingBottom: 30, paddingHorizontal: 28, marginBottom: 22 }}>
          <Text style={{ fontSize: 25, fontWeight: 700, color: c.heading, textTransform: "uppercase", letterSpacing: 1 }}>
            {first} <Text style={{ color: accent }}>{rest.join(" ")}</Text>
          </Text>
          {p.title ? <Text style={{ fontSize: 9.5, color: c.muted, textTransform: "uppercase", letterSpacing: 0.48, marginTop: 6 }}>{p.title}</Text> : null}
        </View>
        <View style={{ paddingHorizontal: 28 }}>
          {show.summary ? (
            <Numbered id="summary">
              <Paragraph text={data.summary} k={k} style={{ textAlign: "justify" }} />
            </Numbered>
          ) : null}
          {show.education ? (
            <Numbered id="education">
              <EducationList items={data.education} k={k} timeline={timeline} />
            </Numbered>
          ) : null}
          {show.experience ? (
            <Numbered id="experience">
              <ExperienceList items={data.experience} k={k} timeline={timeline} companyFirst />
            </Numbered>
          ) : null}
          {show.projects ? (
            <Numbered id="projects">
              <ProjectList items={data.projects} k={k} />
            </Numbered>
          ) : null}
          {extraSections(data, k, (id, title, children) => ({ id, title, children }), { timeline }).map((sec, i) => (
            <Numbered key={sec.id} id={sec.id} title={sec.title} number={order.length + i + 1}>
              {sec.children}
            </Numbered>
          ))}
        </View>
      </View>
    </Page>
  );
}
