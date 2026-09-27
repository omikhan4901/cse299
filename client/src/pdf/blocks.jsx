/*
 * Section content shared by the templates. Every block takes a "kit" `k`
 * describing the template's look:
 *   { font, headingFont, text, muted, heading, accent, size }
 */
import { View, Text } from "@react-pdf/renderer";
import { Bullets, MaybeLink, splitList, dateRange, projectHref, prettyUrl } from "./primitives";

/** One experience/education/project entry with optional timeline marker. */
export function Entry({ k, title, subtitle, date, location, description, bullets = true, timeline, dateBelow, style }) {
  const header = (
    <View wrap={false} minPresenceAhead={24}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ flex: 1, fontFamily: k.headingFont, fontWeight: 700, fontSize: k.size + 1.5, color: k.heading, paddingRight: 8 }}>
          {title}
        </Text>
        {date && !dateBelow ? (
          <Text style={{ fontSize: k.size - 1, color: k.dateColor || k.muted, fontWeight: 500, marginTop: 1.5 }}>{date}</Text>
        ) : null}
      </View>
      {subtitle || location ? (
        <Text style={{ fontSize: k.size, marginTop: 1.5, color: k.muted }}>
          {subtitle ? <Text style={{ color: k.subtitleColor || k.accent, fontWeight: 500 }}>{subtitle}</Text> : null}
          {subtitle && location ? "  ·  " : null}
          {location || null}
        </Text>
      ) : null}
      {date && dateBelow ? <Text style={{ fontSize: k.size - 1, color: k.dateColor || k.muted, marginTop: 1.5 }}>{date}</Text> : null}
    </View>
  );

  const body = description ? (
    bullets ? (
      <Bullets text={description} color={k.text} size={k.size} bulletColor={k.bulletColor || k.accent} style={{ marginTop: 4 }} />
    ) : (
      <Text style={{ fontSize: k.size, color: k.text, lineHeight: 1.45, marginTop: 3 }}>{description}</Text>
    )
  ) : null;

  if (!timeline) {
    return (
      <View style={[{ marginBottom: k.entryGap ?? 10 }, style]}>
        {header}
        {body}
      </View>
    );
  }
  return (
    <View style={[{ marginBottom: 0, paddingBottom: k.entryGap ?? 10, paddingLeft: 14, borderLeftWidth: 1.2, borderLeftColor: timeline.line, marginLeft: 4 }, style]}>
      <View
        style={{
          position: "absolute", left: -4.6, top: 2.5, width: 8, height: 8, borderRadius: 4,
          backgroundColor: timeline.fill || "#fff", borderWidth: 1.6, borderColor: timeline.dot,
        }}
      />
      {header}
      {body}
    </View>
  );
}

export function ExperienceList({ items, k, timeline, companyFirst, dateBelow }) {
  return items.map((item) => (
    <Entry
      key={item.id}
      k={k}
      title={(companyFirst ? item.company : item.title) || (companyFirst ? "Company" : "Job Title")}
      subtitle={companyFirst ? item.title : item.company}
      location={item.location}
      date={dateRange(item.startDate, item.endDate)}
      description={item.description}
      timeline={timeline}
      dateBelow={dateBelow}
    />
  ));
}

export function EducationList({ items, k, timeline, institutionFirst, dateBelow }) {
  return items.map((item) => (
    <Entry
      key={item.id}
      k={k}
      title={(institutionFirst ? item.institution : item.degree) || (institutionFirst ? "Institution" : "Degree")}
      subtitle={institutionFirst ? item.degree : item.institution}
      date={dateRange(item.startYear, item.endYear)}
      description={item.details}
      bullets={false}
      timeline={timeline}
      dateBelow={dateBelow}
    />
  ));
}

export function ProjectList({ items, k, timeline }) {
  return items.map((item) => (
    <View key={item.id} style={{ marginBottom: k.entryGap ?? 10 }}>
      <View wrap={false} minPresenceAhead={20} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" }}>
        <Text style={{ fontFamily: k.headingFont, fontWeight: 700, fontSize: k.size + 1, color: k.heading }}>{item.name || "Project"}</Text>
        {item.link ? (
          <MaybeLink href={projectHref(item.link)} style={{ fontSize: k.size - 1, color: k.linkColor || k.accent, marginLeft: 6 }}>
            {prettyUrl(item.link)}
          </MaybeLink>
        ) : null}
      </View>
      {item.description ? (
        <Bullets text={item.description} color={k.text} size={k.size} bulletColor={k.bulletColor || k.accent} style={{ marginTop: 3 }} bullet={timeline === false ? null : "•"} />
      ) : null}
    </View>
  ));
}

export function CertificationList({ items, k, compact }) {
  return items.map((item) => (
    <View key={item.id} wrap={false} style={{ marginBottom: compact ? 4 : 7 }}>
      <Text style={{ fontSize: k.size, color: k.heading, fontWeight: 700 }}>{item.name || "Certification"}</Text>
      {item.issuer || item.date ? (
        <Text style={{ fontSize: k.size - 1, color: k.muted, marginTop: 1 }}>{[item.issuer, item.date].filter(Boolean).join(" · ")}</Text>
      ) : null}
    </View>
  ));
}

/** Skills in one of several looks: chips, bullets, grid (two columns) or inline text. */
export function SkillList({ text, k, variant = "chips", chip = {} }) {
  const skills = splitList(text);
  if (variant === "inline") {
    return <Text style={{ fontSize: k.size, color: k.text, lineHeight: 1.5 }}>{skills.join("  ·  ")}</Text>;
  }
  if (variant === "bullets" || variant === "grid") {
    return (
      <View style={variant === "grid" ? { flexDirection: "row", flexWrap: "wrap" } : undefined}>
        {skills.map((s, i) => (
          <View key={i} wrap={false} style={{ flexDirection: "row", alignItems: "center", width: variant === "grid" ? "50%" : "100%", marginBottom: 4 }}>
            <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: k.bulletColor || k.accent, marginRight: 6 }} />
            <Text style={{ fontSize: k.size, color: k.text }}>{s}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {skills.map((s, i) => (
        <Text
          key={i}
          style={{
            fontSize: k.size - 1,
            color: chip.color || k.accent,
            backgroundColor: chip.bg,
            borderWidth: chip.border ? 0.8 : 0,
            borderColor: chip.border,
            borderRadius: chip.radius ?? 3,
            paddingVertical: 2.5,
            paddingHorizontal: 6,
            marginRight: 4,
            marginBottom: 4,
            textTransform: chip.upper ? "uppercase" : "none",
            letterSpacing: chip.upper ? 0.5 : 0,
          }}
        >
          {s}
        </Text>
      ))}
    </View>
  );
}

export function Paragraph({ text, k, style }) {
  return <Text style={[{ fontSize: k.size, color: k.text, lineHeight: 1.55 }, style]}>{text}</Text>;
}

/** Short sections are kept on one page so their heading never gets stranded. */
export const keepTogether = (id, data) =>
  ["skills", "languages", "certifications"].includes(id) || (id === "summary" && (data.summary || "").length < 700);
