"use client";

import { Alert, Button, Progress, Skeleton, Tooltip } from "antd";
import { Users, Zap, FileText, Megaphone, CircleUserRound, SquareKanban, Wand2, Database, RotateCw } from "lucide-react";
import { useAdmin } from "./useAdmin";

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="flex items-center gap-2 text-sm text-slate-500"><Icon size={15} className="text-brand" /> {label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-ink tabular-nums">{value.toLocaleString()}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

/** Credits used per day, last 30 days: one teal series, hover a bar for its values. */
function DailyChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.credits));
  const ticks = max >= 4 ? [max, Math.round(max / 2), 0] : [max, 0];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-semibold text-ink">AI credits used per day</p>
      <p className="text-xs text-slate-500">Last 30 days</p>
      <div className="mt-4 flex gap-3">
        <div className="flex h-44 flex-col justify-between text-right text-[11px] text-slate-400 tabular-nums">
          {ticks.map((t, i) => <span key={i}>{t}</span>)}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((t, i) => <div key={i} className={`border-t ${i === ticks.length - 1 ? "border-slate-300" : "border-dashed border-slate-100"}`} />)}
          </div>
          <div className="relative flex h-44 items-end gap-[2px]">
            {days.map((d) => (
              <Tooltip key={d.date} title={<span>{new Date(d.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}: <b>{d.credits}</b> credits · {d.requests} requests</span>}>
                <div className="group flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[4px] bg-teal-600 transition-colors group-hover:bg-teal-800"
                    style={{ height: `${(d.credits / max) * 100}%`, minHeight: d.credits ? 3 : 0 }}
                  />
                </div>
              </Tooltip>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>{new Date(days[0].date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureBars({ features }) {
  const max = Math.max(1, ...features.map((f) => f.credits));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-semibold text-ink">Credits by feature</p>
      <p className="text-xs text-slate-500">Last 30 days</p>
      <ul className="mt-4 space-y-3">
        {features.map((f) => (
          <li key={f.feature}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{f.name}</span>
              <span className="text-slate-500 tabular-nums"><b className="text-ink">{f.credits}</b> credits · {f.requests} uses</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-teal-600" style={{ width: `${(f.credits / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const mb = (bytes) => (bytes == null ? "?" : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const KIND_NAMES = { resumes: "Resumes", profiles: "Career Profiles", applications: "Applications" };

/** Database storage against the plan's size, what uses it, and the biggest accounts. */
function Storage() {
  const { data, loading, error, reload, call, setData } = useAdmin("/storage");
  if (loading && !data) return <Skeleton active paragraph={{ rows: 3 }} />;
  if (error) return <Alert type="warning" showIcon title={`Storage: ${error}`} />;
  const { usage, kinds, biggest } = data;
  const pct = usage.pct ?? 0;
  const recount = async () => {
    try {
      setData((await call("/storage?fresh=1")).data);
    } catch {
      reload();
    }
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink"><Database size={15} className="text-brand" /> Storage</p>
          <p className="text-xs text-slate-500">The database, data and indexes. When it&apos;s full, saving stops working. Quota and alert level: Credits &amp; access.</p>
        </div>
        <Button size="small" icon={<RotateCw size={13} />} onClick={recount}>Recount</Button>
      </div>
      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span className="font-display text-2xl font-bold text-ink tabular-nums">{mb(usage.used)}</span>
        <span className="text-slate-500">of {mb(usage.quota)}{usage.pct != null ? ` · ${usage.pct}%` : ""}</span>
      </div>
      <Progress percent={Math.min(100, pct)} showInfo={false} strokeColor={pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#007b7b"} />
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(kinds).map(([k, v]) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="py-2 text-ink">{KIND_NAMES[k] || k} <span className="text-slate-400">({v.count.toLocaleString()})</span></td>
                <td className="py-2 text-right text-slate-500 tabular-nums">{v.photos ? `photos ${mb(v.photos)} · ` : ""}{mb(v.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <p className="text-xs font-medium text-slate-500">Biggest accounts</p>
          {biggest.length ? (
            <table className="mt-1 w-full table-fixed text-sm">
              <tbody>
                {biggest.slice(0, 5).map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="truncate py-2 text-ink" title={u.email}>{u.email || u.name}</td>
                    <td className="w-20 py-2 text-right text-slate-500 tabular-nums">{mb(u.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Nothing stored yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { data, error, loading } = useAdmin("/overview");
  if (loading && !data) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) return <Alert type="error" showIcon title={error} />;
  const { users, resumes, ai, campaigns, jobSearch } = data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Users" value={users.total} sub={`${users.new7} new this week · ${users.banned} banned`} />
        <Stat icon={Zap} label="AI credits today" value={ai.today.credits} sub={`${ai.last30.credits.toLocaleString()} in the last 30 days`} />
        <Stat icon={FileText} label="Resumes" value={resumes.total} sub={`${resumes.public} shared publicly`} />
        <Stat icon={Megaphone} label="Active campaigns" value={campaigns.active} sub={`Free ${users.byPlan.free} · Pro ${users.byPlan.pro} · Premium ${users.byPlan.premium}`} />
      </div>
      {jobSearch && (jobSearch.profiles || jobSearch.applications) ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={CircleUserRound} label="Career Profiles" value={jobSearch.profiles} sub={`${users.total ? Math.round((jobSearch.profiles / users.total) * 100) : 0}% of users`} />
          <Stat icon={SquareKanban} label="Applications tracked" value={jobSearch.applications} sub={`${jobSearch.applications7} added this week`} />
          <Stat icon={Wand2} label="Tailored resumes" value={jobSearch.tailored} sub="Made from a profile for one job" />
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <DailyChart days={ai.daily} />
        <FeatureBars features={ai.byFeature} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="font-semibold text-ink">Top AI users</p>
        <p className="text-xs text-slate-500">Credits used in the last 30 days</p>
        {ai.topUsers.length ? (
          <table className="mt-3 w-full text-sm">
            <tbody>
              {ai.topUsers.map((u) => (
                <tr key={u._id} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-ink">{u.name}</td>
                  <td className="py-2 text-slate-500">{u.email}</td>
                  <td className="py-2 text-right font-semibold text-ink tabular-nums">{u.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No AI usage yet.</p>
        )}
      </div>
      <Storage />
    </div>
  );
}
