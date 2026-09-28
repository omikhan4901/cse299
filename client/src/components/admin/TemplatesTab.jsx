"use client";

import Image from "next/image";
import { Alert, Button, Segmented, Select, Skeleton, Tooltip } from "antd";
import { Crown, RotateCcw } from "lucide-react";
import { CATEGORIES, PLAN_ORDER, TEMPLATES, planIncludes, templateTier, templatesIn } from "@/pdf/registry";
import { useSettingsDraft } from "./useSettingsDraft";
import SaveBar from "./SaveBar";

const TIER_STYLE = {
  free: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pro: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  premium: "bg-amber-50 text-amber-800 ring-amber-200",
};

/**
 * Which plan each template needs. Set a plan for a whole category, then
 * override single templates. Plans stack: Premium users also get Pro templates.
 */
export default function TemplatesTab() {
  const { settings, error, loading, update, save, saving, dirty, discard } = useSettingsDraft();
  if (loading && !settings) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error) return <Alert type="error" showIcon title={error} />;

  const access = settings.templates;
  const planName = (id) => settings.plans.find((p) => p.id === id)?.name || id;
  const tierOptions = PLAN_ORDER.map((id) => ({ value: id, label: planName(id) }));

  const setCategory = (category, tier) => update((s) => ((s.templates.categories[category] = tier), s));
  const setOverride = (id, tier) =>
    update((s) => {
      if (tier) s.templates.overrides[id] = tier;
      else delete s.templates.overrides[id];
      return s;
    });
  const resetCategory = (category) =>
    update((s) => {
      for (const t of templatesIn(category)) delete s.templates.overrides[t.id];
      return s;
    });

  return (
    <div className="space-y-5 pb-20">
      {settings.freeMode.enabled ? (
        <Alert type="info" showIcon title="Free mode is on" description="Every template is open to everyone right now. These rules apply once you turn free mode off in Credits & access." />
      ) : null}

      <div className="flex flex-wrap gap-3">
        {PLAN_ORDER.map((id) => (
          <div key={id} className="rounded-2xl border border-slate-200 bg-white px-5 py-3">
            <p className="text-xs font-medium text-slate-500">{planName(id)} plan</p>
            <p className="font-display text-2xl font-bold text-ink tabular-nums">
              {TEMPLATES.filter((t) => planIncludes(id, t, access)).length}
              <span className="text-sm font-medium text-slate-400"> / {TEMPLATES.length} templates</span>
            </p>
          </div>
        ))}
        <p className="max-w-md self-center text-sm text-slate-500">
          Set a plan for each category, then override single templates if you like. Higher plans include everything below them.
        </p>
      </div>

      {CATEGORIES.map((c) => {
        const templates = templatesIn(c.id);
        const categoryTier = access.categories[c.id] || "pro";
        const overridden = templates.filter((t) => access.overrides[t.id]).length;
        return (
          <section key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">
                  {c.name} <span className="font-normal text-slate-400">· {templates.length} templates</span>
                </h2>
                <p className="text-sm text-slate-500">{c.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {overridden ? (
                  <Tooltip title="Remove the single-template overrides in this category">
                    <Button size="small" type="text" icon={<RotateCcw size={13} />} onClick={() => resetCategory(c.id)}>
                      {overridden} override{overridden === 1 ? "" : "s"}
                    </Button>
                  </Tooltip>
                ) : null}
                <Segmented value={categoryTier} onChange={(v) => setCategory(c.id, v)} options={tierOptions} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {templates.map((t) => {
                const tier = templateTier(t, access);
                const own = access.overrides[t.id];
                return (
                  <div key={t.id} className={`rounded-xl border p-2 ${own ? "border-amber-300 bg-amber-50/40" : "border-slate-200"}`}>
                    <div className="relative aspect-[1/1.414] overflow-hidden rounded-md bg-slate-100">
                      <Image src={`/templates/${t.id}.jpg`} alt="" fill sizes="140px" className="object-cover object-top" />
                      <span className={`absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-bold uppercase ring-1 ${TIER_STYLE[tier]}`}>
                        {tier !== "free" ? <Crown size={9} /> : null} {planName(tier)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-xs font-medium text-ink" title={t.name}>{t.name}</p>
                    <Select
                      size="small"
                      className="!mt-1 !w-full"
                      value={own || ""}
                      onChange={(v) => setOverride(t.id, v || null)}
                      options={[{ value: "", label: `Category (${planName(categoryTier)})` }, ...tierOptions]}
                      popupMatchSelectWidth={false}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
