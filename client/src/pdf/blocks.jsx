/*
 * Section content shared by the templates. Every block takes a "kit" `k`
 * describing the template's look:
 *   { font, headingFont, text, muted, heading, accent, size }
 */
import { View, Text } from "@react-pdf/renderer";
import { Bullets, MaybeLink, splitList, dateRange, projectHref, prettyUrl } from "./primitives";

/** One experience/education/project entry with optional timeline marker. */
export function Entry({ k, title, subtitle, date, location, description, bullets = true, timeline, dateBelow, dateLeft, style }) {
  // Dates in a narrow column on the left (CV / timeline style).
  if (dateLeft) {
    return (
      <View style={[{ flexDirection: "row", marginBottom: k.entryGap ?? 10 }, style]}>
        <Text style={{ width: k.dateWidth || 62, paddingRight: 8, fontSize: k.size - 1, color: k.dateColor || k.muted, fontWeight: 500, marginTop: 1.5 }}>{date}</Text>
        <View style={{ flex: 1 }}>
          <Entry k={k} title={title} subtitle={subtitle} location={location} description={description} bullets={bullets} style={{ marginBottom: 0 }} />
        </View>
      </View>
    );
  }
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
      <Bullets text={description} color={k.text} size={k.size} bullet={k.marker ?? "•"} bulletColor={k.bulletColor || k.accent} style={{ marginTop: 4 }} />
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

export function ExperienceList({ items, k, timeline, companyFirst, dateBelow, dateLeft }) {
  return items.map((item) => (
    <Entry
      key={item.id}
      k={k}
      title={(companyFirst ? item.company : item.title) || (companyFirst ? "Company" : "Job Title")}
      subtitle={companyFirst ? item.title : item.company}
      location={[item.location, item.employmentType].filter(Boolean).join("  ·  ")}
      date={dateRange(item.startDate, item.endDate)}
      description={item.description}
      timeline={timeline}
      dateBelow={dateBelow}
      dateLeft={dateLeft}
    />
  ));
}

export function EducationList({ items, k, timeline, institutionFirst, dateBelow, dateLeft }) {
  return items.map((item) => (
    <Entry
      key={item.id}
      k={k}
      title={(institutionFirst ? item.institution : item.degree) || (institutionFirst ? "Institution" : "Degree")}
      subtitle={institutionFirst ? item.degree : item.institution}
      location={item.location}
      date={dateRange(item.startYear, item.endYear)}
      description={[item.gpa ? `GPA: ${item.gpa}` : "", item.details].filter(Boolean).join("  ·  ")}
      bullets={false}
      timeline={timeline}
      dateBelow={dateBelow}
      dateLeft={dateLeft}
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
      {item.role || item.startDate || item.endDate ? (
        <Text style={{ fontSize: k.size - 0.5, color: k.muted, marginTop: 1.5 }}>
          {[item.role, dateRange(item.startDate, item.endDate)].filter(Boolean).join("  ·  ")}
        </Text>
      ) : null}
      {item.technologies ? (
        <Text style={{ fontSize: k.size - 0.5, color: k.muted, marginTop: 1.5 }}>
          <Text style={{ fontWeight: 700, color: k.heading }}>Tech: </Text>
          {splitList(item.technologies).join(", ")}
        </Text>
      ) : null}
      {item.description ? (
        <Bullets text={item.description} color={k.text} size={k.size} bulletColor={k.bulletColor || k.accent} style={{ marginTop: 3 }} bullet={timeline === false ? null : k.marker ?? "•"} />
      ) : null}
    </View>
  ));
}

export function CertificationList({ items, k, compact }) {
  return items.map((item) => (
    <View key={item.id} wrap={false} style={{ marginBottom: compact ? 4 : 7 }}>
      <MaybeLink href={item.link ? projectHref(item.link) : ""} style={{ fontSize: k.size, color: k.heading, fontWeight: 700 }}>
        {item.name || "Certification"}
      </MaybeLink>
      {item.issuer || item.date ? (
        <Text style={{ fontSize: k.size - 1, color: k.muted, marginTop: 1 }}>{[item.issuer, item.date].filter(Boolean).join(" · ")}</Text>
      ) : null}
    </View>
  ));
}

/** Skills in one of several looks: chips, bullets, grid (two columns) or inline text. */
export function SkillList({ text, k, variant = "chips", chip = {}, columns = 2 }) {
  const skills = splitList(text);
  if (variant === "inline") {
    return <Text style={{ fontSize: k.size, color: k.text, lineHeight: 1.5 }}>{skills.join("  ·  ")}</Text>;
  }
  if (variant === "bullets" || variant === "grid") {
    return (
      <View style={variant === "grid" ? { flexDirection: "row", flexWrap: "wrap" } : undefined}>
        {skills.map((s, i) => (
          <View key={i} wrap={false} style={{ flexDirection: "row", alignItems: "center", width: variant === "grid" ? `${100 / columns}%` : "100%", marginBottom: 4 }}>
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
            letterSpacing: chip.upper ? 0.35 : 0,
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
  ["skills", "languages", "certifications", "interests", "references", "courses"].includes(id) ||
  (id === "summary" && (data.summary || "").length < 700);

const joinDot = (...parts) => parts.filter(Boolean).join("  ·  ");

export function VolunteerList({ items, k, timeline }) {
  return items.map((item) => (
    <Entry
      key={item.id}
      k={k}
      title={item.role || "Volunteer"}
      subtitle={item.organization}
      location={item.location}
      date={dateRange(item.startDate, item.endDate)}
      description={item.description}
      timeline={timeline}
    />
  ));
}

export function AwardList({ items, k }) {
  return items.map((item) => (
    <Entry key={item.id} k={k} title={item.title || "Award"} subtitle={item.issuer} date={item.date} description={item.description} bullets={false} />
  ));
}

export function PublicationList({ items, k }) {
  return items.map((item) => (
    <View key={item.id} style={{ marginBottom: k.entryGap ?? 9 }}>
      <View wrap={false} minPresenceAhead={16}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <MaybeLink href={item.link ? projectHref(item.link) : ""} style={{ flex: 1, fontFamily: k.headingFont, fontWeight: 700, fontSize: k.size + 0.5, color: k.heading, paddingRight: 8 }}>
            {item.title || "Publication"}
          </MaybeLink>
          {item.date ? <Text style={{ fontSize: k.size - 1, color: k.dateColor || k.muted }}>{item.date}</Text> : null}
        </View>
        {item.publisher ? <Text style={{ fontSize: k.size, color: k.subtitleColor || k.accent, marginTop: 1.5 }}>{item.publisher}</Text> : null}
      </View>
      {item.description ? <Text style={{ fontSize: k.size, color: k.text, lineHeight: 1.45, marginTop: 2 }}>{item.description}</Text> : null}
    </View>
  ));
}

export function CourseList({ items, k }) {
  return items.map((item) => (
    <View key={item.id} wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
      <Text style={{ flex: 1, fontSize: k.size, color: k.text, paddingRight: 8 }}>
        <Text style={{ fontWeight: 700, color: k.heading }}>{item.name || "Course"}</Text>
        {item.institution ? `  ·  ${item.institution}` : ""}
      </Text>
      {item.date ? <Text style={{ fontSize: k.size - 1, color: k.dateColor || k.muted }}>{item.date}</Text> : null}
    </View>
  ));
}

/** Blank signature and date lines a referee can sign on a printed copy. */
function SignatureLines({ k }) {
  const line = k.muted || "#9ca3af";
  const label = { fontSize: k.size - 1.5, color: k.muted, marginTop: 2 };
  return (
    <View style={{ flexDirection: "row", marginTop: 20 }}>
      <View style={{ flex: 1, marginRight: 10 }}>
        <View style={{ borderBottomWidth: 0.8, borderBottomColor: line }} />
        <Text style={label}>Signature</Text>
      </View>
      <View style={{ width: "34%" }}>
        <View style={{ borderBottomWidth: 0.8, borderBottomColor: line }} />
        <Text style={label}>Date</Text>
      </View>
    </View>
  );
}

export function ReferenceList({ items, k, signatures = false }) {
  if (!items.length) return <Text style={{ fontSize: k.size, color: k.text, fontStyle: "italic" }}>Available on request.</Text>;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {items.map((item) => (
        <View key={item.id} wrap={false} style={{ width: "50%", paddingRight: signatures ? 16 : 10, marginBottom: signatures ? 12 : 8 }}>
          <Text style={{ fontSize: k.size, fontWeight: 700, color: k.heading }}>{item.name || "Reference"}</Text>
          {item.position || item.company ? <Text style={{ fontSize: k.size - 0.5, color: k.muted }}>{[item.position, item.company].filter(Boolean).join(", ")}</Text> : null}
          {item.email ? <MaybeLink href={`mailto:${item.email}`} style={{ fontSize: k.size - 0.5, color: k.text }}>{item.email}</MaybeLink> : null}
          {item.phone ? <Text style={{ fontSize: k.size - 0.5, color: k.text }}>{item.phone}</Text> : null}
          {signatures ? <SignatureLines k={k} /> : null}
        </View>
      ))}
    </View>
  );
}

export function CustomItems({ items, k }) {
  return items.map((item) => (
    <Entry key={item.id} k={k} title={item.title || "Item"} subtitle={item.subtitle} date={item.date} description={item.description} />
  ));
}

/**
 * The sections every template gets "for free" after its core layout:
 * volunteering, awards, publications, courses, custom sections, references
 * and interests. `render(id, title, children)` wraps each one in the
 * template's own section style; only sections with content are rendered.
 */
export function extraSections(data, k, render, { timeline, titles = {}, skip = [] } = {}) {
  const t = (id, fallback) => titles[id] || fallback;
  const out = [];
  data = { ...data };
  for (const id of skip) data[id] = Array.isArray(data[id]) ? [] : id === "referencesOnRequest" ? false : "";
  if (data.volunteering?.length) out.push(render("volunteering", t("volunteering", "Volunteering"), <VolunteerList items={data.volunteering} k={k} timeline={timeline} />));
  if (data.awards?.length) out.push(render("awards", t("awards", "Awards"), <AwardList items={data.awards} k={k} />));
  if (data.publications?.length) out.push(render("publications", t("publications", "Publications"), <PublicationList items={data.publications} k={k} />));
  if (data.courses?.length) out.push(render("courses", t("courses", "Courses"), <CourseList items={data.courses} k={k} />));
  for (const sec of data.customSections || []) {
    if (sec.items?.length) out.push(render(`custom-${sec.id}`, sec.title || "Other", <CustomItems items={sec.items} k={k} />));
  }
  if (data.references?.length || data.referencesOnRequest) out.push(render("references", t("references", "References"), <ReferenceList items={data.references || []} k={k} signatures={!!data.referenceSignatures} />));
  if (splitList(data.interests).length) out.push(render("interests", t("interests", "Interests"), <SkillList text={data.interests} k={k} variant="inline" />));
  return out;
}

export { joinDot };
