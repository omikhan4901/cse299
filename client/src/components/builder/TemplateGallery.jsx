"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Input, Modal } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { Check, Crown, LayoutGrid, Search, ShieldCheck, Columns2, Image as ImageIcon, X } from "lucide-react";
import { CATEGORIES, TEMPLATES } from "@/pdf/registry";

const FILTERS = [
  { id: "ats", label: "ATS-safe", icon: ShieldCheck, test: (t) => !t.tags.some((x) => /Sidebar|Two column|Photo/.test(x)) },
  { id: "one", label: "One column", icon: LayoutGrid, test: (t) => t.tags.includes("One column") || t.tags.includes("Side headings") },
  { id: "two", label: "Two column", icon: Columns2, test: (t) => t.tags.includes("Sidebar") || t.tags.includes("Two column") },
  { id: "photo", label: "With photo", icon: ImageIcon, test: (t) => t.tags.includes("Photo") },
];

function Card({ t, active, onPick, locked }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      type="button"
      onClick={() => onPick(t.id)}
      className={`group overflow-hidden rounded-xl border bg-white text-left transition-shadow duration-300 ${active ? "border-brand ring-2 ring-brand" : "border-slate-200 hover:border-brand-200 hover:shadow-xl"}`}
    >
      <div className="relative aspect-[1/1.414] overflow-hidden bg-slate-100">
        <Image src={`/templates/${t.id}.jpg`} alt={`${t.name} resume template`} fill sizes="(min-width: 1024px) 190px, 45vw" className="object-cover object-top transition duration-500 group-hover:scale-[1.04]" />
        {locked ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow">
            <Crown size={10} /> PRO
          </span>
        ) : null}
        {active ? (
          <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white shadow">
            <Check size={14} />
          </span>
        ) : (
          <span className="absolute inset-x-0 bottom-0 flex translate-y-full justify-center bg-gradient-to-t from-ink/75 to-transparent pt-8 pb-3 transition duration-300 group-hover:translate-y-0">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow">Use template</span>
          </span>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-ink">{t.name}</p>
        <p className="truncate text-[11px] text-slate-400">{t.tags.join(" · ")}</p>
      </div>
    </motion.button>
  );
}

/**
 * Full template browser: categories down the side, search and layout filters
 * on top. Picking a template applies it and closes the dialog.
 */
export default function TemplateGallery({ open, onClose, current, onPick, initialCategory, isLocked }) {
  const [category, setCategory] = useState(initialCategory || "all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState([]);

  // Reset to the current template's category each time the dialog opens.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setCategory(initialCategory || "all");
      setQuery("");
      setFilters([]);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter(
      (t) =>
        (!q || `${t.name} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(q)) &&
        filters.every((f) => FILTERS.find((x) => x.id === f).test(t)),
    );
  }, [query, filters]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, matches.filter((t) => t.category === c.id).length])), [matches]);
  const shown = category === "all" ? matches : matches.filter((t) => t.category === category);
  const groups = category === "all" ? CATEGORIES.filter((c) => counts[c.id]) : CATEGORIES.filter((c) => c.id === category);

  const pick = (id) => {
    onPick(id);
    onClose();
  };
  const toggle = (id) => setFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const navItem = (id, label, count) => (
    <button
      key={id}
      type="button"
      onClick={() => setCategory(id)}
      className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition lg:w-full ${category === id ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${category === id ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{count}</span>
    </button>
  );

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={1080} centered destroyOnHidden title={null} closeIcon={<X size={18} />} styles={{ body: { padding: 0 } }}>
      <div className="flex h-[min(82vh,760px)] flex-col lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-100 p-3 lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:p-4" aria-label="Template categories">
          <p className="mb-2 hidden px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase lg:block">Categories</p>
          {navItem("all", "All templates", matches.length)}
          {CATEGORIES.map((c) => navItem(c.id, c.name, counts[c.id]))}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-slate-100 p-4 pr-14">
            <Input allowClear prefix={<Search size={15} className="text-slate-400" />} placeholder="Search templates (e.g. navy, serif, sidebar)" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="mt-3 flex flex-wrap gap-2">
              {FILTERS.map(({ id, label, icon: Icon }) => {
                const on = filters.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${on ? "border-brand bg-brand-50 text-brand" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
            {shown.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                <Search size={28} className="mb-2 text-slate-300" />
                <p>No templates match those filters.</p>
                <button type="button" onClick={() => { setQuery(""); setFilters([]); }} className="mt-2 text-sm font-medium text-brand">Clear filters</button>
              </div>
            ) : (
              groups.map((c) => (
                <section key={c.id} className="mb-8 last:mb-0">
                  <div className="mb-3">
                    <h3 className="font-display text-lg font-bold text-ink">{c.name}</h3>
                    <p className="text-sm text-slate-500">{c.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence mode="popLayout">
                      {shown.filter((t) => t.category === c.id).map((t) => (
                        <Card key={t.id} t={t} active={t.id === current} onPick={pick} locked={!!isLocked?.(t.id)} />
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
