"use client";

import { useState } from "react";
import { Alert, App, Button, Form, Input, InputNumber, Modal, Popconfirm, Progress, Select, Switch, Table, Tag, Tooltip } from "antd";
import { Calculator, Copy, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { campaignEstimate } from "@/lib/campaignCost";
import { FeatureSwitches, FirstSteps } from "./parts";
import { useAdmin, fmtDate, toDateInput } from "./useAdmin";

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "premium", label: "Premium" },
];

const usd = (v, digits = 2) => `$${(v || 0).toFixed(digits)}`;

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
        {left != null ? ` ${usd(left)} left under this month's AI cap.` : " The AI cap is off."} Rate limits only slow spending down; credits set the total.
      </p>
      {over ? <p className="mt-1.5 text-xs font-medium text-amber-800">The worst case is more than what&apos;s left under the cap: if it happened, AI would pause for everyone. Fewer places or credits lower it.</p> : null}
      {e.period === "day" ? <p className="mt-1.5 text-xs font-medium text-amber-800">Credits per day add up fast: {e.credits} a day is {e.credits * 30} a month per member.</p> : null}
    </div>
  );
}

// Invite codes people can't guess (no 0/O or 1/I to misread): "BETA-7KQ2XM".
const randomCode = (prefix = "BETA") => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `${prefix}-${[...bytes].map((b) => abc[b % abc.length]).join("")}`;
};
const guessable = (code) => !code || code.replace(/[^A-Za-z0-9]/g, "").length < 8;

function CampaignModal({ campaign, onClose, onSaved, call }) {
  const [form] = Form.useForm();
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
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={submit}
          initialValues={{
            name: campaign.name,
            code: campaign.code || (isNew ? randomCode() : ""),
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
            <Form.Item noStyle shouldUpdate={(a, b) => a.code !== b.code}>
              {({ getFieldValue }) => (
                <Form.Item
                  name="code"
                  label="Code"
                  rules={[{ required: true, pattern: /^[A-Za-z0-9_-]{3,32}$/, message: "3–32 letters, numbers, - or _" }]}
                  extra={guessable(getFieldValue("code")) ? <span className="text-amber-700">Short codes are easy to guess. Anyone with it can take a place.</span> : null}
                >
                  <Input
                    className="uppercase"
                    suffix={
                      <Tooltip title="Make a new random code">
                        <button type="button" className="text-slate-400 hover:text-brand" onClick={() => form.setFieldValue("code", randomCode())} aria-label="New random code">
                          <RefreshCw size={14} />
                        </button>
                      </Tooltip>
                    }
                  />
                </Form.Item>
              )}
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
/** A campaign's members, newest first, with what each has done (Admin › Sign-ups data). */
function Members({ campaign }) {
  const { data, loading } = useAdmin(`/signups?campaign=${campaign._id}&days=365&limit=100`);
  if (loading && !data) return <p className="px-2 py-3 text-sm text-slate-500">Loading members…</p>;
  const users = data?.users || [];
  return (
    <div className="px-2 py-1">
      <p className="mb-2 text-xs text-slate-500">
        {data?.total ?? 0} member{data?.total === 1 ? "" : "s"} · {users.filter((u) => u.verified).length} verified · {users.filter((u) => u.did.resumes || u.did.aiUses || u.did.applications).length} started using it
        {campaign.maxUses ? ` · ${Math.max(0, campaign.maxUses - (campaign.uses || 0))} places left` : ""}
      </p>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200 bg-white text-sm">
        {users.map((u) => (
          <li key={u._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="min-w-0">
              <span className="font-medium text-ink">{u.name}</span> <span className="text-xs text-slate-500">{u.email}</span>
              {u.verified ? null : <Tag className="!ml-2">not verified</Tag>}
            </span>
            <FirstSteps did={u.did} />
          </li>
        ))}
      </ul>
    </div>
  );
}

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
      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={data || []}
        pagination={false}
        scroll={{ x: 800 }}
        expandable={{ expandedRowRender: (c) => <Members campaign={c} />, rowExpandable: (c) => (c.stats?.members || 0) > 0 }}
      />
      <CampaignModal campaign={editing} onClose={() => setEditing(null)} onSaved={reload} call={call} />
    </div>
  );
}
