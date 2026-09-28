"use client";

import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "../AuthProvider";
import Logo from "../Logo";
import { MfaStep } from "../security/TwoFactor";

export default function ResetPasswordForm({ token }) {
  const { login, openAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? null : "This reset link is incomplete. Please request a new one.");
  const [mfaToken, setMfaToken] = useState(null);

  const submit = async ({ password }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/auth/reset-password", { method: "POST", body: { token, password } });
      if (data.mfaRequired) setMfaToken(data.mfaToken);
      else login(data, "login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (mfaToken) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <MfaStep mfaToken={mfaToken} onDone={(data) => login(data, "login")} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex flex-col items-center pb-5 text-center">
        <Logo />
        <h1 className="mt-4 text-xl font-semibold text-ink">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-500">You&apos;ll be signed in, and signed out everywhere else.</p>
      </div>
      {error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          className="mb-4"
          action={<Button size="small" type="link" onClick={() => openAuth("forgot")}>New link</Button>}
        />
      ) : null}
      <Form layout="vertical" onFinish={submit} requiredMark={false} disabled={!token}>
        <Form.Item name="password" rules={[{ required: true, min: 8, message: "At least 8 characters" }]}>
          <Input.Password size="large" prefix={<Lock size={16} className="text-slate-400" />} placeholder="New password" autoComplete="new-password" autoFocus />
        </Form.Item>
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
          <Input.Password size="large" prefix={<Lock size={16} className="text-slate-400" />} placeholder="Confirm new password" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          Save password
        </Button>
      </Form>
    </div>
  );
}
