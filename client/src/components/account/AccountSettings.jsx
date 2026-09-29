"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, App, Button, Form, Input, Modal, Progress, Result, Skeleton, Switch } from "antd";
import { CreditCard, Crown, Download, KeyRound, Mail, Sparkles, Trash2, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { API_URL, AI_ENABLED } from "@/lib/config";
import { useBilling, resetsIn } from "../BillingProvider";
import AccountSecurity from "../security/AccountSecurity";
import { useAuth } from "../AuthProvider";

const day = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** The Paddle subscription: plan, renewal or end date, and the billing portal. */
function BillingCard({ billing }) {
  const sub = billing.subscription;
  const planName = (id) => billing.config?.plans?.find((p) => p.id === id)?.name || "Paid";
  const passUntil = billing.usage?.passUntil;
  if (passUntil && !sub?.active) {
    return (
      <Card icon={CreditCard} title="Plan & billing">
        <p className="text-sm text-slate-700">
          <b className="text-ink">Job Search Pass</b>: {billing.usage?.plan?.name} until {day(passUntil)}. It ends by itself; there&apos;s nothing to cancel.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={billing.openPortal}>Billing history</Button>
          <Link href="/pricing"><Button>See plans</Button></Link>
        </div>
      </Card>
    );
  }
  if (!sub?.active) {
    return (
      <Card icon={CreditCard} title="Plan & billing">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {sub?.status === "canceled" ? `Your ${planName(sub.plan)} subscription has ended. ` : sub?.status === "paused" ? `Your ${planName(sub.plan)} subscription is paused. ` : ""}
            Upgrade for more templates and AI credits. Cancel any time.
          </p>
          <div className="flex gap-2">
            {sub ? <Button onClick={billing.openPortal}>Billing history</Button> : null}
            <Link href="/pricing"><Button type="primary">See plans</Button></Link>
          </div>
        </div>
      </Card>
    );
  }
  const cancelling = sub.scheduledChange?.action === "cancel";
  return (
    <Card icon={CreditCard} title="Plan & billing">
      <p className="text-sm text-slate-700">
        <b className="text-ink">{planName(sub.plan)}</b>, billed {sub.interval === "year" ? "yearly" : "monthly"}
      </p>
      {sub.status === "past_due" ? (
        <Alert className="!mt-3" type="warning" showIcon title="Your last payment didn't go through" description={`Paddle will try again. Update your card in Manage billing to keep ${planName(sub.plan)}.`} />
      ) : cancelling ? (
        <p className="mt-1 text-sm text-amber-700">Cancels on {day(sub.scheduledChange.effectiveAt)}. You keep {planName(sub.plan)} until then.</p>
      ) : sub.currentPeriodEnd ? (
        <p className="mt-1 text-sm text-slate-500">Renews on {day(sub.currentPeriodEnd)}.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="primary" onClick={billing.openPortal}>Manage billing</Button>
        <Link href="/pricing"><Button>Change plan</Button></Link>
      </div>
      <p className="mt-3 text-xs text-slate-400">Payments, invoices and cancelling are handled by Paddle, our reseller.</p>
    </Card>
  );
}

function Card({ icon: Icon, title, description, children, danger }) {
  return (
    <section className={`rounded-2xl border bg-white p-6 ${danger ? "border-red-200" : "border-slate-200"}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand"}`}>
          <Icon size={17} />
        </span>
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}


export default function AccountSettings() {
  const { user, token, loading, openAuth, updateSession, logout } = useAuth();
  const { message } = App.useApp();
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ loading: false, error: null });
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState({ open: false, loading: false, error: null });
  const [pwForm] = Form.useForm();

  const billing = useBilling();
  const usage = billing?.usage;
  useEffect(() => {
    billing?.refreshUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="container-x max-w-3xl py-12">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }
  if (!user) {
    return (
      <Result
        icon={<UserRound size={48} className="mx-auto text-brand" />}
        title="Log in to manage your account"
        extra={<Button type="primary" onClick={() => openAuth("login", "/account")}>Log in</Button>}
      />
    );
  }

  const saveName = async ({ name }) => {
    setSavingName(true);
    try {
      const data = await api("/auth/me", { token, method: "PUT", body: { name } });
      updateSession({ user: data.user });
      message.success("Name updated");
    } catch (err) {
      message.error(err.message);
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    setPw({ loading: true, error: null });
    try {
      const data = await api("/auth/password", { token, method: "PUT", body: { currentPassword, newPassword } });
      updateSession(data);
      pwForm.resetFields();
      setPw({ loading: false, error: null });
      message.success("Password changed. You've been signed out on other devices.");
    } catch (err) {
      setPw({ loading: false, error: err.message });
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_URL}/auth/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Could not export your data. Please try again.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumex-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async ({ password }) => {
    setDeleting((d) => ({ ...d, loading: true, error: null }));
    try {
      await api("/auth/me", { token, method: "DELETE", body: { password } });
      message.success("Your account and resumes have been deleted.");
      logout();
    } catch (err) {
      setDeleting((d) => ({ ...d, loading: false, error: err.message }));
    }
  };

  // The live plan (it changes when a payment or cancellation comes through), else the one from sign-in.
  const planId = usage?.plan?.id || user.plan;
  const pro = planId && planId !== "free";

  return (
    <div className="container-x max-w-3xl space-y-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Account</h1>
        <p className="mt-1 text-slate-500">
          {user.email} · member since {new Date(user.createdAt || Date.now()).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
      </div>

      <Card icon={UserRound} title="Profile">
        <Form layout="vertical" initialValues={{ name: user.name }} onFinish={saveName} requiredMark={false} className="flex flex-wrap items-end gap-3">
          <Form.Item name="name" label="Name" className="!mb-0 min-w-60 flex-1" rules={[{ required: true, message: "Please enter your name" }]}>
            <Input size="large" maxLength={100} />
          </Form.Item>
          <Button htmlType="submit" size="large" loading={savingName}>Save</Button>
        </Form>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pro ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
            {pro ? <Crown size={12} /> : null} {billing?.config?.plans?.find((p) => p.id === planId)?.name || (pro ? "Pro" : "Free")} plan
          </span>
          {pro && user.planExpiresAt && !billing?.subscription?.active ? <span className="text-slate-500">until {new Date(user.planExpiresAt).toLocaleDateString()}</span> : null}
        </div>
      </Card>

      {billing?.canCheckout || billing?.subscription ? <BillingCard billing={billing} /> : null}

      {usage && AI_ENABLED ? (
        <Card
          icon={Sparkles}
          title={`AI credits ${usage.period === "month" ? "this month" : "today"}`}
          description={usage.source === "freeMode" ? "Free during early access. Credits refresh every day at midnight UTC." : `Your ${usage.plan?.name} plan allowance. Credits refresh ${usage.period === "month" ? "on the 1st of each month" : "every day at midnight UTC"}.`}
        >
          <Progress percent={Math.round((usage.used / Math.max(1, usage.limit)) * 100)} showInfo={false} strokeColor={usage.remaining ? undefined : "#dc2626"} />
          <p className="mt-1 text-sm text-slate-600">
            <b className="text-ink">{usage.used}</b> of {usage.limit} used · {usage.remaining} left · refreshes {resetsIn(usage.resetsAt)}
          </p>
          {billing?.config ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {billing.config.aiFeatures.map((f) => (
                <span key={f.key} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {f.name} <b className="text-ink">{billing.costOf(f.key)}</b>
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card icon={KeyRound} title="Password" description="Changing it signs you out on every other device.">
        {pw.error ? <Alert type="error" showIcon title={pw.error} className="mb-4" /> : null}
        <Form form={pwForm} layout="vertical" onFinish={changePassword} requiredMark={false} className="grid gap-x-3 sm:grid-cols-3">
          <Form.Item name="currentPassword" label="Current password" rules={[{ required: true, message: "Required" }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="New password" rules={[{ required: true, min: 8, message: "At least 8 characters" }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm new password"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Required" },
              ({ getFieldValue }) => ({
                validator: (_, value) => (!value || getFieldValue("newPassword") === value ? Promise.resolve() : Promise.reject(new Error("Doesn't match"))),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <div className="sm:col-span-3">
            <Button type="primary" htmlType="submit" loading={pw.loading}>Change password</Button>
          </div>
        </Form>
      </Card>

      <AccountSecurity />

      {billing?.v2 ? <EmailPrefs user={user} token={token} onUser={(u) => updateSession({ user: u })} /> : null}

      <Card icon={Download} title="Your data" description="Download everything we store about you (your account, resumes, Career Profile and applications) as a JSON file.">
        <Button icon={<Download size={15} />} loading={exporting} onClick={exportData}>Download my data</Button>
        <p className="mt-3 text-xs text-slate-400">
          See our <Link href="/privacy" className="text-brand hover:underline">privacy policy</Link> for how your data is used.
        </p>
      </Card>

      <Card icon={Trash2} title="Delete account" description="Permanently deletes your account, your resumes and their share links, your Career Profile and applications. This can't be undone." danger>
        <Button danger onClick={() => setDeleting({ open: true, loading: false, error: null })}>Delete my account</Button>
      </Card>

      <Modal
        open={deleting.open}
        onCancel={() => setDeleting({ open: false, loading: false, error: null })}
        footer={null}
        title="Delete your account?"
        destroyOnHidden
      >
        <p className="mb-4 text-sm text-slate-600">Everything will be deleted immediately, including public resume links. Enter your password to confirm.</p>
        {deleting.error ? <Alert type="error" showIcon title={deleting.error} className="mb-4" /> : null}
        <Form layout="vertical" onFinish={deleteAccount} requiredMark={false}>
          <Form.Item name="password" rules={[{ required: true, message: "Enter your password" }]}>
            <Input.Password placeholder="Password" autoComplete="current-password" autoFocus />
          </Form.Item>
          <Button danger type="primary" htmlType="submit" block loading={deleting.loading}>
            Delete everything
          </Button>
        </Form>
      </Modal>
    </div>
  );
}

/** V2: which reminder emails to get (deadlines and interviews; the weekly digest). */
function EmailPrefs({ user, token, onUser }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(null);
  const prefs = user.emailPrefs || { reminders: true, digest: true };
  const set = async (key, value) => {
    setBusy(key);
    try {
      const data = await api("/auth/email-prefs", { token, method: "PUT", body: { [key]: value } });
      onUser(data.user);
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusy(null);
    }
  };
  const rows = [
    ["reminders", "Deadline and interview reminders", "The day before a deadline or an interview."],
    ["digest", "Weekly digest", "What's coming up this week, every Monday."],
  ];
  return (
    <Card icon={Mail} title="Emails" description="About the applications you track.">
      <ul className="divide-y divide-slate-100">
        {rows.map(([key, label, hint]) => (
          <li key={key} className="flex items-center justify-between gap-3 py-3">
            <span>
              <span className="block text-sm font-medium text-ink">{label}</span>
              <span className="block text-xs text-slate-500">{hint}</span>
            </span>
            <Switch checked={prefs[key] !== false} loading={busy === key} onChange={(v) => set(key, v)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
