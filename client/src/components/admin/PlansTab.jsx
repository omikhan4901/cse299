"use client";

import { Alert, Input, InputNumber, Select, Skeleton, Switch, Tooltip } from "antd";
import { Crown, Info } from "lucide-react";
import { useSettingsDraft } from "./useSettingsDraft";
import { useBilling } from "../BillingProvider";
import SaveBar from "./SaveBar";

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
        {label}
        {hint ? <Tooltip title={hint}><Info size={12} className="text-slate-400" /></Tooltip> : null}
      </span>
      {children}
    </label>
  );
}

/** Edit the three tiers: names, prices, credits, features and the perks shown on /pricing. */
export default function PlansTab() {
  const { settings, meta, error, loading, update, save, saving, dirty, discard } = useSettingsDraft();
  const paddleOn = !!useBilling()?.canCheckout;
  if (loading && !settings) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error) return <Alert type="error" showIcon title={error} />;
  const features = [...meta.aiFeatures, ...meta.appFeatures];
  const setPlan = (i, fn) => update((s) => (fn(s.plans[i]), s));

  return (
    <div className="pb-20">
      {settings.freeMode.enabled ? (
        <Alert
          type="info"
          showIcon
          className="!mb-5"
          title="Free mode is on"
          description="Everyone can use every feature right now. These plans are what people see on the pricing page, and what applies once you switch free mode off in Credits & access. Accounts you put on Pro or Premium already get that plan's credits."
        />
      ) : null}
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <Field label="Currency">
          <Input className="!w-24" value={settings.currency} maxLength={3} onChange={(e) => update((s) => ((s.currency = e.target.value.toUpperCase()), s))} />
        </Field>
        <Field label="Show pricing page in the menu" hint="The /pricing page always works; this adds it to the top navigation.">
          <Switch checked={settings.showPricing} onChange={(v) => update((s) => ((s.showPricing = v), s))} />
        </Field>
      </div>
      {paddleOn ? (
        <Alert
          type="info"
          showIcon
          title="Prices come from Paddle"
          description="Payments are connected, so the pricing page shows (and customers pay) the prices set in Paddle. To change a price, edit it in Paddle under Catalog › Products; the site picks it up within 10 minutes."
        />
      ) : null}
      <div className="grid gap-5 lg:grid-cols-3">
        {settings.plans.map((p, i) => (
          <div key={p.id} className={`rounded-2xl border bg-white p-5 ${p.highlight ? "border-brand ring-1 ring-brand" : "border-slate-200"}`}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Tier {i + 1} · id “{p.id}”</span>
              <Tooltip title="Highlight as “Most popular” on the pricing page">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Crown size={13} /> <Switch size="small" checked={p.highlight} onChange={(v) => update((s) => (s.plans.forEach((x, j) => (x.highlight = v && j === i)), s))} />
                </span>
              </Tooltip>
            </div>
            <div className="space-y-3">
              <Field label="Name"><Input value={p.name} onChange={(e) => setPlan(i, (x) => (x.name = e.target.value))} /></Field>
              <Field label="Tagline"><Input value={p.tagline} onChange={(e) => setPlan(i, (x) => (x.tagline = e.target.value))} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`Monthly price (${settings.currency})`}><InputNumber min={0} step={0.01} disabled={paddleOn && p.id !== "free"} className="!w-full" value={p.price} onChange={(v) => setPlan(i, (x) => (x.price = v ?? 0))} /></Field>
                <Field label={`Yearly price (${settings.currency})`} hint="0 hides the yearly option for this plan"><InputNumber min={0} step={0.01} disabled={paddleOn && p.id !== "free"} className="!w-full" value={p.yearlyPrice} onChange={(v) => setPlan(i, (x) => (x.yearlyPrice = v ?? 0))} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="AI credits"><InputNumber min={0} className="!w-full" value={p.credits} onChange={(v) => setPlan(i, (x) => (x.credits = v ?? 0))} /></Field>
                <Field label="Per">
                  <Select className="!w-full" value={p.creditPeriod} onChange={(v) => setPlan(i, (x) => (x.creditPeriod = v))} options={[{ value: "day", label: "Day" }, { value: "month", label: "Month" }]} />
                </Field>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-600">Included features</p>
                <ul className="space-y-1.5 rounded-xl bg-slate-50 p-3">
                  {features.map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-2 text-sm">
                      <Tooltip title={f.description}><span className="text-slate-700">{f.name}</span></Tooltip>
                      <Switch size="small" checked={p.features[f.key]} onChange={(v) => setPlan(i, (x) => (x.features[f.key] = v))} />
                    </li>
                  ))}
                </ul>
              </div>
              {(() => {
                // Credits only buy AI features, so point out plans where they can't be used.
                const aiOn = meta.aiFeatures.filter((f) => p.features[f.key]);
                const credits = settings.freeMode.enabled && p.id === "free" ? settings.freeMode.dailyCredits : p.credits;
                if (credits > 0 && !aiOn.length) {
                  return <Alert type="warning" showIcon title={`These ${credits} credits can't be spent`} description="No AI features are switched on for this plan. Turn some on, or set credits to 0." />;
                }
                if (credits === 0 && aiOn.length) {
                  return <Alert type="warning" showIcon title="AI features on, but no credits" description={`${aiOn.map((f) => f.name).join(", ")} will show as available but can't be used without credits.`} />;
                }
                return aiOn.length ? (
                  <p className="text-xs text-slate-500">Credits can be spent on: {aiOn.map((f) => f.name).join(", ")}.</p>
                ) : null;
              })()}
              <Field label="Perks on the pricing page" hint="One per line">
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} value={p.perks.join("\n")} onChange={(e) => setPlan(i, (x) => (x.perks = e.target.value.split("\n")))} />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
