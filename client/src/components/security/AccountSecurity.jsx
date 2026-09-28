"use client";

import { useState } from "react";
import { Alert, App, Button, Input, Modal } from "antd";
import { LogOut, ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "../AuthProvider";
import { CodeInput, RecoveryCodes, TwoFactorSetup } from "./TwoFactor";

/** Two-factor authentication and "sign out everywhere" for the account page. */
export default function AccountSecurity() {
  const { user, token, updateSession } = useAuth();
  const { message } = App.useApp();
  const [modal, setModal] = useState(null); // setup | recovery | disable
  const [enabled, setEnabled] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const close = () => {
    if (enabled) updateSession(enabled);
    setModal(null);
    setEnabled(null);
    setCode("");
    setPassword("");
    setCodes(null);
    setError(null);
  };

  const run = async (fn) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const signOutEverywhere = () =>
    run(async () => {
      const data = await api("/auth/logout-all", { token, method: "POST" });
      updateSession(data);
      message.success("Signed out of every other device");
    });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><ShieldCheck size={17} /></span>
        <div>
          <h2 className="font-semibold text-ink">Security</h2>
          <p className="text-sm text-slate-500">Protect your account with a code from your phone, and sign out devices you don&apos;t use.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
        <div>
          <p className="font-medium text-ink">
            Two-factor authentication{" "}
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${user?.twoFactorEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {user?.twoFactorEnabled ? "On" : "Off"}
            </span>
          </p>
          <p className="text-xs text-slate-500">Google Authenticator, Authy, 1Password and similar apps.{isAdmin ? " Required for admins." : ""}</p>
        </div>
        {user?.twoFactorEnabled ? (
          <div className="flex gap-2">
            <Button icon={<KeyRound size={14} />} onClick={() => setModal("recovery")}>New recovery codes</Button>
            {!isAdmin ? <Button danger icon={<ShieldOff size={14} />} onClick={() => setModal("disable")}>Turn off</Button> : null}
          </div>
        ) : (
          <Button type="primary" icon={<ShieldCheck size={14} />} onClick={() => setModal("setup")}>Turn on</Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
        <div>
          <p className="font-medium text-ink">Sign out everywhere else</p>
          <p className="text-xs text-slate-500">Ends every other session, e.g. on a shared or lost computer.</p>
        </div>
        <Button icon={<LogOut size={14} />} loading={loading && !modal} onClick={signOutEverywhere}>Sign out other devices</Button>
      </div>

      <Modal open={!!modal} onCancel={close} footer={null} destroyOnHidden width={520}
        title={modal === "setup" ? "Turn on two-factor authentication" : modal === "recovery" ? "New recovery codes" : "Turn off two-factor authentication"}>
        {error ? <Alert type="error" showIcon title={error} className="!mb-4" /> : null}
        {modal === "setup" ? (
          <TwoFactorSetup token={token} onEnabled={setEnabled} onFinished={close} />
        ) : codes ? (
          <RecoveryCodes codes={codes} onDone={close} />
        ) : modal === "recovery" ? (
          <div>
            <p className="mb-3 text-sm text-slate-600">Enter a code from your authenticator app. Your old recovery codes will stop working.</p>
            <CodeInput value={code} onChange={setCode} onComplete={(v) => run(async () => setCodes((await api("/auth/2fa/recovery-codes", { token, method: "POST", body: { code: v } })).recoveryCodes))} disabled={loading} />
          </div>
        ) : modal === "disable" ? (
          <div>
            <p className="mb-3 text-sm text-slate-600">Your account will be protected by your password only.</p>
            <Input.Password placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className="!mb-3" />
            <CodeInput value={code} onChange={setCode} autoFocus={false} disabled={loading} />
            <Button
              danger
              type="primary"
              block
              className="!mt-4"
              loading={loading}
              disabled={!password || code.length !== 6}
              onClick={() =>
                run(async () => {
                  const data = await api("/auth/2fa/disable", { token, method: "POST", body: { password, code } });
                  updateSession(data);
                  message.success("Two-factor authentication is off");
                  close();
                })
              }
            >
              Turn off
            </Button>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
