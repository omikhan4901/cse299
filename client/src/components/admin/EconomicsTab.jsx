"use client";

import { useState } from "react";
import { Alert, App, Button, Input, InputNumber, Segmented, Skeleton, Switch, Table, Tooltip } from "antd";
import { Coins, Gauge, PauseCircle, Plus, ShieldCheck, Trash2, Users, Wallet } from "lucide-react";
import { SETTINGS_CHANGED } from "@/lib/api";
import { useAdmin } from "./useAdmin";
import { useSettingsDraft } from "./useSettingsDraft";
import SaveBar from "./SaveBar";

const money = (v, currency = "USD", digits = 2) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v || 0);
  } catch {
    return `${currency} ${(v || 0).toFixed(digits)}`;
  }
};
const tokens = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n || 0));

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="flex items-center gap-2 text-sm text-slate-500"><Icon size={15} className="text-brand" /> {label}</p>
      <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${tone || "text-ink"}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

/**
 * AI economics (docs/v2/SPEC.md §7): what each AI feature costs, from real token counts and
 * the prices below, against what paying users bring in. Credit allowances are set from this.
 */
export default function EconomicsTab() {
  const [days, setDays] = useState(30);
  const { data, error, loading } = useAdmin(`/economics?days=${days}`);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Real token counts from every AI request, priced with the rates below.</p>
        <Segmented value={days} onChange={setDays} options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }]} />
      </div>
      <SpendCap />
      {error ? <Alert type="error" showIcon title={error} /> : !data || loading ? <Skeleton active paragraph={{ rows: 6 }} /> : <Report data={data} />}
      <Prices />
    </div>
  );
}

const fmtDay = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * The monthly spending cap (server/lib/aiSpend.js): this month against the cap, the pace, and
 * the emergency Pause switch, which saves at once. The cap and alert level save with the button.
 */
