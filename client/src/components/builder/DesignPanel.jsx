"use client";

import Image from "next/image";
import { ColorPicker, Select, Segmented, Tooltip } from "antd";
import { motion } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { TEMPLATES, ACCENT_SWATCHES, templateById } from "@/pdf/registry";
import { FONT_OPTIONS } from "@/pdf/fonts";

export default function DesignPanel({ resume, onTemplate, setTheme }) {
  const tpl = templateById(resume.template);
  const accent = resume.theme.accent || tpl.accent;
  const customised = !!(resume.theme.accent || resume.theme.font);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-ink">Colour &amp; font</h3>
          {customised ? (
            <button type="button" onClick={() => setTheme({ accent: "", font: "" })} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand">
              <RotateCcw size={12} /> Template defaults
            </button>
          ) : null}
        </div>
        <p className="mb-2 text-xs font-medium text-slate-600">Accent colour</p>
        <div className="flex flex-wrap items-center gap-2">
          {[tpl.accent, ...ACCENT_SWATCHES.filter((c) => c !== tpl.accent)].slice(0, 10).map((c) => (
            <Tooltip key={c} title={c === tpl.accent ? "Template default" : c}>
              <button
                type="button"
                onClick={() => setTheme({ accent: c === tpl.accent ? "" : c })}
                className="flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110"
                style={{ backgroundColor: c, boxShadow: accent.toLowerCase() === c.toLowerCase() ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }}
                aria-label={`Accent ${c}`}
              >
                {accent.toLowerCase() === c.toLowerCase() ? <Check size={14} color="#fff" /> : null}
              </button>
            </Tooltip>
          ))}
          <ColorPicker value={accent} onChangeComplete={(c) => setTheme({ accent: c.toHexString() })} disabledAlpha size="small" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">Font</p>
            <Select className="w-full" value={resume.theme.font} onChange={(font) => setTheme({ font })} options={FONT_OPTIONS.map((o) => ({ ...o, label: o.value ? o.label : `Default (${tpl.font})` }))} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">Paper size</p>
            <Segmented block value={resume.theme.pageSize || "A4"} onChange={(pageSize) => setTheme({ pageSize })} options={[{ label: "A4", value: "A4" }, { label: "US Letter", value: "LETTER" }]} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 px-1 text-[15px] font-semibold text-ink">Templates</h3>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map((t) => {
            const active = t.id === tpl.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTemplate(t.id)}
                className={`group overflow-hidden rounded-xl border bg-white text-left transition duration-300 ${active ? "border-brand ring-2 ring-brand" : "border-slate-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"}`}
              >
                <div className="relative aspect-[1/1.414] overflow-hidden bg-slate-100">
                  <Image src={`/templates/${t.id}.jpg`} alt={`${t.name} resume template`} fill sizes="200px" className="object-cover object-top transition group-hover:scale-[1.02]" />
                  {active ? (
                    <motion.span
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white shadow"
                    >
                      <Check size={14} />
                    </motion.span>
                  ) : null}
                </div>
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-ink">{t.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{t.tags.join(" · ")}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
