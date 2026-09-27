"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, App, Button, Form, Input, Modal, Progress, Result, Skeleton } from "antd";
import { Crown, Download, KeyRound, Sparkles, Trash2, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { API_URL, AI_ENABLED } from "@/lib/config";
import { useAuth } from "../AuthProvider";

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

const hoursUntil = (iso) => Math.max(1, Math.ceil((new Date(iso) - Date.now()) / 3600000));

export default function AccountSettings() {
  const { user, token, loading, openAuth, updateSession, logout } = useAuth();
  const { message } = App.useApp();
  const [usage, setUsage] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ loading: false, error: null });
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState({ open: false, loading: false, error: null });
  const [pwForm] = Form.useForm();

  useEffect(() => {
    if (!token || !AI_ENABLED) return;
    api("/ai/usage", { token })
      .then((d) => setUsage(d.usage))
      .catch(() => {});
  }, [token]);

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

  const pro = user.plan === "pro";

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
            {pro ? <Crown size={12} /> : null} {pro ? "Pro" : "Free"} plan
          </span>
          {pro && user.planExpiresAt ? <span className="text-slate-500">until {new Date(user.planExpiresAt).toLocaleDateString()}</span> : null}
        </div>
      </Card>

      {usage ? (
        <Card icon={Sparkles} title="AI usage today" description="AI requests reset every day at midnight UTC. Importing a PDF counts as 3, a cover letter as 2.">
          <Progress percent={Math.round((usage.used / usage.limit) * 100)} showInfo={false} strokeColor={usage.remaining ? undefined : "#dc2626"} />
          <p className="mt-1 text-sm text-slate-600">
            <b className="text-ink">{usage.used}</b> of {usage.limit} used · {usage.remaining} left · resets in about {hoursUntil(usage.resetsAt)} h
          </p>
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

      <Card icon={Download} title="Your data" description="Download everything we store about you — your account details and every resume — as a JSON file.">
        <Button icon={<Download size={15} />} loading={exporting} onClick={exportData}>Download my data</Button>
        <p className="mt-3 text-xs text-slate-400">
          See our <Link href="/privacy" className="text-brand hover:underline">privacy policy</Link> for how your data is used.
        </p>
      </Card>

      <Card icon={Trash2} title="Delete account" description="Permanently deletes your account, all your resumes and their share links. This can't be undone." danger>
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
