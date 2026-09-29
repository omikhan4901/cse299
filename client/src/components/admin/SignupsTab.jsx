"use client";

import { useState } from "react";
import { Alert, Input, Segmented, Select, Skeleton, Table, Tag, Tooltip } from "antd";
import { BadgeCheck, Network } from "lucide-react";
import { useAdmin, fmtDate } from "./useAdmin";
import { UserDrawer } from "./UsersTab";
import { FirstSteps } from "./parts";

const SOURCES = { organic: { label: "Organic", color: "default" }, campaign: { label: "Campaign", color: "cyan" }, admin: { label: "Added by admin", color: "purple" } };
const PLAN_COLOR = { free: "default", pro: "cyan", premium: "gold" };
const short = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Sign-ups per day in the range: one series, hover a bar for the split by source. */
function PerDay({ daily }) {
  const total = (d) => d.organic + d.campaign + d.admin;
  const max = Math.max(1, ...daily.map(total));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-semibold text-ink">Sign-ups per day</p>
      <div className="mt-4 flex gap-3">
        <div className="flex h-28 flex-col justify-between text-right text-[11px] text-slate-400 tabular-nums">
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-dashed border-slate-100" />
            <div className="border-t border-slate-300" />
          </div>
          <div className="relative flex h-28 items-end gap-[2px]">
            {daily.map((d) => (
              <Tooltip
                key={d.day}
                title={
                  <span>
                    {short(d.day)}: <b>{total(d)}</b>
                    {total(d) ? ` · organic ${d.organic} · campaign ${d.campaign} · admin ${d.admin}` : ""}
                  </span>
                }
              >
                <div className="group flex h-full flex-1 items-end">
                  <div className="w-full rounded-t-[4px] bg-teal-600 transition-colors group-hover:bg-teal-800" style={{ height: `${(total(d) / max) * 100}%`, minHeight: total(d) ? 3 : 0 }} />
                </div>
              </Tooltip>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>{daily.length ? short(daily[0].day) : ""}</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

/** Newest accounts, how they came in and what they did first (docs/v2/BETA-PLAN.md, Phase 3). */
export default function SignupsTab({ isSuper }) {
  const [days, setDays] = useState(30);
  const [source, setSource] = useState("");
  const [verified, setVerified] = useState("");
  const [ref, setRef] = useState("");
  const [campaign, setCampaign] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const params = new URLSearchParams({ days: String(days), page: String(page), limit: "25", ...(source && { source }), ...(verified && { verified }), ...(ref && { ref }), ...(campaign && { campaign }), ...(q && { q }) });
  const { data, loading, error, reload } = useAdmin(`/signups?${params}`);
  const campaigns = useAdmin("/campaigns").data || [];
  const reset = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  if (error) return <Alert type="error" showIcon title={error} />;
  if (!data) return <Skeleton active paragraph={{ rows: 8 }} />;
  const today = data.daily.at(-1);
  const todayCount = today ? today.organic + today.campaign + today.admin : 0;
  const left = data.cap != null ? Math.max(0, data.cap - data.accounts) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label={`Sign-ups, last ${days} days`} value={data.total} sub={`${todayCount} today`} />
        <Figure label="Organic" value={data.bySource.organic} sub="Signed up on their own" />
        <Figure label="Campaign" value={data.bySource.campaign} sub={`${data.bySource.admin} added by an admin`} />
        <Figure label="Accounts" value={data.accounts} sub={left != null ? `${left} places left before sign-ups close` : "No sign-up cap"} />
      </div>
      <PerDay daily={data.daily} />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={days} onChange={reset(setDays)} options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }, { value: 365, label: "Year" }]} />
        <Select className="w-40" value={source} onChange={reset(setSource)} options={[{ value: "", label: "Every source" }, ...Object.entries(SOURCES).map(([value, s]) => ({ value, label: s.label }))]} />
        <Select className="w-44" value={campaign} onChange={reset(setCampaign)} options={[{ value: "", label: "Every campaign" }, ...campaigns.map((c) => ({ value: c._id, label: c.code }))]} />
        <Select className="w-36" value={verified} onChange={reset(setVerified)} options={[{ value: "", label: "Verified or not" }, { value: "yes", label: "Verified" }, { value: "no", label: "Not verified" }]} />
        <Input.Search className="!w-56" allowClear placeholder="Name or email" onSearch={reset(setQ)} />
        {ref ? <Tag closable onClose={() => reset(setRef)("")} color="blue">link: {ref}</Tag> : null}
      </div>

      <Table
        rowKey="_id"
        size="middle"
        loading={loading}
        dataSource={data.users}
        onRow={(u) => ({ onClick: () => setSelected(u._id), className: "cursor-pointer" })}
        pagination={{ current: page, pageSize: data.limit, total: data.total, showSizeChanger: false, onChange: setPage }}
        scroll={{ x: 900 }}
        columns={[
          { title: "Joined", dataIndex: "createdAt", width: 120, render: (d) => <Tooltip title={new Date(d).toLocaleString()}>{fmtDate(d)}</Tooltip> },
          {
            title: "Person",
            render: (_, u) => (
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-medium text-ink">
                  {u.name}
                  {u.verified ? <Tooltip title="Email verified"><BadgeCheck size={14} className="text-brand" /></Tooltip> : null}
                  {u.banned ? <Tag color="red" className="!ml-1">banned</Tag> : null}
                </p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
            ),
          },
          {
            title: "Came from",
            width: 200,
            render: (_, u) => (
              <span className="flex flex-wrap items-center gap-1">
                <Tag color={SOURCES[u.source]?.color}>{u.source === "campaign" && u.campaign ? u.campaign.code : SOURCES[u.source]?.label}</Tag>
                {u.ref ? (
                  <Tag
                    color="blue"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      reset(setRef)(u.ref);
                    }}
                  >
                    {u.ref}
                  </Tag>
                ) : null}
                {u.sameNetwork ? (
                  <Tooltip title={`${u.sameNetwork} other account${u.sameNetwork === 1 ? "" : "s"} signed up from the same network (a campus or home network, or one person making several).`}>
                    <Tag icon={<Network size={11} className="mr-1 inline" />} color={u.sameNetwork >= 5 ? "orange" : "default"}>+{u.sameNetwork}</Tag>
                  </Tooltip>
                ) : null}
              </span>
            ),
          },
          { title: "Plan", dataIndex: "plan", width: 100, render: (p) => <Tag color={PLAN_COLOR[p]}>{p}</Tag> },
          { title: "First steps", render: (_, u) => <FirstSteps did={u.did} /> },
          { title: "Last seen", dataIndex: "lastLoginAt", width: 120, render: (d) => (d ? fmtDate(d) : "Never") },
        ]}
      />
      <UserDrawer id={selected} onClose={() => setSelected(null)} onChanged={reload} isSuper={isSuper} />
    </div>
  );
}
