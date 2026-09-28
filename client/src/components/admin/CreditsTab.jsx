"use client";

import { Alert, Input, InputNumber, Radio, Skeleton, Switch } from "antd";
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
        <h2 className="font-semibold text-ink">Credit cost per use</h2>
        <p className="text-sm text-slate-600">How many credits each AI feature takes. 0 makes it free. Failed requests are always refunded. The ATS check never costs credits.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meta.aiFeatures.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div>
                <p className="font-medium text-ink">{f.name}</p>
                <p className="text-xs text-slate-500">{f.description}</p>
              </div>
              <InputNumber
                min={0}
                max={1000}
                className="!w-24 shrink-0"
                prefix={<Zap size={13} className="fill-amber-400 text-amber-500" />}
                value={settings.featureCosts[f.key]}
                onChange={(v) => update((s) => ((s.featureCosts[f.key] = v ?? 0), s))}
              />
            </div>
          ))}
        </div>
      </section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
