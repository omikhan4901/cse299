import Image from "next/image";
import Link from "next/link";
import { TEMPLATES } from "@/pdf/registry";

function Row({ items, reverse }) {
  // The list is doubled so the strip can loop seamlessly.
  return (
    <div className="flex w-max gap-5 py-3">
      <div className={`flex gap-5 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}>
        {[...items, ...items].map((t, i) => (
          <Link
            key={`${t.id}-${i}`}
            href={`/builder?template=${t.id}`}
            className="group relative block w-44 shrink-0 overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-slate-900/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl sm:w-52"
            tabIndex={i >= items.length ? -1 : undefined}
            aria-hidden={i >= items.length ? true : undefined}
          >
            <Image src={`/templates/${t.id}.jpg`} alt={`${t.name} template`} width={827} height={1170} sizes="210px" className="h-auto w-full" />
            <span className="absolute inset-x-0 bottom-0 translate-y-full bg-ink/85 py-2 text-center text-xs font-semibold text-white transition group-hover:translate-y-0">
              {t.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Two rows of templates drifting past in opposite directions (pauses on hover). */
export default function TemplateMarquee() {
  const half = Math.ceil(TEMPLATES.length / 2);
  return (
    <div className="marquee relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <Row items={TEMPLATES.slice(0, half)} />
      <Row items={[...TEMPLATES.slice(half), ...TEMPLATES.slice(0, 1)]} reverse />
    </div>
  );
}
