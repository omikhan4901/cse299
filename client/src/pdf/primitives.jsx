/* Shared building blocks for the PDF templates (react-pdf primitives, sizes in pt). */
import { View, Text, Link, Image, Svg, Path, Circle, Rect } from "@react-pdf/renderer";
import { splitBullets, splitList, toHref, prettyUrl, dateRange } from "@/lib/resume";

export { splitBullets, splitList, dateRange };

const ICON_PATHS = {
  phone: [
    { d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" },
  ],
  email: [{ rect: [2, 4, 20, 16, 2] }, { d: "M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" }],
  city: [{ d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" }, { circle: [12, 10, 3] }],
  linkedin: [
    { d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" },
    { rect: [2, 9, 4, 12, 0] },
    { circle: [4, 4, 2] },
  ],
  website: [{ circle: [12, 12, 10] }, { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }, { d: "M2 12h20" }],
};

export function Icon({ name, size = 9, color = "#333" }) {
  const parts = ICON_PATHS[name];
  if (!parts) return null;
  const stroke = { stroke: color, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {parts.map((p, i) => {
        if (p.d) return <Path key={i} d={p.d} {...stroke} />;
        if (p.circle) return <Circle key={i} cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} {...stroke} />;
        const [x, y, width, height, rx] = p.rect;
        return <Rect key={i} x={x} y={y} width={width} height={height} rx={rx} {...stroke} />;
      })}
    </Svg>
  );
}

/** Contact entries in display order, with ready-to-use links. */
export function contactItems(personal = {}) {
  const items = [];
  if (personal.phone) items.push({ type: "phone", label: "Phone", text: personal.phone, href: `tel:${personal.phone.replace(/[^\d+]/g, "")}` });
  if (personal.email) items.push({ type: "email", label: "Email", text: personal.email, href: `mailto:${personal.email}` });
  if (personal.city) items.push({ type: "city", label: "Location", text: personal.city });
  if (personal.linkedin) items.push({ type: "linkedin", label: "LinkedIn", text: prettyUrl(personal.linkedin), href: toHref(personal.linkedin) });
  if (personal.website) items.push({ type: "website", label: "Website", text: prettyUrl(personal.website), href: toHref(personal.website) });
  return items;
}

/** Text that becomes a clickable link in the PDF when it has an href. */
export function MaybeLink({ href, style, children }) {
  if (!href) return <Text style={style}>{children}</Text>;
  return (
    <Link src={href} style={[{ textDecoration: "none" }, ...(Array.isArray(style) ? style : [style])]}>
      {children}
    </Link>
  );
}

export function ContactRow({ item, color, iconColor, size = 9, gap = 5, style, iconSize }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>
      <View style={{ marginRight: gap }}>
        <Icon name={item.type} size={iconSize || size} color={iconColor || color} />
      </View>
      <MaybeLink href={item.href} style={{ fontSize: size, color }}>
        {item.text}
      </MaybeLink>
    </View>
  );
}

/**
 * Bullet list from a multi-line description. Each line is kept whole so a
 * bullet never splits across a page break.
 */
export function Bullets({ text, color = "#333", size = 9.5, bullet = "•", bulletColor, lineHeight = 1.45, gap = 2, style, indent = 10 }) {
  const lines = splitBullets(text);
  if (!lines.length) return null;
  return (
    <View style={style}>
      {lines.map((line, i) => (
        <View key={i} wrap={false} style={{ flexDirection: "row", marginTop: i ? gap : 0 }}>
          {bullet ? (
            <Text style={{ width: indent, fontSize: size, color: bulletColor || color, lineHeight }}>{bullet}</Text>
          ) : null}
          <Text style={{ flex: 1, fontSize: size, color, lineHeight }}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function Photo({ src, size = 80, radius, border, style }) {
  if (!src) return null;
  return (
    // react-pdf images have no alt text; the PDF carries the name as real text.
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      src={src}
      style={[
        { width: size, height: size, borderRadius: radius ?? size / 2, objectFit: "cover" },
        border ? { borderWidth: border.width, borderColor: border.color } : {},
        style,
      ]}
    />
  );
}

/** Photo placeholder with the person's initials, used by templates built around a photo. */
export function Initials({ name, size = 80, bg, color, font, style }) {
  const initials = (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }, style]}>
      <Text style={{ fontSize: size * 0.34, color, fontFamily: font, fontWeight: 700 }}>{initials || " "}</Text>
    </View>
  );
}

/** Sections in the order the templates use them, skipping empty ones. */
export function visibleSections(resume) {
  return {
    summary: !!resume.summary?.trim(),
    experience: resume.experience?.length > 0,
    education: resume.education?.length > 0,
    projects: resume.projects?.length > 0,
    certifications: resume.certifications?.length > 0,
    skills: splitList(resume.skills).length > 0,
    languages: splitList(resume.languages).length > 0,
  };
}

export const SECTION_TITLES = {
  summary: "About Me",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
  skills: "Skills",
  languages: "Languages",
};

/** Mixes a hex colour with white (amount 0..1) for tints of the accent colour. */
export function tint(hex, amount) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Mixes a hex colour with black (amount 0..1). */
export function shade(hex, amount) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const mix = (c) => Math.round(c * (1 - amount));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function projectHref(link) {
  return link ? toHref(link) : "";
}
export { prettyUrl };
