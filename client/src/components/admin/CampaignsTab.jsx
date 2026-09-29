"use client";

import { useState } from "react";
import { Alert, App, Button, Form, Input, InputNumber, Modal, Popconfirm, Progress, Segmented, Select, Switch, Table, Tag, Tooltip } from "antd";
import { Calculator, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { campaignEstimate } from "@/lib/campaignCost";
import { useAdmin, fmtDate, toDateInput } from "./useAdmin";

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "premium", label: "Premium" },
];

const usd = (v, digits = 2) => `$${(v || 0).toFixed(digits)}`;

/** One switch per feature: follow the plan, or always on / off for members. */
function FeatureSwitches({ value = {}, onChange, features, plan, freeMode }) {
  const set = (key, v) => {
    const next = { ...value };
    if (v === "plan") delete next[key];
    else next[key] = v === "on";
    onChange?.(next);
  };
  return (
    <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
      {features.map((f) => {
        const byPlan = freeMode || !!plan?.features?.[f.key];
        const v = typeof value[f.key] === "boolean" ? (value[f.key] ? "on" : "off") : "plan";
        return (
          <div key={f.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">{f.name}</span>
            <Segmented
              size="small"
              value={v}
              onChange={(x) => set(f.key, x)}
              options={[{ value: "plan", label: `Plan (${byPlan ? "on" : "off"})` }, { value: "on", label: "On" }, { value: "off", label: "Off" }]}
            />
          </div>
        );
      })}
    </div>
  );
}

/** The worst and typical AI cost of the campaign as it's being filled in, against this month's cap. */
function Estimate({ values, settings, aiFeatures, spend }) {
  const c = { ...values, creditLimit: values.customCredits ? values.creditLimit : null, creditPeriod: values.customCredits ? values.creditPeriod : null };
  const e = campaignEstimate(c, settings, aiFeatures);
  const left = spend?.enabled ? Math.max(0, spend.cap - spend.spent) : null;
  const over = left != null && e.worst > left;
  return (
    <div className={`mb-4 rounded-xl border p-3 ${over ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-slate-50/60"}`}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink"><Calculator size={14} className="text-brand" /> What it could cost in AI</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="font-display text-xl font-bold text-ink tabular-nums">{usd(e.worst)}</p>
          <p className="text-xs text-slate-500">Worst case: all {e.places} members use every credit on the dearest feature{e.feature ? ` (${e.feature.name})` : ""}</p>
        </div>
        <div>
          <p className="font-display text-xl font-bold text-ink tabular-nums">{usd(e.typical)}</p>
          <p className="text-xs text-slate-500">Typical: about a quarter of that</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {e.credits} credits a {e.period} × up to {e.periods} {e.period === "day" ? "days" : "calendar months (credits reset on the 1st)"} × {usd(e.perCredit, 4)} a credit at most.
        {left != null ? ` ${usd(left)} left under this month's AI cap.` : " The AI cap is off."}
      </p>
      {over ? <p className="mt-1.5 text-xs font-medium text-amber-800">The worst case is more than what&apos;s left under the cap: if it happened, AI would pause for everyone. Fewer places or credits lower it.</p> : null}
      {e.period === "day" ? <p className="mt-1.5 text-xs font-medium text-amber-800">Credits per day add up fast: {e.credits} a day is {e.credits * 30} a month per member.</p> : null}
    </div>
  );
}

function CampaignModal({ campaign, onClose, onSaved, call }) {
  const meta = useAdmin(campaign ? "/settings" : null).data;
  const spend = useAdmin(campaign ? "/ai-spend" : null).data;
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const isNew = campaign && !campaign._id;
  const submit = async (v) => {
    setSaving(true);
    const body = {
      ...v,
      creditLimit: v.customCredits ? v.creditLimit : null,
      creditPeriod: v.customCredits ? v.creditPeriod : null,
      expiresAt: v.expiresAt || null,
    };
    delete body.customCredits;
    try {
      await call(isNew ? "/campaigns" : `/campaigns/${campaign._id}`, { method: isNew ? "POST" : "PATCH", body });
      message.success(isNew ? "Campaign created" : "Campaign saved");
      onSaved();
      onClose();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={!!campaign}
      onCancel={onClose}
      footer={null}
      title={isNew ? "New campaign" : `Edit ${campaign?.name}`}
      destroyOnHidden
      width={620}
      styles={{ body: { maxHeight: "min(78vh, 760px)", overflowY: "auto", overscrollBehavior: "contain" } }}
      classNames={{ body: "thin-scroll -mx-6 px-6" }}
    >
      {campaign ? (
        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={submit}
          initialValues={{
            name: campaign.name,
            code: campaign.code,
            description: campaign.description,
            plan: campaign.plan || "free",
            durationDays: campaign.durationDays ?? 30,
            maxUses: campaign.maxUses ?? 50,
            customCredits: campaign.creditLimit != null,
            creditLimit: campaign.creditLimit ?? 5,
            creditPeriod: campaign.creditPeriod || "day",
            emailDomain: campaign.emailDomain,
            expiresAt: toDateInput(campaign.expiresAt),
            active: campaign.active ?? true,
            features: campaign.features || {},
          }}
        >
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="NSU CSE Fall 2026" /></Form.Item>
            <Form.Item name="code" label="Code" rules={[{ required: true, pattern: /^[A-Za-z0-9_-]{3,32}$/, message: "3–32 letters, numbers, - or _" }]}>
              <Input placeholder="NSU2026" className="uppercase" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Message on the invite page"><Input.TextArea autoSize={{ minRows: 2 }} placeholder="Free resume tools for NSU CSE students" /></Form.Item>
          <div className="grid grid-cols-3 gap-x-3">
            <Form.Item name="plan" label="Plan"><Select options={PLAN_OPTIONS} /></Form.Item>
            <Form.Item name="durationDays" label="For (days)" tooltip="How long a paid campaign plan lasts after sign-up"><InputNumber min={1} className="!w-full" /></Form.Item>
            <Form.Item name="maxUses" label="Places"><InputNumber min={1} className="!w-full" /></Form.Item>
          </div>
          <div className="mb-4 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Custom credit allowance</span>
              <Form.Item name="customCredits" valuePropName="checked" noStyle><Switch size="small" /></Form.Item>
            </div>
            <Form.Item noStyle shouldUpdate={(a, b) => a.customCredits !== b.customCredits}>
              {({ getFieldValue }) =>
                getFieldValue("customCredits") ? (
                  <div className="mt-3 grid grid-cols-2 gap-x-3">
                    <Form.Item name="creditLimit" label="Credits" className="!mb-0"><InputNumber min={0} className="!w-full" /></Form.Item>
                    <Form.Item name="creditPeriod" label="Per" className="!mb-0"><Select options={[{ value: "day", label: "Day" }, { value: "month", label: "Month" }]} /></Form.Item>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Members get the plan&apos;s normal allowance.</p>
                )
              }
            </Form.Item>
          </div>
          {meta ? (
            <>
              <Form.Item noStyle shouldUpdate={(a, b) => a.plan !== b.plan}>
                {({ getFieldValue }) => (
                  <Form.Item name="features" label="Features for members" tooltip="Follow the plan, or turn a feature on or off for members whatever their plan says, for as long as the campaign gives.">
                    <FeatureSwitches features={[...meta.aiFeatures, ...meta.appFeatures]} plan={meta.settings.plans.find((p) => p.id === getFieldValue("plan"))} freeMode={meta.settings.freeMode.enabled} />
                  </Form.Item>
                )}
              </Form.Item>
              <Form.Item noStyle shouldUpdate>
                {({ getFieldsValue }) => <Estimate values={getFieldsValue(true)} settings={meta.settings} aiFeatures={meta.aiFeatures} spend={spend} />}
              </Form.Item>
            </>
          ) : null}
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="emailDomain" label="Email domain (optional)" tooltip="Only emails at this domain can use the code, e.g. northsouth.edu">
              <Input prefix="@" placeholder="northsouth.edu" />
            </Form.Item>
            <Form.Item name="expiresAt" label="Code expires (optional)"><Input type="date" /></Form.Item>
          </div>
          <Form.Item name="active" label="Active" valuePropName="checked"><Switch /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={saving}>{isNew ? "Create campaign" : "Save"}</Button>
        </Form>
      ) : null}
    </Modal>
  );
}

/** Sign-up campaigns: invite codes that give a plan and credits to a limited number of people. */
export default function CampaignsTab() {
  const { message } = App.useApp();
  const { data, error, loading, reload, call } = useAdmin("/campaigns");
  const [editing, setEditing] = useState(null);
  const inviteLink = (code) => `${window.location.origin}/join/${code}`;

  const columns = [
    {
      title: "Campaign",
      key: "name",
      render: (_, c) => (
        <div>
          <p className="font-medium text-ink">{c.name}</p>
          <p className="text-xs text-slate-500">
            <b className="text-slate-700">{c.code}</b>
            {c.emailDomain ? ` · @${c.emailDomain}` : ""}
          </p>
        </div>
      ),
    },
    {
      title: "Gives",
      key: "gives",
      render: (_, c) => (
        <span className="text-sm text-slate-600">
          {c.plan} {c.plan !== "free" ? `for ${c.durationDays}d` : ""}
          {c.creditLimit != null ? ` · ${c.creditLimit} credits/${c.creditPeriod || "day"}` : ""}
        </span>
      ),
    },
    {
      title: "Places used",
      key: "uses",
      render: (_, c) => (
        <div className="w-32">
          <span className="text-xs text-slate-500 tabular-nums">{c.uses} / {c.maxUses}</span>
          <Progress percent={Math.round((c.uses / c.maxUses) * 100)} showInfo={false} size="small" strokeColor="#0d9488" />
        </div>
      ),
    },
    {
      title: "Members",
      key: "members",
      render: (_, c) => (
        <span className="text-sm text-slate-600 tabular-nums">
          {c.stats?.members ?? 0}
          <span className="block text-xs text-slate-400">{c.stats?.active ?? 0} active this week</span>
        </span>
      ),
    },
    {
      title: "AI so far",
      key: "ai",
      render: (_, c) => (
        <span className="text-sm text-slate-600 tabular-nums">
          {usd(c.stats?.aiCost ?? 0)}
          <span className="block text-xs text-slate-400">{c.stats?.credits ?? 0} credits</span>
        </span>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, c) => {
        const ended = c.expiresAt && new Date(c.expiresAt) < new Date();
        return !c.active ? <Tag>paused</Tag> : ended ? <Tag color="orange">ended</Tag> : c.uses >= c.maxUses ? <Tag color="orange">full</Tag> : <Tag color="green">open</Tag>;
      },
    },
    { title: "Expires", dataIndex: "expiresAt", key: "expiresAt", render: fmtDate },
    {
      title: "",
      key: "actions",
      align: "right",
      render: (_, c) => (
        <div className="flex justify-end gap-1">
          <Tooltip title="Copy invite link">
            <Button
              size="small"
              icon={<Copy size={14} />}
              onClick={() => navigator.clipboard.writeText(inviteLink(c.code)).then(() => message.success("Invite link copied"))}
            />
          </Tooltip>
          <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(c)} />
          <Popconfirm title="Delete this campaign?" description="Members keep what they got; the code stops working." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => call(`/campaigns/${c._id}`, { method: "DELETE" }).then(reload)}>
            <Button size="small" danger icon={<Trash2 size={14} />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Share an invite link like <code className="rounded bg-slate-100 px-1.5 py-0.5">/join/NSU2026</code>. People who sign up with it get the campaign&apos;s plan and credits, until the places run out.
        </p>
        <Button type="primary" icon={<Plus size={15} />} onClick={() => setEditing({})}>New campaign</Button>
      </div>
      {error ? <Alert type="error" showIcon title={error} className="mb-4" /> : null}
      <Table rowKey="_id" loading={loading} columns={columns} dataSource={data || []} pagination={false} scroll={{ x: 800 }} />
      <CampaignModal campaign={editing} onClose={() => setEditing(null)} onSaved={reload} call={call} />
    </div>
  );
}
