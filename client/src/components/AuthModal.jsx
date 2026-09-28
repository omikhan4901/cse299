"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal, Form, Input, Button, Alert, Segmented } from "antd";
import { Mail, Lock, User, ArrowLeft, MailCheck, Ticket } from "lucide-react";
import { useBilling } from "./BillingProvider";
import { MfaStep } from "./security/TwoFactor";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import Logo from "./Logo";

export default function AuthModal() {
  const { authModal, setAuthModal } = useAuth();
  const mode = authModal || "login";
  return (
    <Modal open={!!authModal} onCancel={() => setAuthModal(null)} footer={null} centered width={420} destroyOnHidden>
      <AuthForm key={mode} mode={mode} onModeChange={setAuthModal} />
    </Modal>
  );
}

function ForgotForm({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  const submit = async ({ email }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/auth/forgot-password", { method: "POST", body: { email } });
      setSent(data.message || "Check your inbox for a reset link.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center pt-2 pb-5 text-center">
        <Logo />
        <h2 className="mt-4 text-xl font-semibold text-ink">Reset your password</h2>
        <p className="mt-1 text-sm text-slate-500">We&apos;ll email you a link to choose a new one.</p>
      </div>
      {sent ? (
        <div className="flex flex-col items-center rounded-xl bg-brand-50 p-5 text-center">
          <MailCheck size={28} className="text-brand" />
          <p className="mt-2 text-sm text-ink">{sent}</p>
          <p className="mt-1 text-xs text-slate-500">The link works for one hour. Check your spam folder if it doesn&apos;t arrive.</p>
        </div>
      ) : (
        <>
          {error ? <Alert type="error" showIcon title={error} className="mb-4" /> : null}
          <Form layout="vertical" onFinish={submit} requiredMark={false}>
            <Form.Item name="email" rules={[{ required: true, type: "email", message: "Please enter a valid email" }]}>
              <Input size="large" prefix={<Mail size={16} className="text-slate-400" />} placeholder="Email" autoComplete="email" autoFocus />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Send reset link
            </Button>
          </Form>
        </>
      )}
      <button type="button" onClick={onBack} className="mx-auto mt-4 flex items-center gap-1 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft size={14} /> Back to log in
      </button>
    </>
  );
}

function AuthForm({ mode, onModeChange }) {
  const { login, authOptions } = useAuth();
  const billing = useBilling();
  const registration = billing?.config?.registration || "open";
  const [showCode, setShowCode] = useState(!!authOptions?.campaignCode || registration === "campaign");
  const [mfaToken, setMfaToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isRegister = mode === "register";
  if (mode === "forgot") return <ForgotForm onBack={() => onModeChange("login")} />;
  if (mfaToken) return <MfaStep mfaToken={mfaToken} onDone={(data) => login(data, "login")} onCancel={() => setMfaToken(null)} />;

  const submit = async (values) => {
    setLoading(true);
    setError(null);
    try {
      const payload = isRegister
        ? { name: values.name, email: values.email, password: values.password, campaignCode: values.campaignCode || undefined }
        : { email: values.email, password: values.password };
      const data = await api(`/auth/${isRegister ? "register" : "login"}`, { method: "POST", body: payload });
      if (data.mfaRequired) setMfaToken(data.mfaToken);
      else login(data, mode);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center pt-2 pb-4 text-center">
        <Logo />
        <h2 className="mt-4 text-xl font-semibold text-ink">{isRegister ? "Create your free account" : "Welcome back"}</h2>
        <p className="mt-1 text-sm text-slate-500">{isRegister ? "Save resumes, share links and download PDFs." : "Log in to keep working on your resumes."}</p>
      </div>
      <Segmented
        block
        value={mode}
        onChange={onModeChange}
        options={[
          { label: "Log in", value: "login" },
          { label: "Sign up", value: "register" },
        ]}
        className="mb-5"
      />
      {error ? <Alert type="error" showIcon title={error} className="mb-4" /> : null}
      <Form layout="vertical" onFinish={submit} requiredMark={false}>
        {isRegister ? (
          <Form.Item name="name" rules={[{ required: true, message: "Please enter your name" }]}>
            <Input size="large" prefix={<User size={16} className="text-slate-400" />} placeholder="Full name" autoComplete="name" />
          </Form.Item>
        ) : null}
        <Form.Item name="email" rules={[{ required: true, type: "email", message: "Please enter a valid email" }]}>
          <Input size="large" prefix={<Mail size={16} className="text-slate-400" />} placeholder="Email" autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" className={isRegister ? undefined : "!mb-2"} rules={[{ required: true, min: isRegister ? 8 : 1, message: isRegister ? "At least 8 characters" : "Please enter your password" }]}>
          <Input.Password size="large" prefix={<Lock size={16} className="text-slate-400" />} placeholder="Password" autoComplete={isRegister ? "new-password" : "current-password"} />
        </Form.Item>
        {!isRegister ? (
          <div className="mb-5 text-right">
            <button type="button" onClick={() => onModeChange("forgot")} className="text-xs font-medium text-slate-500 hover:text-brand">
              Forgot password?
            </button>
          </div>
        ) : null}
        {isRegister ? (
          <Form.Item
            name="confirm"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator: (_, value) => (!value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("Passwords do not match"))),
              }),
            ]}
          >
            <Input.Password size="large" prefix={<Lock size={16} className="text-slate-400" />} placeholder="Confirm password" autoComplete="new-password" />
          </Form.Item>
        ) : null}
        {isRegister && showCode ? (
          <Form.Item
            name="campaignCode"
            initialValue={authOptions?.campaignCode || ""}
            rules={registration === "campaign" ? [{ required: true, message: "Sign-ups need a campaign code right now" }] : []}
          >
            <Input size="large" prefix={<Ticket size={16} className="text-slate-400" />} placeholder={registration === "campaign" ? "Campaign code" : "Campaign code (optional)"} autoComplete="off" className="uppercase" />
          </Form.Item>
        ) : null}
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          {isRegister ? "Create account" : "Log in"}
        </Button>
      </Form>
      {isRegister && !showCode ? (
        <button type="button" onClick={() => setShowCode(true)} className="mx-auto mt-3 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand">
          <Ticket size={13} /> Have a campaign code?
        </button>
      ) : null}
      {isRegister && registration === "closed" ? (
        <Alert type="info" showIcon className="mt-3" title="Sign-ups are closed right now. You can still log in." />
      ) : null}
      {isRegister ? (
        <p className="mt-4 text-center text-xs text-slate-500">
          By creating an account you agree to our{" "}
          <Link href="/terms" target="_blank" className="text-brand hover:underline">Terms</Link> and{" "}
          <Link href="/privacy" target="_blank" className="text-brand hover:underline">Privacy Policy</Link>.
        </p>
      ) : null}
      <p className="mt-2 text-center text-xs text-slate-400">The first request can take up to a minute while our free server wakes up.</p>
    </>
  );
}
