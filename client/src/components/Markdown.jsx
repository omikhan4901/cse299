import { Fragment } from "react";
import Link from "next/link";
import { Check, Lightbulb, X } from "lucide-react";

/**
 * A tiny Markdown renderer for our own content (the resume guide and career
 * guides): # headings, paragraphs, "-" and "1." lists, "> " callouts,
 * **bold**, *italic* and [links](/path). Works in server and client components.
 */

export const slugify = (text) => text.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function parseMarkdown(markdown) {
  const blocks = [];
  let list = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^- (.*)/);
    const numbered = line.match(/^\d+\. (.*)/);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) blocks.push((list = { type, items: [] }));
      list.items.push((bullet || numbered)[1]);
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3}) (.*)/);
    if (heading) blocks.push({ type: `h${heading[1].length}`, text: heading[2] });
    else if (line.startsWith("> ")) blocks.push({ type: "quote", text: line.slice(2) });
    else blocks.push({ type: "p", text: line });
  }
  return blocks;
}

export function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return link[2].startsWith("/") ? (
        <Link key={i} href={link[2]} className="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">{link[1]}</Link>
      ) : (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">{link[1]}</a>
      );
    }
    if (part.startsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function ListItem({ text }) {
  const example = text.match(/^\*\*(Weak|Strong):\*\* (.*)/);
  if (example) {
    const strong = example[1] === "Strong";
    return (
      <li className={`flex gap-2.5 rounded-lg px-3 py-2 ${strong ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${strong ? "bg-emerald-500" : "bg-rose-400"}`}>
          {strong ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
        </span>
        <span>{example[2]}</span>
      </li>
    );
  }
  return (
    <li className="relative pl-5 before:absolute before:top-[0.6em] before:left-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand">
      <Inline text={text} />
    </li>
  );
}

export function Block({ b, idPrefix = "", large = false }) {
  switch (b.type) {
    case "h1":
      return <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">{b.text}</h1>;
    case "h2":
      return (
        <h2 id={`${idPrefix}${slugify(b.text)}`} className={`mt-10 scroll-mt-24 border-b border-slate-100 pb-2 font-display font-bold text-ink first:mt-0 ${large ? "text-2xl" : "text-xl"}`}>
          {b.text}
        </h2>
      );
    case "h3":
      return <h3 className={`mt-6 font-semibold text-ink ${large ? "text-lg" : "text-[15px]"}`}>{b.text}</h3>;
    case "quote":
      return (
        <div className="my-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-ink">
          <Lightbulb size={18} className="shrink-0 text-brand" />
          <span><Inline text={b.text} /></span>
        </div>
      );
    case "ul":
      return (
        <ul className="mt-2.5 space-y-1.5">
          {b.items.map((t, i) => <ListItem key={i} text={t} />)}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-2.5 space-y-2">
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">{i + 1}</span>
              <span><Inline text={t} /></span>
            </li>
          ))}
        </ol>
      );
    default:
      return <p className="mt-3"><Inline text={b.text} /></p>;
  }
}

/** Renders Markdown. `skipTitle` drops the leading # heading (when the page shows its own). */
export default function Markdown({ markdown, idPrefix = "", large = false, skipTitle = false }) {
  const blocks = parseMarkdown(markdown).filter((b, i) => !(skipTitle && i === 0 && b.type === "h1"));
  return blocks.map((b, i) => <Block key={i} b={b} idPrefix={idPrefix} large={large} />);
}
