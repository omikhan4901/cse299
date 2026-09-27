import { Page, View, Text, Svg, Circle } from "@react-pdf/renderer";
import { contactItems, ContactRow, Photo, Initials, visibleSections, SECTION_TITLES, tint } from "../primitives";
import { ExperienceList, EducationList, ProjectList, CertificationList, SkillList, Paragraph, keepTogether, extraSections } from "../blocks";

const PAD = 34;

function DotPattern({ width, height, color }) {
  const dots = [];
  for (let y = 8; y < height; y += 16) for (let x = 8; x < width; x += 16) dots.push(<Circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill={color} />);
  return (
    <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      {dots}
    </Svg>
  );
}

/** Banner header with a floating contact card, then two columns. */
export default function Creative({ data, accent, font, size }) {
  const c = { banner: "#2d3748", heading: "#1f2937", text: "#4b5563", muted: "#6b7280", rule: "#e5e7eb" };
  const k = { font, headingFont: font, text: c.text, muted: c.muted, heading: c.heading, accent, size: 9.3 };
  const show = visibleSections(data);
  const p = data.personal;
  const contacts = contactItems(p, data.links);
  const left = contacts.filter((i) => i.type === "email" || i.type === "phone");
  const right = contacts.filter((i) => i.type !== "email" && i.type !== "phone");
  const pageWidth = size === "LETTER" ? 612 : 595;

  const Section = ({ id, title, children }) =>
    title || show[id] ? (
      <View wrap={!keepTogether(id, data)} style={{ marginBottom: 16 }}>
        <Text minPresenceAhead={36} style={{ fontSize: 11.5, fontWeight: 700, color: c.heading, textTransform: "uppercase", letterSpacing: 0.58, borderBottomWidth: 1.5, borderBottomColor: c.rule, paddingBottom: 4, marginBottom: 9 }}>
          {title || SECTION_TITLES[id]}
        </Text>
        {children}
      </View>
    ) : null;

  return (
    <Page size={size} style={{ fontFamily: font, backgroundColor: "#ffffff", paddingTop: PAD, paddingBottom: PAD }}>
      <View style={{ marginTop: -PAD, height: 150, backgroundColor: c.banner, alignItems: "center", justifyContent: "center", paddingBottom: p.profilePic ? 66 : 34 }}>
        <DotPattern width={pageWidth} height={150} color="#4a5568" />
        <Text style={{ fontSize: 26, color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", paddingHorizontal: 40 }}>{p.name || "Your Name"}</Text>
      </View>

      <View style={{ marginTop: -42, marginHorizontal: PAD, backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 0.8, borderColor: c.rule, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          {left.map((item) => (
            <ContactRow key={item.key} item={item} color={c.text} iconColor={accent} size={8.3} style={{ marginBottom: 4 }} />
          ))}
        </View>
        <View style={{ alignItems: "center", width: 150 }}>
          {p.profilePic ? (
            <Photo src={p.profilePic} size={92} border={{ width: 4, color: "#ffffff" }} style={{ marginTop: -56 }} />
          ) : (
            <Initials name={p.name} size={72} bg={tint(accent, 0.85)} color={accent} font={font} style={{ marginTop: -46, borderWidth: 4, borderColor: "#ffffff" }} />
          )}
          {p.title ? (
            <Text style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.45, textAlign: "center", marginTop: 8 }}>{p.title}</Text>
          ) : null}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          {right.map((item) => (
            <ContactRow key={item.key} item={item} color={c.text} iconColor={accent} size={8.3} style={{ marginBottom: 4 }} />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: PAD }}>
        <View style={{ width: "63%", paddingRight: 18 }}>
          <Section id="summary">
            <Paragraph text={data.summary} k={k} style={{ textAlign: "justify" }} />
          </Section>
          <Section id="experience">
            <ExperienceList items={data.experience} k={k} timeline={{ line: c.rule, dot: accent }} />
          </Section>
          <Section id="projects">
            <ProjectList items={data.projects} k={k} />
          </Section>
          {extraSections(data, k, (id, title, children) => (
            <Section key={id} id={id} title={title}>
              {children}
            </Section>
          ), { timeline: { line: c.rule, dot: accent } })}
        </View>
        <View style={{ width: "37%", paddingLeft: 6 }}>
          <Section id="education">
            <EducationList items={data.education} k={k} dateBelow />
          </Section>
          <Section id="skills">
            <SkillList text={data.skills} k={k} chip={{ bg: tint(accent, 0.9), color: accent, border: tint(accent, 0.75) }} />
          </Section>
          <Section id="languages">
            <SkillList text={data.languages} k={k} variant="bullets" />
          </Section>
          <Section id="certifications">
            <CertificationList items={data.certifications} k={k} />
          </Section>
        </View>
      </View>
    </Page>
  );
}
