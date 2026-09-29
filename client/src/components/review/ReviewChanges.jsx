"use client";

import { useMemo, useState } from "react";
import { Button, Checkbox, Modal } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Check, Sparkles, Trash2 } from "lucide-react";
import { describeOperation, isRemoval } from "@/lib/ingest/ops";

/**
 * Reviewable changes (V2): a list of operations shown as small cards the person ticks.
 * Used by imports, the assistant, "Pull updates" and "Save to profile". Nothing changes
 * until they apply. Operations flagged "unverified" start unticked. Removals (only ever
 * proposed when the person asked for them) are marked in red and apply first.
 *
 *   operations  from server/lib/ingest.js or client/src/lib/profile.js
 *   target      the resume or profile they apply to (for names in the cards)
 *   onApply(selected operations)
 */
export default function ReviewChanges({ open, title, subtitle, operations, target, onApply, onClose, applyLabel = "Apply" }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={560} centered destroyOnHidden title={null}>
      {open ? <Body title={title} subtitle={subtitle} operations={operations || []} target={target} onApply={onApply} onClose={onClose} applyLabel={applyLabel} /> : null}
    </Modal>
  );
}

const unverified = (o) => o.flags?.find((f) => f.kind === "unverified");
const replacing = (o) => o.flags?.find((f) => f.kind === "replaces");

function Body({ title, subtitle, operations, target, onApply, onClose, applyLabel }) {
  const [picked, setPicked] = useState(() => new Set(operations.filter((o) => !unverified(o)).map((o) => o.key)));
  const [busy, setBusy] = useState(false);
  const cards = useMemo(() => operations.map((o) => ({ o, ...describeOperation(o, target) })), [operations, target]);
  const toggle = (key) => setPicked((s) => (s.has(key) ? new Set([...s].filter((k) => k !== key)) : new Set([...s, key])));
  const apply = async (list) => {
    setBusy(true);
    try {
      await onApply(list);
    } finally {
      setBusy(false);
    }
  };

  if (!operations.length) {
    return (
      <div className="py-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">
          <Check size={22} />
        </span>
        <h2 className="mt-4 font-display text-lg font-bold text-ink">Nothing to change</h2>
        <p className="mt-1 text-sm text-slate-500">Everything is already up to date.</p>
        <Button className="!mt-5" onClick={onClose}>Close</Button>
      </div>
    );
  }

  const selected = operations.filter((o) => picked.has(o.key));
  const flagged = operations.filter(unverified).length;
  return (
    <div className="pt-1">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-600 text-white shadow-md shadow-brand/25">
          <Sparkles size={18} />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      <ul className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {cards.map(({ o, title: t, detail, before }, i) => {
            const on = picked.has(o.key);
            const check = unverified(o);
            const removes = isRemoval(o);
            return (
              <motion.li
                key={o.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03 }}
              >
                <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${on ? (removes ? "border-rose-200 bg-rose-50/50" : "border-brand-200 bg-brand-50/40") : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <Checkbox checked={on} onChange={() => toggle(o.key)} className="!mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-1.5 text-sm font-medium ${removes ? "text-rose-700" : "text-ink"}`}>
                      {removes ? <Trash2 size={13} className="shrink-0" /> : null}
                      {t}
                    </span>
                    {before ? (
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="line-through decoration-slate-300">{before}</span>
                        <ArrowRight size={12} className="text-slate-400" />
                      </span>
                    ) : null}
                    {detail?.length ? (
                      <ul className="mt-1 space-y-0.5">
                        {detail.slice(0, 4).map((d) => (
                          <li key={d} className="text-xs leading-relaxed text-slate-600">{d}</li>
                        ))}
                        {detail.length > 4 ? <li className="text-xs text-slate-400">and {detail.length - 4} more</li> : null}
                      </ul>
                    ) : null}
                    {check ? (
                      <span className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertTriangle size={13} className="mt-px shrink-0" /> Check this: {check.tokens.join(", ")} {check.tokens.length === 1 ? "isn't" : "aren't"} in what you wrote.
                      </span>
                    ) : replacing(o) ? (
                      <span className="mt-1.5 block text-xs text-slate-400">Replaces what&apos;s there now.</span>
                    ) : null}
                  </span>
                </label>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {flagged ? `${flagged} to check before adding.` : `${selected.length} of ${operations.length} selected.`}
          {selected.some(isRemoval) ? ` Removals apply first.` : ""}
        </p>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={busy} disabled={!selected.length} onClick={() => apply(selected)}>
            {selected.length === operations.length ? `${applyLabel} all` : `${applyLabel} ${selected.length}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
