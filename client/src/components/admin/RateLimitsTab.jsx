"use client";

import { Alert, Button, InputNumber, Select, Skeleton, Tag, Tooltip } from "antd";
import { Gauge, RotateCcw } from "lucide-react";
import { useSettingsDraft } from "./useSettingsDraft";
import SaveBar from "./SaveBar";

const WINDOWS = [
  [30e3, "30 seconds"], [60e3, "minute"], [5 * 60e3, "5 minutes"], [15 * 60e3, "15 minutes"], [30 * 60e3, "30 minutes"],
  [60 * 60e3, "hour"], [6 * 60 * 60e3, "6 hours"], [24 * 60 * 60e3, "day"],
];
const windowLabel = (ms) => WINDOWS.find(([v]) => v === ms)?.[1] || `${Math.round(ms / 1000)} seconds`;
const SCOPE = {
  ip: { label: "per IP", color: "blue", tip: "Counted for each network (visitors behind the same Wi-Fi share it)." },
  account: { label: "per account", color: "purple", tip: "Counted for each signed-in account." },
  email: { label: "per email", color: "gold", tip: "Counted for each email address typed in." },
  site: { label: "whole site", color: "red", tip: "One count for everyone together: a ceiling on what the whole site sends, however many networks ask." },
};

/** Every rate limit in the API, grouped, with its default and the admin's override. */
export default function RateLimitsTab() {
  const { settings, meta, error, loading, update, save, saving, dirty, discard } = useSettingsDraft();
  if (loading && !settings) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error) return <Alert type="error" showIcon title={error} />;

  const limits = meta.rateLimits || [];
  const overrides = settings.rateLimits || {};
  const groups = [...new Set(limits.map((l) => l.group))];

  const set = (l, patch) =>
    update((s) => {
      const current = { max: s.rateLimits[l.name]?.max ?? l.max, windowMs: s.rateLimits[l.name]?.windowMs ?? l.windowMs, ...patch };
      // Back at the default: drop the override so future default changes apply.
      if (current.max === l.max && current.windowMs === l.windowMs) delete s.rateLimits[l.name];
      else s.rateLimits[l.name] = current;
      return s;
    });
  const reset = (l) => update((s) => (delete s.rateLimits[l.name], s));

  return (
    <div className="space-y-5 pb-20">
      <Alert
        type="info"
        showIcon
        icon={<Gauge size={16} />}
        title="Limits apply within 30 seconds on every server"
        description="Each limit counts requests in a rolling window. When someone goes over, they're asked to wait until the window ends. Lower limits are safer against abuse; raise sign-up and login limits for events where many people share one Wi-Fi network."
      />
      {groups.map((group) => (
        <section key={group} className="rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-5 py-3 font-semibold text-ink">{group}</h2>
          <ul className="divide-y divide-slate-100">
            {limits
              .filter((l) => l.group === group)
              .map((l) => {
                const o = overrides[l.name];
                const max = o?.max ?? l.max;
                const windowMs = o?.windowMs ?? l.windowMs;
                const options = WINDOWS.some(([v]) => v === windowMs) ? WINDOWS : [...WINDOWS, [windowMs, windowLabel(windowMs)]];
                return (
                  <li key={l.name} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${o ? "bg-amber-50/40" : ""}`}>
                    <div className="min-w-64 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {l.label}
                        <Tooltip title={SCOPE[l.scope]?.tip}>
                          <Tag color={SCOPE[l.scope]?.color} className="!m-0">{SCOPE[l.scope]?.label || l.scope}</Tag>
                        </Tooltip>
                        {o ? <Tag color="orange" className="!m-0">changed</Tag> : null}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">{l.description}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Default: {l.max} per {windowLabel(l.windowMs)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <InputNumber min={l.min || 1} max={100000} value={max} onChange={(v) => v && set(l, { max: v })} className="!w-24" aria-label={`${l.label} requests`} />
                      <span className="text-sm text-slate-500">per</span>
                      <Select value={windowMs} onChange={(v) => set(l, { windowMs: v })} options={options.map(([value, label]) => ({ value, label }))} className="!w-36" aria-label={`${l.label} window`} />
                      <Tooltip title="Back to the default">
                        <Button type="text" icon={<RotateCcw size={14} />} disabled={!o} onClick={() => reset(l)} aria-label="Reset to default" />
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
