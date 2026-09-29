"use client";

import { useState } from "react";
import { Alert, App, Button, Empty, Input, InputNumber, Segmented, Skeleton, Table, Tag, Tooltip } from "antd";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Download, Plus, Repeat, Trash2, TrendingUp, Users, Wallet } from "lucide-react";
import { useAdmin, fmtDate } from "./useAdmin";
import { useSettingsDraft } from "./useSettingsDraft";
import SaveBar from "./SaveBar";
import { useAuth } from "../AuthProvider";
import { API_URL } from "@/lib/config";

const money = (v, currency = "USD", digits) => {
  const n = Number(v) || 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: digits ?? (Math.abs(n) >= 1000 ? 0 : 2) }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const RANGES = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "12 months", value: 365 },
];
// Chart series (validated categorical palette: teal, blue, violet), in a fixed order.
const SERIES = [
  { key: "new", label: "New customers", color: "#0d9488" },
  { key: "renewal", label: "Renewals", color: "#2a78d6" },
  { key: "other", label: "Plan changes and other", color: "#4a3aa7" },
];
const TYPE_TAG = { new: ["New", "cyan"], renewal: ["Renewal", "blue"], change: ["Change", "purple"], pass: ["Pass", "gold"], other: ["Other", "default"] };

function Tile({ icon: Icon, label, value, sub, delta }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="flex items-center gap-2 text-sm text-slate-500"><Icon size={15} className="text-brand" /> {label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-ink tabular-nums">{value}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        {delta != null ? (
          <span className={`inline-flex items-center gap-0.5 font-medium ${delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {Math.abs(delta)}%
          </span>
        ) : null}
        {sub}
      </p>
    </div>
  );
}

function Card({ title, hint, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Net revenue per month for a year, stacked by where it came from; hover a month for the numbers. */
function MonthlyChart({ months, currency }) {
  const [table, setTable] = useState(false);
  const total = (m) => m.new + m.renewal + m.other;
  const max = Math.max(1, ...months.map(total));
  const label = (m) => new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" });
  return (
    <Card
      title="Revenue by month"
      hint="What reached you after Paddle's fee and tax, before refunds"
      action={<Button size="small" type="text" onClick={() => setTable((v) => !v)}>{table ? "Show chart" : "Show as table"}</Button>}
    >
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {SERIES.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}</li>
        ))}
      </ul>
      {table ? (
        <Table
          size="small"
          pagination={false}
          rowKey="month"
          dataSource={[...months].reverse()}
          columns={[
            { title: "Month", dataIndex: "month", render: (_, m) => label(m) },
            ...SERIES.map((s) => ({ title: s.label, dataIndex: s.key, align: "right", render: (v) => money(v, currency) })),
            { title: "Refunds", dataIndex: "refunds", align: "right", render: (v) => (v ? `−${money(v, currency)}` : "—") },
            { title: "Net", dataIndex: "net", align: "right", render: (v) => <b>{money(v, currency)}</b> },
          ]}
        />
      ) : (
        <div className="flex gap-3">
          <div className="flex h-48 flex-col justify-between text-right text-[11px] text-slate-400 tabular-nums">
            <span>{money(max, currency, 0)}</span>
            <span>{money(max / 2, currency, 0)}</span>
            <span>0</span>
          </div>
          <div className="relative flex-1">
            <div className="absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2].map((i) => <div key={i} className={`border-t ${i === 2 ? "border-slate-300" : "border-dashed border-slate-100"}`} />)}
            </div>
            <div className="relative flex h-48 items-end gap-1.5">
              {months.map((m) => (
                <Tooltip
                  key={m.month}
                  title={
                    <div className="text-xs">
                      <p className="font-semibold">{label(m)}</p>
                      {SERIES.map((s) => <p key={s.key}>{s.label}: {money(m[s.key], currency)}</p>)}
                      {m.refunds ? <p>Refunds: −{money(m.refunds, currency)}</p> : null}
                      <p className="mt-1 font-semibold">Net: {money(m.net, currency)}</p>
                    </div>
                  }
                >
                  <div className="flex h-full flex-1 cursor-default flex-col justify-end gap-[2px]">
                    {[...SERIES].reverse().map((s, i, arr) => {
                      const v = m[s.key];
                      if (!v) return null;
                      const top = arr.slice(0, i).every((x) => !m[x.key]);
                      return <div key={s.key} className={top ? "rounded-t-[4px]" : ""} style={{ height: `${(v / max) * 100}%`, minHeight: 3, background: s.color }} />;
                    })}
                  </div>
                </Tooltip>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
              <span>{label(months[0])}</span>
              <span>{label(months.at(-1))}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** One breakdown as bars of net revenue (a single series, so one colour). */
function Bars({ rows, currency, empty }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  const total = rows.reduce((s, r) => s + r.net, 0);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">{r.label}</span>
            <span className="shrink-0 text-slate-500 tabular-nums">
              <b className="text-ink">{money(r.net, currency)}</b> · {pct(r.net, total)}% · {r.customers} {r.customers === 1 ? "customer" : "customers"}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-teal-600" style={{ width: `${Math.max(1, (Math.abs(r.net) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const BREAKDOWNS = [
  { value: "byPlan", label: "Plan", empty: "No payments in this period." },
  { value: "bySource", label: "Upgrade prompt", empty: "No first purchases in this period." },
  { value: "byCountry", label: "Country", empty: "No payments in this period." },
  { value: "byCampaign", label: "Campaign", empty: "No payments in this period." },
  { value: "byType", label: "Kind", empty: "No payments in this period." },
];

function Funnel({ funnel, currency }) {
  // Prompts reach accounts of any age, so sign-ups are shown beside the funnel, not as its first step.
  const steps = [
    ["Saw an upgrade prompt", funnel.prompted],
    ["Opened checkout", funnel.checkout],
    ["Paid", funnel.paid],
  ];
  return (
    <>
      <p className="mb-3 text-sm text-slate-500"><b className="text-ink">{funnel.signups.toLocaleString()}</b> new sign-ups in this period.</p>
      <ol className="space-y-2">
        {steps.map(([label, n], i) => (
          <li key={label}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{label}</span>
              <span className="text-slate-500 tabular-nums">
                <b className="text-ink">{n.toLocaleString()}</b>
                {i > 0 && steps[i - 1][1] ? ` · ${pct(n, steps[i - 1][1])}% of the step before` : ""}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-teal-600" style={{ width: `${steps[0][1] ? Math.max(n ? 1 : 0, (n / Math.max(...steps.map((s) => s[1]))) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ol>
      {funnel.bySource.length ? (
        <Table
          className="mt-5"
          size="small"
          pagination={false}
          rowKey="source"
          dataSource={funnel.bySource}
          columns={[
            { title: "Upgrade prompt", dataIndex: "label" },
            { title: "Saw it", dataIndex: "prompted", align: "right" },
            { title: "Checkout", dataIndex: "checkout", align: "right" },
            { title: "Paid", dataIndex: "paid", align: "right", render: (v, r) => <span>{v}{r.prompted ? <span className="text-slate-400"> ({pct(v, r.prompted)}%)</span> : null}</span> },
            { title: "Revenue", dataIndex: "net", align: "right", render: (v) => money(v, currency) },
          ]}
        />
      ) : (
        <p className="mt-4 text-xs text-slate-400">Upgrade prompts are recorded while free mode is off and plans lock features.</p>
      )}
    </>
  );
}

function Health({ health, currency }) {
  const rows = [
    { icon: CalendarClock, label: "Renewals due in the next 30 days", value: `${health.renewals.count} · ${money(health.renewals.expected, currency)} expected` },
    { icon: AlertTriangle, label: "Cancelling at the end of their period", value: `${health.canceling.length} · ${money(health.mrrAtRisk, currency)}/month at risk`, warn: health.canceling.length > 0 },
    { icon: AlertTriangle, label: "Payment failing (Paddle is retrying)", value: String(health.pastDue.length), warn: health.pastDue.length > 0 },
    { icon: ArrowDownRight, label: "Cancelled in this period", value: `${health.churned} · ${money(health.mrrLost, currency)}/month lost` },
  ];
  const people = [...health.pastDue.map((p) => ({ ...p, why: "Payment failing", when: p.since })), ...health.canceling.map((p) => ({ ...p, why: "Cancelling", when: p.at }))];
  return (
    <>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 py-2.5 text-sm">
            <r.icon size={15} className={r.warn ? "text-amber-500" : "text-slate-400"} />
            <span className="flex-1 text-slate-700">{r.label}</span>
            <span className="text-slate-600 tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      {people.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-brand">Who ({people.length})</summary>
          <ul className="mt-2 space-y-1">
            {people.map((p, i) => (
              <li key={`${p.email}-${i}`} className="flex justify-between gap-3 text-slate-600">
                <span className="truncate">{p.email} · {p.plan || "?"}{p.interval === "year" ? " yearly" : ""}</span>
                <span className="shrink-0 text-slate-400">{p.why} · {fmtDate(p.when)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function Costs({ data }) {
  const { settings, update, save, saving, dirty, discard } = useSettingsDraft();
  const { current: c, costs, currency } = data;
  const items = settings?.fixedCosts || [];
  const lines = [
    ["Charged to customers", c.gross],
    ["Sales tax / VAT (paid by Paddle)", -c.tax],
    ["Paddle fee", -c.fees],
    ["Refunds", -c.refunds],
    ["Net revenue", c.net, true],
    [`AI (measured${costs.aiCurrency !== currency ? `, ${costs.aiCurrency}` : ""})`, -costs.ai],
    ["Fixed costs (for this period)", -costs.fixed],
    ["Profit", costs.profit, true],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ul className="space-y-1.5 text-sm">
        {lines.map(([label, v, strong]) => (
          <li key={label} className={`flex justify-between gap-3 ${strong ? "border-t border-slate-200 pt-1.5 font-semibold text-ink" : "text-slate-600"}`}>
            <span>{label}</span>
            <span className={`shrink-0 whitespace-nowrap tabular-nums ${strong && v < 0 ? "text-rose-700" : ""}`}>{v < 0 ? `−${money(-v, currency)}` : money(v, currency)}</span>
          </li>
        ))}
      </ul>
      <div>
        <p className="text-sm font-medium text-ink">Fixed costs per month</p>
        <p className="text-xs text-slate-500">Hosting, domain, email… Used for the profit figure. AI and Paddle fees are measured.</p>
        {settings ? (
          <>
            <ul className="mt-3 space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input size="small" value={it.name} maxLength={40} placeholder="e.g. Vercel Pro" onChange={(e) => update((s) => ((s.fixedCosts[i].name = e.target.value), s))} />
                  <InputNumber size="small" min={0} max={100000} step={1} value={it.amount} prefix={currency === "USD" ? "$" : undefined} className="!w-32" onChange={(v) => update((s) => ((s.fixedCosts[i].amount = Number(v) || 0), s))} />
                  <Button size="small" type="text" icon={<Trash2 size={14} />} aria-label="Remove" onClick={() => update((s) => (s.fixedCosts.splice(i, 1), s))} />
                </li>
              ))}
            </ul>
            <Button size="small" type="link" className="!mt-1 !px-0" icon={<Plus size={14} />} disabled={items.length >= 20} onClick={() => update((s) => ((s.fixedCosts = [...(s.fixedCosts || []), { name: "", amount: 0 }]), s))}>
              Add a cost
            </Button>
            <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
          </>
        ) : (
          <Skeleton active paragraph={{ rows: 2 }} />
        )}
      </div>
    </div>
  );
}

export default function RevenueTab() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const [days, setDays] = useState(30);
  const [breakdown, setBreakdown] = useState("byPlan");
  const { data, error, loading } = useAdmin(`/revenue?days=${days}`);

  const exportCsv = async () => {
    const res = await fetch(`${API_URL}/admin/revenue/payments.csv`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res?.ok) return message.error("Could not export the payments. Please try again.");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "resumex-payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const period = RANGES.find((r) => r.value === days)?.label.toLowerCase();
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Segmented options={RANGES} value={days} onChange={setDays} />
      <Button icon={<Download size={15} />} onClick={exportCsv}>Export all payments (CSV)</Button>
    </div>
  );
  if (error) return <div className="space-y-4">{head}<Alert type="error" showIcon title={error} /></div>;
  if (!data) return <div className="space-y-4">{head}<Skeleton active paragraph={{ rows: 10 }} /></div>;

  const { current, previous, mrr, currency, breakdown: b } = data;
  const delta = previous.net ? Math.round(((current.net - previous.net) / Math.abs(previous.net)) * 100) : null;
  const choice = BREAKDOWNS.find((x) => x.value === breakdown);
  const noPayments = !data.allTimeCustomers && !mrr.subscriptions;

  return (
    <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
      {head}
      {data.otherCurrencies.length ? <Alert type="info" showIcon title={`Shown in ${currency}. Payments paid out in ${data.otherCurrencies.join(", ")} aren't included here; they're in the CSV.`} /> : null}
      {noPayments ? (
        <Alert type="info" showIcon title="No payments yet" description="Once Paddle is live, every payment, renewal and refund shows up here with where it came from. The funnel below already counts upgrade prompts." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Wallet} label={`Net revenue, last ${period}`} value={money(current.net, currency)} delta={delta} sub={`${current.payments} payments${current.refunds ? ` · ${money(current.refunds, currency)} refunded` : ""}`} />
        <Tile icon={Repeat} label="Monthly recurring revenue" value={money(mrr.total, currency)} sub={`${money(mrr.arr, currency)} a year · ${mrr.subscriptions} subscriptions${mrr.unpriced ? ` (${mrr.unpriced} not yet paid)` : ""}`} />
        <Tile icon={Users} label="Paying customers" value={mrr.subscriptions.toLocaleString()} sub={`${current.newCustomers} new in this period · ${money(data.perCustomer, currency)} each`} />
        <Tile icon={TrendingUp} label="Profit" value={money(data.costs.profit, currency)} sub={`after ${money(data.costs.ai, "USD")} AI and ${money(data.costs.fixed, currency)} fixed costs`} />
      </div>

      <MonthlyChart months={data.months} currency={currency} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Where it comes from" hint={`Net revenue in the last ${period}`} action={<Segmented size="small" options={BREAKDOWNS.map(({ value, label }) => ({ value, label }))} value={breakdown} onChange={setBreakdown} />}>
          <Bars rows={b[breakdown]} currency={currency} empty={choice.empty} />
          {breakdown === "bySource" ? <p className="mt-3 text-xs text-slate-400">The prompt someone saw before their first purchase: which locks make people upgrade.</p> : null}
        </Card>
        <Card title="How people get to paying" hint={`Accounts in the last ${period}`}>
          <Funnel funnel={data.funnel} currency={currency} />
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Subscriptions" hint="Coming up and at risk">
          <Health health={data.health} currency={currency} />
          {mrr.byPlan.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {mrr.byPlan.map((p) => (
                <li key={p.plan} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  <b className="capitalize text-ink">{p.plan}</b> {p.subscriptions} · {money(p.mrr, currency)}/month
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
        <Card title="From price to profit" hint={`Last ${period}`}>
          <Costs data={data} />
        </Card>
      </div>

      <Card title="Payments" hint={`The latest in the last ${period}. Export for everything.`}>
        {data.recent.length ? (
          <Table
            size="small"
            rowKey="transactionId"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 900 }}
            dataSource={data.recent}
            columns={[
              { title: "Date", dataIndex: "at", render: fmtDate, width: 110 },
              { title: "Customer", dataIndex: "email", ellipsis: true },
              { title: "Kind", dataIndex: "type", width: 90, render: (t) => <Tag color={TYPE_TAG[t]?.[1]}>{TYPE_TAG[t]?.[0] || t}</Tag> },
              { title: "Plan", dataIndex: "plan", width: 140 },
              { title: "Country", dataIndex: "country", width: 80, render: (c) => c || "—" },
              { title: "From", dataIndex: "source", ellipsis: true, render: (s) => s || <span className="text-slate-400">—</span> },
              { title: "Charged", dataIndex: "total", align: "right", width: 100, render: (v) => money(v, currency) },
              { title: "Fee + tax", align: "right", width: 100, render: (_, r) => money(r.fee + r.tax, currency) },
              {
                title: "Net", align: "right", width: 110,
                render: (_, r) => (
                  <span className="font-medium text-ink">
                    {money(r.earnings - r.refunded, currency)}
                    {r.refunded ? <Tag color="red" className="!ml-1.5">Refunded</Tag> : null}
                  </span>
                ),
              },
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No payments in the last ${period}.`} />
        )}
      </Card>
    </div>
  );
}
