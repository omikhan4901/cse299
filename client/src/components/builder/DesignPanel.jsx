"use client";

import Image from "next/image";
import { Button, ColorPicker, Select, Segmented, Tooltip } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { Check, HelpCircle, LayoutGrid, RotateCcw } from "lucide-react";
import { TEMPLATES, CATEGORIES, ACCENT_SWATCHES, templateById, templatesIn, categoryById } from "@/pdf/registry";
import { FONT_OPTIONS } from "@/pdf/fonts";

/**
 * Design tab: the current template with quick picks from its category (the
 * full 50 live in the TemplateGallery dialog), then colour, font and paper.
 */
export default function DesignPanel({ resume, onTemplate, setTheme, onBrowse, onHelp }) {
  const tpl = templateById(resume.template);
  const category = categoryById(tpl.category);
  const siblings = templatesIn(tpl.category);
  const accent = resume.theme.accent || tpl.accent;
  const customised = !!(resume.theme.accent || resume.theme.font);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-ink">Template</h3>
          <button type="button" onClick={onHelp} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand">
            <HelpCircle size={13} /> How to write a good resume
          </button>
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={() => onBrowse(tpl.category)} className="group relative aspect-[1/1.414] w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm">
            <Image src={`/templates/${tpl.id}.jpg`} alt={`${tpl.name} resume template`} fill sizes="112px" className="object-cover object-top transition group-hover:scale-105" />
          </button>
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div key={tpl.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                <p className="font-display text-lg font-bold text-ink">{tpl.name}</p>
                <span className="mt-0.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand">{category?.name}</span>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{tpl.description}</p>
                <p className="mt-1 text-[11px] text-slate-400">{tpl.tags.join(" · ")}</p>
              </motion.div>
            </AnimatePresence>
            <Button type="primary" className="mt-3" icon={<LayoutGrid size={15} />} onClick={() => onBrowse("all")}>
              Browse all {TEMPLATES.length} templates
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-slate-600">More {category?.name} designs</p>
          <div className="thin-scroll -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2">
            {siblings.map((t) => {
              const active = t.id === tpl.id;
              return (
                <Tooltip key={t.id} title={t.name}>
                  <button
                    type="button"
                    onClick={() => onTemplate(t.id)}
                    aria-label={`Use the ${t.name} template`}
                    aria-pressed={active}
                    className={`relative aspect-[1/1.414] w-[74px] shrink-0 overflow-hidden rounded-md border bg-slate-100 transition duration-200 ${active ? "border-brand ring-2 ring-brand" : "border-slate-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"}`}
                  >
                    <Image src={`/templates/${t.id}.jpg`} alt="" fill sizes="74px" className="object-cover object-top" />
                    {active ? (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white shadow">
                        <Check size={10} />
                      </span>
                    ) : null}
                  </button>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => c.id !== tpl.category).map((c) => (
              <button key={c.id} type="button" onClick={() => onBrowse(c.id)} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-brand hover:text-brand">
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>
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

    </div>
  );
}
