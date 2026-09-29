"use client";

import { Alert, Input, InputNumber, Radio, Skeleton, Switch, Tooltip } from "antd";
import { worstCase, worstPerCredit } from "@/lib/aiCost";
import { Gift, Lock, Zap } from "lucide-react";
import { useSettingsDraft } from "./useSettingsDraft";
import SaveBar from "./SaveBar";

/** Free mode, credit cost per AI feature and who can sign up. */
export default function CreditsTab() {
  const { settings, meta, error, loading, update, save, saving, dirty, discard } = useSettingsDraft();
  if (loading && !settings) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error) return <Alert type="error" showIcon title={error} />;

  return (
    <div className="grid gap-6 pb-20 lg:grid-cols-2">
      <section className={`rounded-2xl border p-5 ${settings.freeMode.enabled ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Gift size={19} /></span>
            <div>
              <h2 className="font-semibold text-ink">Free mode</h2>
              <p className="text-sm text-slate-600">Everyone gets every feature. Free-plan accounts get a daily credit allowance instead of the Free plan&apos;s.</p>
            </div>
          </div>
          <Switch checked={settings.freeMode.enabled} onChange={(v) => update((s) => ((s.freeMode.enabled = v), s))} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Daily credits per account</span>
            <InputNumber min={0} className="!w-full" value={settings.freeMode.dailyCredits} onChange={(v) => update((s) => ((s.freeMode.dailyCredits = v ?? 0), s))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Label on the pricing page</span>
            <Input value={settings.freeMode.label} onChange={(e) => update((s) => ((s.freeMode.label = e.target.value), s))} />
          </label>
        </div>
        {!settings.freeMode.enabled ? (
          <Alert type="warning" showIcon className="!mt-4" icon={<Lock size={16} />} title="Plans are enforced" description="Features switched off in a plan are locked for its users, and credits follow each plan's allowance." />
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-ink">Who can sign up</h2>
        <p className="text-sm text-slate-600">Super admins can always sign up.</p>
        <Radio.Group className="!mt-4 !flex !flex-col gap-2" value={settings.registration} onChange={(e) => update((s) => ((s.registration = e.target.value), s))}>
          <Radio value="open">Anyone</Radio>
          <Radio value="campaign">Only people with a campaign code</Radio>
          <Radio value="closed">Nobody (existing users can still log in)</Radio>
        </Radio.Group>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
        <h2 className="font-semibold text-ink">AI features: credits and limits</h2>
        <p className="text-sm text-slate-600">
          Credits each use takes (0 makes it free), and the most one request may send and receive. Longer typed text is refused before the AI is called, at no charge;
          stored text like job descriptions is trimmed. Thinking is the model working before it answers, billed like output. The worst case uses the dearest model price.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Feature</th>
                <th className="px-2 py-2 font-medium">Credits</th>
                <th className="px-2 py-2 font-medium">Input (characters)</th>
                <th className="px-2 py-2 font-medium">Turns / pages</th>
                <th className="px-2 py-2 font-medium">Output (tokens)</th>
                <th className="px-2 py-2 font-medium">Thinking (tokens)</th>
                <th className="py-2 pl-2 text-right font-medium">Worst case</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meta.aiFeatures.map((f) => {
                const l = settings.aiLimits?.[f.key] || {};
                const set = (k) => (v) => update((s) => ((s.aiLimits[f.key] = { ...s.aiLimits[f.key], [k]: v ?? 0 }), s));
                const extra = "turns" in l ? "turns" : "pages" in l ? "pages" : null;
                const request = worstCase(f.key, settings);
                const perCredit = worstPerCredit(f.key, settings);
                return (
                  <tr key={f.key}>
                    <td className="py-2.5 pr-3">
                      <Tooltip title={f.description}><span className="font-medium text-ink">{f.name}</span></Tooltip>
                    </td>
                    <td className="px-2 py-2.5">
                      <InputNumber size="small" min={0} max={1000} className="!w-20" prefix={<Zap size={12} className="fill-amber-400 text-amber-500" />} value={settings.featureCosts[f.key]} onChange={(v) => update((s) => ((s.featureCosts[f.key] = v ?? 0), s))} />
                    </td>
                    <td className="px-2 py-2.5"><InputNumber size="small" min={200} max={50000} step={500} className="!w-24" value={l.input} onChange={set("input")} /></td>
                    <td className="px-2 py-2.5">
                      {extra ? <InputNumber size="small" min={1} max={extra === "turns" ? 40 : 20} className="!w-20" addonAfter={extra} value={l[extra]} onChange={set(extra)} /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5"><InputNumber size="small" min={256} max={32768} step={256} className="!w-24" value={l.output} onChange={set("output")} /></td>
                    <td className="px-2 py-2.5"><InputNumber size="small" min={0} max={16384} step={256} className="!w-24" value={l.thinking} onChange={set("thinking")} /></td>
                    <td className="py-2.5 pl-2 text-right tabular-nums">
                      <span className="font-medium text-ink">${request.toFixed(4)}</span>
                      <span className="block text-xs text-slate-500">{perCredit == null ? "free to use" : `$${perCredit.toFixed(4)} a credit`}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