function SpendCap() {
  const { message } = App.useApp();
  const { data, reload, call } = useAdmin("/ai-spend");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!data) return <Skeleton active paragraph={{ rows: 2 }} />;
  const cfg = edit || { enabled: data.enabled, cap: data.cap, alertAt: data.alertAt };
  const pct = data.enabled ? Math.min(100, (data.spent / data.cap) * 100) : 0;
  const tone = data.paused ? "bg-rose-500" : pct >= data.alertAt ? "bg-amber-500" : "bg-brand";

  const put = async (aiSpend, done) => {
    setBusy(true);
    try {
      await call("/settings", { method: "PUT", body: { aiSpend: { enabled: data.enabled, cap: data.cap, alertAt: data.alertAt, paused: data.paused && data.reason === "manual", ...aiSpend } } });
      window.dispatchEvent(new Event(SETTINGS_CHANGED));
      await reload();
      setEdit(null);
      message.success(done);
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`rounded-2xl border p-5 ${data.paused ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand"><ShieldCheck size={19} /></span>
          <div>
            <h2 className="font-semibold text-ink">Monthly spending cap</h2>
            <p className="text-sm text-slate-600">
              {data.paused
                ? data.reason === "manual" ? "AI is paused by an admin. Everything else works." : `The cap is reached: AI is paused for everyone but admins until ${fmtDay(data.until)}.`
                : data.enabled ? "At the cap, AI pauses for everyone but admins until the 1st. Nothing is charged for refused requests." : "Off: AI keeps running whatever it costs."}
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <PauseCircle size={16} className={data.reason === "manual" ? "text-rose-500" : "text-slate-400"} /> Pause AI now
          <Switch checked={data.reason === "manual"} loading={busy} onChange={(v) => put({ paused: v }, v ? "AI paused for everyone but admins." : "AI resumed.")} />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-600">
            <b className="font-display text-2xl text-ink tabular-nums">{money(data.spent)}</b>
            {data.enabled ? <> of {money(data.cap, "USD", 0)} this month</> : " this month"}
          </span>
          <span className="text-xs text-slate-500">
            {data.projected > 0 ? `At this pace: ${money(data.projected)} by month end` : "No AI use yet this month"}
            {data.capDay ? ` · cap reached around ${fmtDay(data.capDay)}` : ""}
          </span>
        </div>
        {data.enabled ? (
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Switch size="small" checked={cfg.enabled} onChange={(v) => setEdit({ ...cfg, enabled: v })} /> Cap on
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Cap (USD a month)</span>
          <InputNumber min={1} step={5} prefix="$" value={cfg.cap} disabled={!cfg.enabled} onChange={(v) => setEdit({ ...cfg, cap: v ?? 1 })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Email me at</span>
          <InputNumber min={0} max={99} suffix="%" value={cfg.alertAt} disabled={!cfg.enabled} onChange={(v) => setEdit({ ...cfg, alertAt: v ?? 0 })} />
        </label>
        {edit ? (
          <span className="flex gap-2">
            <Button onClick={() => setEdit(null)}>Discard</Button>
            <Button type="primary" loading={busy} onClick={() => put(cfg, "Spending cap saved.")}>Save</Button>
          </span>
        ) : null}
        <p className="w-full text-xs text-slate-400">Costs come from real token counts and the model prices below: keep them current. Changes reach every server within 30 seconds.</p>
      </div>
    </section>
  );
}

function Report({ data }) {
  const r = data.revenue;
  const ratio = r.costRatio;
  const ratioTone = ratio == null ? "text-slate-400" : ratio < 0.2 ? "text-emerald-600" : ratio < 0.4 ? "text-amber-600" : "text-red-600";
  return (
    <>
      {data.unpricedModels.length ? (
        <Alert type="warning" showIcon title="Some models have no price of their own" description={`${data.unpricedModels.join(", ")} ${data.unpricedModels.length === 1 ? "is" : "are"} priced with “default”. Add ${data.unpricedModels.length === 1 ? "it" : "them"} below for accurate costs.`} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Coins} label="AI cost" value={money(data.totals.cost)} sub={`${data.totals.calls.toLocaleString()} requests${data.totals.failed ? ` · ${data.totals.failed} failed` : ""}`} />
        <Stat icon={Users} label="Paying users" value={r.payingUsers.toLocaleString()} sub={`${money(r.net, r.currency)} net revenue`} />
        <Stat icon={Wallet} label="Per paying user" value={money(r.perPayingUser, r.currency)} sub={`AI cost ${money(r.aiCostPerPayingUser, "USD", 3)}`} />
        <Stat
          icon={Gauge}
          label="AI cost ratio"
          value={ratio == null ? "—" : `${(ratio * 100).toFixed(1)}%`}
          sub={ratio == null ? "No revenue in this period" : "Of paying users' net revenue. Aim for under 20%."}
          tone={ratioTone}
        />
      </div>
      {r.otherCurrencies.length ? <p className="text-xs text-slate-500">Revenue shown in {r.currency}; payments in {r.otherCurrencies.join(", ")} aren&apos;t included.</p> : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <Table
          size="small"
          rowKey="key"
          pagination={false}
          dataSource={data.features}
          columns={[
            { title: "Feature", dataIndex: "name" },
            { title: "Requests", dataIndex: "calls", align: "right", render: (v, f) => <span className="tabular-nums">{v.toLocaleString()}{f.failed ? <span className="text-slate-400"> +{f.failed} failed</span> : null}</span> },
            { title: "Tokens in / out", align: "right", render: (_, f) => <span className="tabular-nums text-slate-600">{tokens(f.inputTokens)} / {tokens(f.outputTokens)}</span> },
            { title: "Cost", dataIndex: "cost", align: "right", render: (v) => <span className="tabular-nums">{money(v, "USD", 3)}</span> },
            {
              title: <Tooltip title="Average cost of one request, failed ones included">Per request</Tooltip>,
              dataIndex: "costPerCall",
              align: "right",
              render: (v, f) => (
                <Tooltip title={f.credits ? `${money(v * (f.calls + f.failed) / f.credits, "USD", 4)} per credit charged` : null}>
                  <span className="tabular-nums">{money(v, "USD", 4)}</span>
                </Tooltip>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}

/** Prices per million tokens, by model name (prefixes match, "default" covers the rest). */
function Prices() {
  const { settings, update, save, saving, dirty, discard, loading } = useSettingsDraft();
  const [name, setName] = useState("");
  if (loading && !settings) return null;
  const prices = settings?.aiPrices || {};
  const set = (model, patch) => update((s) => ((s.aiPrices = { ...s.aiPrices, [model]: { ...s.aiPrices[model], ...patch } }), s));
  const remove = (model) => update((s) => ((s.aiPrices = Object.fromEntries(Object.entries(s.aiPrices).filter(([k]) => k !== model))), s));
  const add = () => {
    const m = name.trim();
    if (!/^[A-Za-z0-9._-]{1,60}$/.test(m) || prices[m]) return;
    set(m, { input: prices.default?.input ?? 0, output: prices.default?.output ?? 0 });
    setName("");
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-semibold text-ink">Model prices</p>
      <p className="mt-1 text-sm text-slate-500">US dollars per million tokens, from Google&apos;s price list. A name matches models that start with it (e.g. “gemini-2.5-flash” covers “gemini-2.5-flash-001”).</p>
      <ul className="mt-4 divide-y divide-slate-100">
        {Object.entries(prices).map(([model, p]) => (
          <li key={model} className="flex flex-wrap items-center gap-3 py-2">
            <span className="min-w-40 flex-1 font-mono text-sm text-ink">{model}</span>
            <span className="text-xs text-slate-500">Input</span>
            <InputNumber size="small" min={0} max={1000} step={0.01} prefix="$" value={p.input} onChange={(v) => set(model, { input: v ?? 0 })} className="!w-28" />
            <span className="text-xs text-slate-500">Output</span>
            <InputNumber size="small" min={0} max={1000} step={0.01} prefix="$" value={p.output} onChange={(v) => set(model, { output: v ?? 0 })} className="!w-28" />
            {model === "default" ? <span className="w-6" /> : <Button size="small" type="text" aria-label={`Remove ${model}`} icon={<Trash2 size={14} />} onClick={() => remove(model)} />}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input size="small" placeholder="Model name, e.g. gemini-2.5-flash" value={name} onChange={(e) => setName(e.target.value)} onPressEnter={add} className="!max-w-xs" />
        <Button size="small" icon={<Plus size={14} />} onClick={add} disabled={!name.trim()}>Add</Button>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
