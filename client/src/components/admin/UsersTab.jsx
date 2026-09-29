"use client";

import { useState } from "react";
import { App, Alert, Button, Collapse, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Progress, Select, Switch, Table, Tag } from "antd";
import { BadgeCheck, Ban, CircleUserRound, Clock, Crown, Download, FileText, KeyRound, RotateCcw, Search, ShieldCheck, ShieldOff, SquareKanban, Trash2, UserPlus, Wallet, Zap } from "lucide-react";
import { API_URL } from "@/lib/config";
import { useAuth } from "../AuthProvider";
import { useAdmin, fmtDate, toDateInput } from "./useAdmin";
import { FeatureSwitches } from "./parts";

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "premium", label: "Premium" },
];
const PLAN_COLOR = { free: "default", pro: "cyan", premium: "gold" };
const periodLabel = (p) => (p === "month" ? "/ month" : "/ day");

function Credits({ c }) {
  const pct = c.limit ? Math.min(100, Math.round((c.used / c.limit) * 100)) : 100;
  return (
    <div className="w-36">
      <div className="flex justify-between text-xs text-slate-500">
        <span className="tabular-nums"><b className="text-ink">{c.used}</b> / {c.limit} {periodLabel(c.period)}</span>
        {c.source === "custom" ? <span className="text-amber-600">custom</span> : null}
      </div>
      <Progress percent={pct} showInfo={false} size="small" strokeColor={pct >= 100 ? "#dc2626" : "#0d9488"} />
    </div>
  );
}

