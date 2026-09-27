/*
 * The ResumeX template engine. A template is a plain "spec" object (see
 * specs.js) that picks a layout, header, heading style, typography, palette,
 * skill display, bullet shape, date placement and decorations. The engine
 * turns it into a react-pdf page. Letter-spacing is always capped at 0.05em
 * so headings still extract as whole words for ATS.
 */
import { Page, View, Text, Svg, Circle } from "@react-pdf/renderer";
import { contactItems, ContactRow, Photo, Initials, visibleSections, SECTION_TITLES, tint, shade, MaybeLink, Icon } from "../primitives";
import { ExperienceList, EducationList, ProjectList, CertificationList, SkillList, Paragraph, keepTogether, extraSections } from "../blocks";

const track = (size, em = 0.05) => Math.min(em, 0.05) * size;

const DENSITY = {
  compact: { base: 8.9, gap: 10, entry: 7, pad: [30, 36] },
  normal: { base: 9.4, gap: 13, entry: 9, pad: [36, 42] },
  airy: { base: 9.8, gap: 16, entry: 11, pad: [44, 52] },
};

const DEFAULT_TITLES = { ...SECTION_TITLES, summary: "Summary" };

export default function EngineTemplate({ data, accent, font, size, spec, customFont }) {
  const d = DENSITY[spec.density || "normal"];
  const [padV, padH] = spec.pad || d.pad;
  const hFont = customFont ? font : spec.headingFont || font;
  const bFont = customFont ? font : spec.bodyFont || font;
  const col = (v, fallback) => {
    if (!v) return fallback;
    if (v === "accent") return accent;
    if (v === "accentTint") return tint(accent, 0.9);
    if (v === "accentSoft") return tint(accent, 0.75);
    if (v === "accentDark") return shade(accent, 0.45);
    return v;
  };
  const pal = {
    page: col(spec.palette?.page, "#ffffff"),
    text: col(spec.palette?.text, "#374151"),
    muted: col(spec.palette?.muted, "#6b7280"),
    heading: col(spec.palette?.heading, "#111827"),
    rule: col(spec.palette?.rule, "#e5e7eb"),
    name: col(spec.palette?.name, col(spec.palette?.heading, "#111827")),
    headingAccent: col(spec.palette?.headingAccent, accent),
  };
  const side = spec.sidebar
    ? {
        bg: col(spec.sidebar.bg, "#1e293b"),
        text: col(spec.sidebar.text, "#e2e8f0"),
        muted: col(spec.sidebar.muted, "#94a3b8"),
        heading: col(spec.sidebar.heading, "#ffffff"),
        rule: col(spec.sidebar.rule, "#475569"),
        accent: col(spec.sidebar.accent, tint(accent, 0.45)),
        width: spec.sidebar.width || "32%",
        right: spec.sidebar.side === "right",
      }
    : null;

  const titles = { ...DEFAULT_TITLES, ...(spec.titles || {}) };
  const show = visibleSections(data);
  const p = data.personal;
  const contacts = contactItems(p, data.links);
  const k = {
    font: bFont, headingFont: hFont, text: pal.text, muted: pal.muted, heading: pal.heading, accent: col(spec.subtitleColor, accent),
    size: d.base, entryGap: d.entry, marker: spec.bullet || "•", bulletColor: col(spec.bulletColor, accent), dateColor: col(spec.dateColor, pal.muted),
  };
  const sk = side ? { ...k, text: side.text, muted: side.muted, heading: side.heading, accent: side.accent, bulletColor: side.accent, dateColor: side.muted, size: d.base - 0.4 } : k;
  const timeline = spec.timeline ? { line: col(spec.timelineLine, pal.rule), dot: accent, fill: pal.page } : undefined;

  // ---------- headings ----------
  const heading = (title, area = "main", index = 0) => {
    const onSide = area === "side";
    const hc = onSide ? side.heading : pal.heading;
    const ac = onSide ? side.accent : pal.headingAccent;
    const rule = onSide ? side.rule : pal.rule;
    const sz = d.base + (spec.headingSize ?? 1.4);
    const upper = spec.headingCase !== "none";
    const txt = (extra = {}) => ({ fontFamily: hFont, fontSize: sz, fontWeight: 700, color: hc, textTransform: upper ? "uppercase" : "none", letterSpacing: upper ? track(sz) : 0, ...extra });
    const style = onSide ? spec.sideHeading || "rule" : spec.heading || "rule";
    const mb = Math.max(6, d.gap * 0.6);
    switch (style) {
      case "rule-above":
        return <View style={{ borderTopWidth: 1.4, borderTopColor: hc, paddingTop: 4, marginBottom: mb }}><Text style={txt()}>{title}</Text></View>;
      case "bar":
        return (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: mb }}>
            <View style={{ width: 4, height: sz + 3, backgroundColor: ac, marginRight: 7, borderRadius: 1 }} />
            <Text style={txt()}>{title}</Text>
          </View>
        );
      case "pill":
        return (
          <View style={{ flexDirection: "row", marginBottom: mb }}>
            <Text style={txt({ color: "#ffffff", backgroundColor: ac, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 2.5, fontSize: sz - 1 })}>{title}</Text>
          </View>
        );
      case "caps":
        return <Text style={txt({ color: ac, marginBottom: mb })}>{title}</Text>;
      case "boxed":
        return (
          <View style={{ backgroundColor: onSide ? side.rule : tint(ac, 0.88), paddingVertical: 3.5, paddingHorizontal: 6, marginBottom: mb }}>
            <Text style={txt({ color: onSide ? side.heading : shade(ac, 0.3) })}>{title}</Text>
          </View>
        );
      case "double":
        return (
          <View style={{ marginBottom: mb }}>
            <Text style={txt()}>{title}</Text>
            <View style={{ borderBottomWidth: 0.7, borderBottomColor: hc, marginTop: 3 }} />
            <View style={{ borderBottomWidth: 0.7, borderBottomColor: hc, marginTop: 1.4 }} />
          </View>
        );
      case "short":
        return (
          <View style={{ marginBottom: mb }}>
            <Text style={txt({ fontSize: sz + 1.5, textTransform: "none", letterSpacing: 0 })}>{title}</Text>
            <View style={{ width: 28, height: 2.6, backgroundColor: ac, marginTop: 3, borderRadius: 1 }} />
          </View>
        );
      case "dotted":
        return (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: mb }}>
            <Text style={txt()}>{title}</Text>
            <View style={{ flex: 1, marginLeft: 6, borderBottomWidth: 1.2, borderBottomColor: rule, borderBottomStyle: "dotted" }} />
          </View>
        );
      case "number":
        return (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: mb }}>
            <Text style={txt({ color: ac, marginRight: 7 })}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={txt()}>{title}</Text>
            <View style={{ flex: 1, height: 0.8, backgroundColor: rule, marginLeft: 7 }} />
          </View>
        );
      case "tab":
        return (
          <View style={{ marginBottom: mb }}>
            <Text style={txt({ alignSelf: "flex-start", color: onSide ? side.bg : "#ffffff", backgroundColor: hc, paddingVertical: 3, paddingHorizontal: 9, fontSize: sz - 0.8 })}>{title}</Text>
            <View style={{ height: 1.2, backgroundColor: hc }} />
          </View>
        );
      case "center":
        return (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: mb }}>
            <View style={{ flex: 1, height: 0.8, backgroundColor: rule }} />
            <Text style={txt({ marginHorizontal: 8 })}>{title}</Text>
            <View style={{ flex: 1, height: 0.8, backgroundColor: rule }} />
          </View>
        );
      case "underline":
        return (
          <View style={{ flexDirection: "row", marginBottom: mb }}>
            <Text style={txt({ borderBottomWidth: 2, borderBottomColor: ac, paddingBottom: 2 })}>{title}</Text>
          </View>
        );
      default: // "rule"
        return (
          <View style={{ borderBottomWidth: onSide ? 0.8 : 1, borderBottomColor: onSide ? side.rule : col(spec.ruleColor, rule), paddingBottom: 3, marginBottom: mb }}>
            <Text style={txt()}>{title}</Text>
          </View>
        );
    }
  };

  // ---------- section content ----------
  const content = (id, area = "main") => {
    const kk = area === "side" ? sk : k;
    const onSide = area === "side";
    switch (id) {
      case "summary":
        return <Paragraph text={data.summary} k={kk} style={spec.justify ? { textAlign: "justify" } : undefined} />;
      case "experience":
        return <ExperienceList items={data.experience} k={kk} timeline={onSide ? undefined : timeline} companyFirst={spec.companyFirst} dateBelow={onSide || spec.dates === "below"} dateLeft={!onSide && spec.dates === "left"} />;
      case "education":
        return <EducationList items={data.education} k={kk} institutionFirst={spec.institutionFirst} dateBelow={onSide || spec.dates === "below"} dateLeft={!onSide && spec.dates === "left"} />;
      case "projects":
        return <ProjectList items={data.projects} k={kk} />;
      case "certifications":
        return <CertificationList items={data.certifications} k={kk} />;
      case "languages":
        return <SkillList text={data.languages} k={kk} variant={onSide ? "bullets" : "inline"} />;
      case "interests":
        return <SkillList text={data.interests} k={kk} variant={onSide ? "bullets" : "inline"} />;
      case "skills": {
        const v = onSide ? spec.sideSkills || "chips" : spec.skills || "chips";
        const chipColor = onSide ? side.text : accent;
        if (v === "outline") return <SkillList text={data.skills} k={kk} chip={{ border: onSide ? side.rule : tint(accent, 0.6), color: onSide ? side.text : pal.text, radius: 2 }} />;
        if (v === "solid") return <SkillList text={data.skills} k={kk} chip={{ bg: accent, color: "#ffffff", radius: 3 }} />;
        if (v === "grid3") return <SkillList text={data.skills} k={kk} variant="grid" columns={3} />;
        if (v === "chips") return <SkillList text={data.skills} k={kk} chip={{ bg: onSide ? side.rule : tint(accent, 0.88), color: onSide ? side.text : chipColor, radius: spec.chipRadius ?? 8 }} />;
        return <SkillList text={data.skills} k={kk} variant={v} />;
      }
      case "contact":
        return contacts.map((item) => (
          <ContactRow key={item.key} item={item} color={onSide ? side.text : pal.text} iconColor={onSide ? side.accent : accent} size={d.base - 1} style={{ marginBottom: 5 }} />
        ));
      default:
        return null;
    }
  };

  const hasSection = (id) => (id === "contact" ? contacts.length > 0 : show[id]);

  let sectionIndex = 0;
  const section = (id, area = "main", titleOverride, body) => {
    if (!titleOverride && !hasSection(id)) return null;
    const title = titleOverride || titles[id];
    const inner = body || content(id, area);
    const idx = sectionIndex++;
    if (spec.layout === "gutter" && area === "main") {
      return (
        <View key={id} wrap={!keepTogether(id, data)} style={{ flexDirection: "row", paddingBottom: d.gap }}>
          <View style={{ width: spec.gutter || "24%", paddingRight: 10 }}>{heading(title, "main", idx)}</View>
          {/* The body starts a little below the heading so text extraction (and so ATS)
              reads the heading as its own line instead of merging it into the first entry. */}
          <View style={{ flex: 1, paddingTop: d.base * 1.5 }}>{inner}</View>
        </View>
      );
    }
    return (
      <View key={id} wrap={!keepTogether(id, data)} style={{ paddingBottom: area === "side" ? d.gap + 2 : d.gap }}>
        <View minPresenceAhead={36}>{heading(title, area, idx)}</View>
        {inner}
      </View>
    );
  };

  // ---------- header ----------
  const nameStyle = (extra = {}) => {
    const sz = spec.nameSize || 24;
    const upper = spec.nameCase === "upper";
    return { fontFamily: col(spec.nameFont, null) || hFont, fontSize: sz, fontWeight: spec.nameWeight || 700, color: pal.name, textTransform: upper ? "uppercase" : "none", letterSpacing: upper ? track(sz) : 0, lineHeight: 1.1, ...extra };
  };
  const titleStyle = (extra = {}) => {
    const sz = d.base + 1.6;
    const upper = spec.titleCase === "upper";
    return { fontSize: sz, color: col(spec.titleColor, accent), marginTop: 4, textTransform: upper ? "uppercase" : "none", letterSpacing: upper ? track(sz) : 0, fontWeight: upper ? 700 : 500, ...extra };
  };
  const contactStyle = spec.contactStyle || "icons";
  const contactBlock = ({ color = pal.muted, iconColor = accent, align = "flex-start", column = false } = {}) => {
    if (!contacts.length) return null;
    const sz = d.base - 0.8;
    if (contactStyle === "dots" && !column) {
      return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: align, marginTop: 7 }}>
          {contacts.map((item, i) => (
            <View key={item.key} style={{ flexDirection: "row" }}>
              {i ? <Text style={{ fontSize: sz, marginHorizontal: sz * 0.6, color: tint(color.startsWith("#") ? color : "#666666", 0.3) }}>·</Text> : null}
              <MaybeLink href={item.href} style={{ fontSize: sz, color }}>{item.text}</MaybeLink>
            </View>
          ))}
        </View>
      );
    }
    if (contactStyle === "labels" || column) {
      return (
        <View style={{ marginTop: column ? 0 : 7, alignItems: align }}>
          {contacts.map((item) => (
            <View key={item.key} style={{ flexDirection: "row", marginBottom: 2.5, justifyContent: align }}>
              {contactStyle === "labels" ? <Text style={{ fontSize: sz - 0.6, color: iconColor, fontWeight: 700, width: align === "flex-end" ? undefined : 52, marginRight: 4 }}>{item.label}</Text> : null}
              {contactStyle === "icons" ? <View style={{ marginRight: 5, marginTop: 1 }}><Icon name={item.type} size={sz} color={iconColor} /></View> : null}
              <MaybeLink href={item.href} style={{ fontSize: sz, color }}>{item.text}</MaybeLink>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: align, marginTop: 7 }}>
        {contacts.map((item) => (
          <ContactRow key={item.key} item={item} color={color} iconColor={iconColor} size={sz} style={{ marginRight: align === "center" ? 6 : 12, marginLeft: align === "center" ? 6 : 0, marginBottom: 3 }} />
        ))}
      </View>
    );
  };
  const photoEl = (sizePt, border) => {
    if (!spec.photo) return null;
    const radius = spec.photo === "circle" ? sizePt / 2 : spec.photo === "rounded" ? sizePt * 0.16 : 0;
    if (p.profilePic) return <Photo src={p.profilePic} size={sizePt} radius={radius} border={border} />;
    if (spec.initials) return <Initials name={p.name} size={sizePt} bg={col(spec.initialsBg, tint(accent, 0.85))} color={col(spec.initialsColor, accent)} font={hFont} style={{ borderRadius: radius }} />;
    return null;
  };

  const bleed = { marginTop: -padV, marginHorizontal: side ? 0 : -padH, paddingHorizontal: side ? padH : padH };
  const header = () => {
    const name = p.name || "Your Name";
    switch (spec.header) {
      case "none":
        return null;
      case "center":
        return (
          <View style={{ alignItems: "center", marginBottom: d.gap, paddingBottom: spec.headerRule ? 10 : 0, borderBottomWidth: spec.headerRule ? 1.2 : 0, borderBottomColor: pal.heading }}>
            {photoEl(70) ? <View style={{ marginBottom: 8 }}>{photoEl(70)}</View> : null}
            <Text style={nameStyle({ textAlign: "center" })}>{name}</Text>
            {p.title ? <Text style={titleStyle({ textAlign: "center" })}>{p.title}</Text> : null}
            {contactBlock({ align: "center" })}
          </View>
        );
      case "split":
        return (
          <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: d.gap, paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: col(spec.headerRuleColor, accent) }}>
            {photoEl(62) ? <View style={{ marginRight: 12 }}>{photoEl(62)}</View> : null}
            <View style={{ flex: 1 }}>
              <Text style={nameStyle()}>{name}</Text>
              {p.title ? <Text style={titleStyle()}>{p.title}</Text> : null}
            </View>
            <View style={{ width: "40%" }}>{contactBlock({ align: "flex-end", column: true })}</View>
          </View>
        );
      case "band": {
        const bg = col(spec.bandBg, accent);
        const fg = col(spec.bandText, "#ffffff");
        return (
          <View style={{ ...bleed, backgroundColor: bg, paddingTop: padV + 6, paddingBottom: 20, marginBottom: d.gap + 4, flexDirection: "row", alignItems: "center" }}>
            {photoEl(78, { width: 3, color: fg }) ? <View style={{ marginRight: 16 }}>{photoEl(78, { width: 3, color: fg })}</View> : null}
            <View style={{ flex: 1 }}>
              <Text style={nameStyle({ color: fg })}>{name}</Text>
              {p.title ? <Text style={titleStyle({ color: fg, opacity: 0.9 })}>{p.title}</Text> : null}
              {contactBlock({ color: fg, iconColor: fg })}
            </View>
          </View>
        );
      }
      case "boxed":
        return (
          <View style={{ backgroundColor: col(spec.boxBg, tint(accent, 0.92)), borderRadius: spec.boxRadius ?? 6, padding: 14, marginBottom: d.gap, flexDirection: "row", alignItems: "center", borderLeftWidth: spec.boxAccentEdge ? 4 : 0, borderLeftColor: accent }}>
            <View style={{ flex: 1 }}>
              <Text style={nameStyle()}>{name}</Text>
              {p.title ? <Text style={titleStyle()}>{p.title}</Text> : null}
              {contactBlock()}
            </View>
            {photoEl(66) ? <View style={{ marginLeft: 12 }}>{photoEl(66)}</View> : null}
          </View>
        );
      case "monogram": {
        const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
        return (
          <View style={{ marginBottom: d.gap }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {p.profilePic && spec.photo ? (
                <View style={{ marginRight: 14 }}>{photoEl(58)}</View>
              ) : (
                <View style={{ width: 54, height: 54, backgroundColor: accent, marginRight: 14, alignItems: "center", justifyContent: "center", borderRadius: spec.monogramRound ? 27 : 4 }}>
                  <Text style={{ fontFamily: hFont, fontSize: 22, fontWeight: 700, color: "#ffffff" }}>{initials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={nameStyle()}>{name}</Text>
                {p.title ? <Text style={titleStyle()}>{p.title}</Text> : null}
              </View>
            </View>
            {contactBlock()}
          </View>
        );
      }
      case "stack": {
        const [first, ...rest] = name.split(/\s+/);
        return (
          <View style={{ flexDirection: "row", marginBottom: d.gap + 2 }}>
            <View style={{ flex: 1 }}>
              <Text style={nameStyle()}>{first}</Text>
              <Text style={nameStyle({ color: accent })}>{rest.join(" ")}</Text>
              {p.title ? <Text style={titleStyle({ color: pal.muted })}>{p.title}</Text> : null}
            </View>
            <View style={{ width: "38%", justifyContent: "flex-end" }}>{contactBlock({ align: "flex-end", column: true })}</View>
          </View>
        );
      }
      case "underline":
        return (
          <View style={{ marginBottom: d.gap, flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Text style={nameStyle()}>{name}</Text>
              <View style={{ width: 54, height: 3.5, backgroundColor: accent, marginTop: 6, marginBottom: 2 }} />
              {p.title ? <Text style={titleStyle({ color: pal.muted })}>{p.title}</Text> : null}
              {contactBlock()}
            </View>
            {photoEl(72) ? <View style={{ marginLeft: 14 }}>{photoEl(72)}</View> : null}
          </View>
        );
      case "minimal":
        return (
          <View style={{ marginBottom: d.gap }}>
            <Text style={nameStyle()}>
              {name}
              {p.title ? <Text style={{ fontSize: (spec.nameSize || 24) * 0.6, color: pal.muted, fontWeight: 400 }}>{`  ${p.title}`}</Text> : null}
            </Text>
            {contactBlock()}
          </View>
        );
      default: // "left"
        return (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: d.gap, paddingBottom: spec.headerRule ? 10 : 0, borderBottomWidth: spec.headerRule ? 1 : 0, borderBottomColor: pal.rule }}>
            <View style={{ flex: 1 }}>
              <Text style={nameStyle()}>{name}</Text>
              {p.title ? <Text style={titleStyle()}>{p.title}</Text> : null}
              {contactBlock()}
            </View>
            {photoEl(70) ? <View style={{ marginLeft: 14 }}>{photoEl(70)}</View> : null}
          </View>
        );
    }
  };

  // ---------- decorations ----------
  const pageW = size === "LETTER" ? 612 : 595;
  const decor = [];
  if (spec.decor?.topStrip) decor.push(<View key="ts" fixed style={{ position: "absolute", top: 0, left: 0, right: 0, height: spec.decor.topStrip, backgroundColor: accent }} />);
  if (spec.decor?.sideStrip) decor.push(<View key="ss" fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: spec.decor.sideStrip, backgroundColor: accent }} />);
  if (spec.decor?.circles) {
    decor.push(
      <Svg key="cc" width={220} height={220} style={{ position: "absolute", top: -70, left: pageW - 150 }}>
        <Circle cx={110} cy={110} r={100} fill={tint(accent, 0.86)} />
        <Circle cx={60} cy={160} r={34} fill={tint(accent, 0.7)} />
      </Svg>
    );
  }
  if (spec.decor?.bottomStrip) decor.push(<View key="bs" fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: spec.decor.bottomStrip, backgroundColor: tint(accent, 0.6) }} />);

  // ---------- sections ----------
  const mainOrder = spec.order || ["summary", "experience", "projects", "education", "skills", "certifications", "languages"];
  const sideOrder = side || spec.layout === "columns" ? spec.sideOrder || ["contact", "skills", "languages", "certifications"] : [];
  const skipExtras = sideOrder.includes("interests") ? ["interests"] : [];
  const extras = (area) =>
    extraSections(data, area === "side" ? sk : k, (id, title, children) => section(id, area, title, children), { timeline, skip: skipExtras });

  const mainSections = () => [...mainOrder.filter((id) => !sideOrder.includes(id)).map((id) => section(id, "main")), ...extras("main")];

  const sidebarIdentity = () => (
    <View style={{ alignItems: spec.sidebar?.align === "left" ? "flex-start" : "center", marginBottom: d.gap + 4 }}>
      {photoEl(92, { width: 3, color: side.rule })}
      <Text style={nameStyle({ color: side.heading, fontSize: Math.min(spec.nameSize || 20, 20), marginTop: 10, textAlign: spec.sidebar?.align === "left" ? "left" : "center" })}>{p.name || "Your Name"}</Text>
      {p.title ? <Text style={titleStyle({ color: side.accent, fontSize: d.base, textAlign: spec.sidebar?.align === "left" ? "left" : "center" })}>{p.title}</Text> : null}
    </View>
  );

  // ---------- layouts ----------
  const pageStyle = { fontFamily: bFont, backgroundColor: pal.page, paddingVertical: padV };

  if (side) {
    const sideCol = (
      <View style={{ width: side.width, paddingHorizontal: 18, paddingTop: spec.header === "none" ? 0 : 6 }}>
        {spec.header === "none" ? sidebarIdentity() : null}
        {sideOrder.map((id) => section(id, "side"))}
      </View>
    );
    const mainCol = <View style={{ flex: 1, paddingHorizontal: 24 }}>{mainSections()}</View>;
    return (
      <Page size={size} style={pageStyle}>
        <View fixed style={{ position: "absolute", top: 0, bottom: 0, [side.right ? "right" : "left"]: 0, width: side.width, backgroundColor: side.bg }} />
        {decor}
        {spec.header !== "none" ? (
          // Full-width header above the columns; it covers the sidebar colour on page 1.
          <View style={{ paddingHorizontal: spec.header === "band" ? 0 : padH, backgroundColor: spec.header === "band" ? undefined : pal.page, marginTop: -padV, paddingTop: padV, marginBottom: 4 }}>{header()}</View>
        ) : null}
        <View style={{ flexDirection: side.right ? "row-reverse" : "row" }}>
          {sideCol}
          {mainCol}
        </View>
      </Page>
    );
  }

  if (spec.layout === "columns") {
    return (
      <Page size={size} style={{ ...pageStyle, paddingHorizontal: padH }}>
        {decor}
        {header()}
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: spec.split || "64%", paddingRight: 16 }}>{mainSections()}</View>
          <View style={{ flex: 1, paddingLeft: 14, borderLeftWidth: spec.divider ? 0.8 : 0, borderLeftColor: pal.rule }}>{sideOrder.map((id) => section(id, "main"))}</View>
        </View>
      </Page>
    );
  }

  return (
    <Page size={size} style={{ ...pageStyle, paddingHorizontal: padH, paddingLeft: padH + (spec.decor?.sideStrip || 0) }}>
      {decor}
      {header()}
      {mainSections()}
    </Page>
  );
}