/** Edit drawer for one user: plan, credits, role, ban, password, delete. */
/** Whether the latest payment can be refunded under the refund policy (/refunds), and why not. */
function RefundCheck({ r }) {
  const date = (d) => (d ? new Date(d).toLocaleDateString() : "—");
  return (
    <div className={`rounded-xl border p-4 ${r.eligible ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-ink">Refund check</p>
        <Tag color={r.eligible ? "green" : "orange"} className="!m-0">{r.eligible ? "Qualifies" : "Doesn't qualify"}</Tag>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        First paid {date(r.firstPaidAt)} · latest payment {date(r.lastPaidAt)} · since then: {r.paidDownloads} paid-template PDF{r.paidDownloads === 1 ? "" : "s"}, {r.aiCredits} AI credits
        {r.refunds ? ` · ${r.refunds} earlier refund${r.refunds > 1 ? "s" : ""}` : ""}
        {r.chargebacks ? ` · ${r.chargebacks} chargeback${r.chargebacks > 1 ? "s" : ""}` : ""}
      </p>
      {r.reasons.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
          {r.reasons.map((x) => <li key={x}>{x}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-emerald-800">Within the refund policy. Refund from the Paddle dashboard; the plan ends automatically.</p>
      )}
    </div>
  );
}

const KIND_ICON = { signup: UserPlus, verified: BadgeCheck, resume: FileText, profile: CircleUserRound, application: SquareKanban, ai: Zap, billing: Crown, payment: Wallet, admin: ShieldCheck };
const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Everything that happened to the account, newest first, with its AI cost and storage. */
function Timeline({ t }) {
  const [all, setAll] = useState(false);
  const shown = all ? t.entries : t.entries.slice(0, 12);
  return (
    <div>
      <p className="font-medium text-ink">Timeline</p>
      <p className="mb-2 text-xs text-slate-500">
        AI {t.totals.aiUses}× · {t.totals.aiCredits} credits · ${t.totals.aiCost.toFixed(3)} real cost · stores {kb(t.totals.storage)}
        {t.totals.sameNetwork ? ` · ${t.totals.sameNetwork} other account${t.totals.sameNetwork === 1 ? "" : "s"} from the same network` : ""}
      </p>
      <ul className="max-h-96 overflow-auto rounded-xl border border-slate-200 text-sm">
        {shown.map((e, i) => {
          const Icon = KIND_ICON[e.kind] || Clock;
          return (
            <li key={i} className="flex items-start gap-2.5 border-t border-slate-100 px-3 py-2 first:border-t-0">
              <Icon size={14} className="mt-0.5 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 text-slate-700">
                {e.text}
                {e.kind === "ai" ? <span className="text-slate-400"> · {e.credits} cr · ${e.cost.toFixed(4)}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-slate-400 tabular-nums">{new Date(e.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          );
        })}
      </ul>
      {!all && t.entries.length > 12 ? (
        <Button type="link" size="small" className="!px-0" onClick={() => setAll(true)}>Show all {t.entries.length}</Button>
      ) : null}
    </div>
  );
}

const hasKeys = (o) => !!o && Object.keys(o).length > 0;

/**
 * The account's own switches, limits and tester flag (collapsed unless it has some): features
 * on or off whatever the plan (an "off" holds even in free mode), until an optional end date;
 * limits that replace the plan's; test payments.
 */
function AccessOverrides({ u, meta, form }) {
  const settings = meta.settings;
  const plan = settings.plans.find((p) => p.id === u.effectivePlan) || settings.plans[0];
  const v2On = !!settings.v2?.enabled;
  const features = [...meta.aiFeatures, ...meta.appFeatures].filter((f) => !f.v2 || v2On || u.v2Preview);
  const limits = (meta.planLimits || []).filter((l) => !l.v2 || v2On || u.v2Preview);
  const ended = u.featuresExpireAt && new Date(u.featuresExpireAt) < new Date();
  const custom = hasKeys(u.features) || hasKeys(u.limits) || u.tester;
  const aiOff = () => form.setFieldValue("features", { ...(form.getFieldValue("features") || {}), ...Object.fromEntries(meta.aiFeatures.map((f) => [f.key, false])) });
  return (
    <Collapse
      className="!mt-4 !bg-white"
      defaultActiveKey={custom ? ["access"] : []}
      items={[
        {
          key: "access",
          label: (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">Access for this account</span>
              {custom ? <Tag color="blue">custom</Tag> : <span className="text-xs text-slate-500">follows the {plan.name} plan</span>}
              {ended && hasKeys(u.features) ? <Tag>switches ended</Tag> : null}
            </span>
          ),
          children: (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">Features</p>
                  <Button size="small" onClick={aiOff}>Turn all AI off</Button>
                </div>
                <Form.Item name="features" noStyle>
                  <FeatureSwitches features={features} plan={plan} freeMode={settings.freeMode.enabled} />
                </Form.Item>
                <Form.Item name="featuresExpireAt" label="Switches end" className="!mt-3 !mb-0" extra={ended ? `Ended ${fmtDate(u.featuresExpireAt)}: the plan rules again. Pick a new date or clear it to turn them back on.` : "Leave empty for no end date. Campaign members get the campaign's end date."}>
                  <Input type="date" />
                </Form.Item>
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Limits</p>
                <p className="mb-2 text-xs text-slate-500">Empty follows the plan. A number here replaces it, even in free mode; nothing already made is removed.</p>
                <div className="grid grid-cols-2 gap-x-3">
                  {limits.map((l) => {
                    const byPlan = plan.limits?.[l.key];
                    return (
                      <Form.Item key={l.key} name={["limits", l.key]} label={l.name} className="!mb-2">
                        <InputNumber min={0} max={10000} precision={0} className="!w-full" placeholder={`Plan: ${settings.freeMode.enabled || byPlan == null ? "no limit" : byPlan}`} />
                      </Form.Item>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">Tester</p>
                  <p className="text-xs text-slate-500">Can use checkout while payments are in test mode.</p>
                </div>
                <Form.Item name="tester" valuePropName="checked" noStyle><Switch /></Form.Item>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}

export function UserDrawer({ id, onClose, onChanged, isSuper }) {
  const { message, modal } = App.useApp();
  const { data, loading, call, setData } = useAdmin(id ? `/users/${id}` : null);
  const meta = useAdmin(id ? "/settings" : null).data;
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const save = async (patch) => {
    setSaving(true);
    try {
      const d = await call(`/users/${id}`, { method: "PATCH", body: patch });
      setData({ ...data, ...d.data });
      onChanged();
      message.success("Saved");
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const action = async (fn, done) => {
    try {
      await fn();
      message.success(done);
      onChanged();
    } catch (err) {
      message.error(err.message);
    }
  };

  const u = data;
  return (
    <Drawer open={!!id} onClose={onClose} size={560} title={u ? u.name : "User"} destroyOnHidden>
      {loading && !u ? null : u ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{u.email}</span>
            <Tag color={PLAN_COLOR[u.effectivePlan]}>{u.effectivePlan}</Tag>
            {u.role !== "user" ? <Tag color="purple">{u.role}</Tag> : null}
            {u.banned ? <Tag color="red">banned</Tag> : null}
            {u.twoFactor?.enabled ? <Tag color="green">2FA on</Tag> : <Tag>2FA off</Tag>}
          </div>
          <p className="text-xs text-slate-500">
            Joined {fmtDate(u.createdAt)} · last login {fmtDate(u.lastLoginAt)} · {u.resumes} resume{u.resumes === 1 ? "" : "s"}
            {u.campaign ? <> · campaign <b>{u.campaign.code}</b></> : null}
          </p>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{
              name: u.name,
              email: u.email,
              plan: u.plan || "free",
              planExpiresAt: toDateInput(u.planExpiresAt),
              customCredits: u.credits.source === "custom",
              creditLimit: u.creditLimit ?? u.credits.limit,
              creditPeriod: u.creditPeriod || u.credits.period,
              role: u.role === "admin" ? "admin" : "user",
              v2Preview: !!u.v2Preview,
              features: u.features || {},
              featuresExpireAt: toDateInput(u.featuresExpireAt),
              limits: u.limits || {},
              tester: !!u.tester,
            }}
            onFinish={(v) =>
              save({
                name: v.name,
                email: v.email,
                plan: v.plan,
                planExpiresAt: v.planExpiresAt || null,
                creditLimit: v.customCredits ? v.creditLimit : null,
                creditPeriod: v.customCredits ? v.creditPeriod : null,
                v2Preview: !!v.v2Preview,
                features: v.features || {},
                featuresExpireAt: v.featuresExpireAt || null,
                limits: v.limits || {},
                tester: !!v.tester,
                ...(isSuper && u.role !== "superadmin" ? { role: v.role } : {}),
              })
            }
          >
            <div className="grid grid-cols-2 gap-x-3">
              <Form.Item name="name" label="Name"><Input /></Form.Item>
              <Form.Item name="email" label="Email"><Input /></Form.Item>
              <Form.Item name="plan" label="Plan"><Select options={PLAN_OPTIONS} /></Form.Item>
              <Form.Item name="planExpiresAt" label="Plan ends" extra="Leave empty for no end date"><Input type="date" /></Form.Item>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">Custom credit allowance</p>
                  <p className="text-xs text-slate-500">Overrides the plan (and free mode) for this user.</p>
                </div>
                <Form.Item name="customCredits" valuePropName="checked" noStyle><Switch /></Form.Item>
              </div>
              <Form.Item noStyle shouldUpdate={(a, b) => a.customCredits !== b.customCredits}>
                {({ getFieldValue }) =>
                  getFieldValue("customCredits") ? (
                    <div className="grid grid-cols-2 gap-x-3">
                      <Form.Item name="creditLimit" label="Credits" className="!mb-0"><InputNumber min={0} className="!w-full" /></Form.Item>
                      <Form.Item name="creditPeriod" label="Per" className="!mb-0"><Select options={[{ value: "day", label: "Day" }, { value: "month", label: "Month" }]} /></Form.Item>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Using {u.credits.limit} credits {periodLabel(u.credits.period)} ({u.credits.source === "freeMode" ? "free mode" : "plan"}).</p>
                  )
                }
              </Form.Item>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <p className="font-medium text-ink">V2 preview</p>
                <p className="text-xs text-slate-500">Career Profile and applications before they open to everyone. Admins always see them.</p>
              </div>
              <Form.Item name="v2Preview" valuePropName="checked" noStyle><Switch /></Form.Item>
            </div>
            {meta?.settings ? <AccessOverrides u={u} meta={meta} form={form} /> : null}
            {isSuper && u.role !== "superadmin" ? (
              <Form.Item name="role" label="Role" className="!mt-4" extra="Admins can open this console. Only super admins change roles.">
                <Select options={[{ value: "user", label: "User" }, { value: "admin", label: "Admin" }]} />
              </Form.Item>
            ) : null}
            <Button type="primary" htmlType="submit" loading={saving} className="!mt-4">Save changes</Button>
          </Form>

          {u.refundCheck ? <RefundCheck r={u.refundCheck} /> : null}

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="font-medium text-ink">{u.credits.period === "day" ? "Today's credits" : "This month's credits"}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <Credits c={u.credits} />
              <Button icon={<RotateCcw size={14} />} onClick={() => action(() => call(`/users/${id}/reset-credits`, { method: "POST" }).then((d) => setData({ ...u, ...d.data })), "Credits restored")}>
                Restore full allowance
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              icon={<KeyRound size={14} />}
              onClick={() => {
                let pw = "";
                modal.confirm({
                  title: `Set a new password for ${u.name}`,
                  content: <Input.Password placeholder="At least 8 characters" onChange={(e) => (pw = e.target.value)} className="!mt-2" />,
                  okText: "Set password",
                  onOk: () => {
                    if (pw.length < 8) {
                      message.error("The password needs at least 8 characters.");
                      return Promise.reject(new Error("too short")); // keeps the dialog open
                    }
                    return save({ password: pw });
                  },
                });
              }}
            >
              Set password
            </Button>
            {u.role !== "superadmin" ? (
              u.banned ? (
                <Button onClick={() => save({ banned: false })}>Lift ban</Button>
              ) : (
                <Button
                  danger
                  icon={<Ban size={14} />}
                  onClick={() => {
                    let reason = "";
                    modal.confirm({
                      title: `Ban ${u.name}?`,
                      content: (
                        <>
                          <p className="mb-2 text-sm text-slate-600">They&apos;ll be signed out and can&apos;t log in. Their data is kept.</p>
                          <Input placeholder="Reason (shown to them)" onChange={(e) => (reason = e.target.value)} />
                        </>
                      ),
                      okText: "Ban",
                      okButtonProps: { danger: true },
                      onOk: () => save({ banned: true, bannedReason: reason }),
                    });
                  }}
                >
                  Ban user
                </Button>
              )
            ) : null}
          </div>
          {u.banned ? <Alert type="error" showIcon title={`Banned${u.bannedReason ? `: ${u.bannedReason}` : ""}`} /> : null}
          {isSuper && u.twoFactor?.enabled && u.role !== "superadmin" ? (
            <Popconfirm
              title="Reset two-factor authentication?"
              description="Use this only if they've lost their phone and recovery codes. They'll be signed out."
              okText="Reset"
              okButtonProps={{ danger: true }}
              onConfirm={() => action(() => call(`/users/${id}/reset-2fa`, { method: "POST" }).then((d) => setData({ ...u, ...d.data })), "Two-factor authentication reset")}
            >
              <Button icon={<ShieldOff size={14} />}>Reset two-factor authentication</Button>
            </Popconfirm>
          ) : null}

          <div>
            <p className="mb-2 font-medium text-ink">Resumes</p>
            {u.resumesList.length ? (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                {u.resumesList.map((r) => (
                  <li key={r._id} className="flex items-center justify-between px-3 py-2">
                    <span className="font-medium text-ink">{r.nickname}</span>
                    <span className="text-xs text-slate-500">
                      {r.template} · {fmtDate(r.updatedAt)}
                      {r.isPublic ? <> · <a href={`/view/${r.shortId || r._id}`} target="_blank" rel="noreferrer" className="text-brand">public</a></> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">No resumes.</p>}
          </div>

          {u.timeline ? <Timeline t={u.timeline} /> : null}

          {u.role !== "superadmin" ? (
            <Popconfirm
              title="Delete this account?"
              description="Their resumes and share links are deleted too. This can't be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => action(() => call(`/users/${id}`, { method: "DELETE" }).then(onClose), "Account deleted")}
            >
              <Button danger type="text" icon={<Trash2 size={14} />}>Delete account</Button>
            </Popconfirm>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

function AddUserModal({ open, onClose, onCreated }) {
  const { message } = App.useApp();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const { call } = useAdmin(null);
  const submit = async (v) => {
    setLoading(true);
    try {
      await call("/users", { method: "POST", body: { ...v, creditLimit: v.creditLimit ?? null, planExpiresAt: v.planExpiresAt || null } });
      message.success(`Created ${v.email}`);
      onCreated();
      onClose();
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Add a user" destroyOnHidden>
      {token ? (
        <Form layout="vertical" requiredMark={false} onFinish={submit} initialValues={{ plan: "free" }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item>
          <Form.Item name="password" label="Temporary password" rules={[{ required: true, min: 8 }]} extra="Share it with them; they can change it in Account settings."><Input.Password /></Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="plan" label="Plan"><Select options={PLAN_OPTIONS} /></Form.Item>
            <Form.Item name="planExpiresAt" label="Plan ends"><Input type="date" /></Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={loading} block>Create account</Button>
        </Form>
      ) : null}
    </Modal>
  );
}

export default function UsersTab({ isSuper }) {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [query, setQuery] = useState({ q: "", plan: "", status: "", page: 1 });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const params = new URLSearchParams({ q: query.q, plan: query.plan, status: query.status, page: String(query.page), limit: "20" });
  const { data, loading, error, reload } = useAdmin(`/users?${params}`);

  const exportCsv = async () => {
    const res = await fetch(`${API_URL}/admin/users/export.csv`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res?.ok) return message.error("Could not export the users. Please try again.");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "resumex-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: "User",
      key: "user",
      render: (_, u) => (
        <div>
          <p className="font-medium text-ink">{u.name}</p>
          <p className="text-xs text-slate-500">{u.email}</p>
        </div>
      ),
    },
    {
      title: "Plan",
      key: "plan",
      render: (_, u) => (
        <div className="flex flex-wrap gap-1">
          <Tag color={PLAN_COLOR[u.effectivePlan]}>{u.effectivePlan}</Tag>
          {u.role !== "user" ? <Tag color="purple">{u.role}</Tag> : null}
          {u.banned ? <Tag color="red">banned</Tag> : null}
        </div>
      ),
    },
    { title: "Credits", key: "credits", render: (_, u) => <Credits c={u.credits} /> },
    { title: "Resumes", dataIndex: "resumes", key: "resumes", align: "right" },
    { title: "Joined", dataIndex: "createdAt", key: "createdAt", render: fmtDate },
    { title: "Last login", dataIndex: "lastLoginAt", key: "lastLoginAt", render: fmtDate },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          allowClear
          prefix={<Search size={15} className="text-slate-400" />}
          placeholder="Search name or email"
          className="!w-64"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!e.target.value) setQuery((q) => ({ ...q, q: "", page: 1 }));
          }}
          onPressEnter={() => setQuery((q) => ({ ...q, q: search, page: 1 }))}
        />
        <Select className="!w-36" value={query.plan} onChange={(plan) => setQuery((q) => ({ ...q, plan, page: 1 }))} options={[{ value: "", label: "All plans" }, ...PLAN_OPTIONS]} />
        <Select
          className="!w-36"
          value={query.status}
          onChange={(status) => setQuery((q) => ({ ...q, status, page: 1 }))}
          options={[{ value: "", label: "Everyone" }, { value: "active", label: "Active" }, { value: "banned", label: "Banned" }, { value: "admin", label: "Admins" }]}
        />
        <div className="flex-1" />
        <Button icon={<Download size={15} />} onClick={exportCsv}>Export CSV</Button>
        <Button type="primary" icon={<UserPlus size={15} />} onClick={() => setAdding(true)}>Add user</Button>
      </div>
      {error ? <Alert type="error" showIcon title={error} className="mb-4" /> : null}
      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={data?.users || []}
        onRow={(u) => ({ onClick: () => setSelected(u._id), className: "cursor-pointer" })}
        pagination={{ current: query.page, pageSize: 20, total: data?.total || 0, showSizeChanger: false, onChange: (page) => setQuery((q) => ({ ...q, page })) }}
        scroll={{ x: 800 }}
      />
      <UserDrawer id={selected} onClose={() => setSelected(null)} onChanged={reload} isSuper={isSuper} />
      <AddUserModal open={adding} onClose={() => setAdding(false)} onCreated={reload} />
    </div>
  );
}
