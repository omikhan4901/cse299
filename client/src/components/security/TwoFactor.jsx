"use client";

import { useEffect, useState } from "react";
import { Alert, App, Button, Input } from "antd";
import { Copy, Download, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { api } from "@/lib/api";

/** Six-digit code input that submits itself when complete. */
export function CodeInput({ value, onChange, onComplete, disabled, autoFocus = true }) {
  return (
    <Input.OTP
      length={6}
      size="large"
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      formatter={(s) => s.replace(/\D/g, "")}
      onChange={(v) => {
        onChange(v);
        if (v.length === 6) onComplete?.(v);
      }}
    />
  );
}

/** Second step of logging in: authenticator code, or a recovery code. */
export function MfaStep({ mfaToken, onDone, onCancel }) {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const verify = async (value) => {
    setLoading(true);
    setError(null);
    try {
      const body = recovery ? { mfaToken, recoveryCode: value } : { mfaToken, code: value };
      const data = await api("/auth/2fa/verify", { method: "POST", body });
      onDone(data);
    } catch (err) {
      setError(err.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">
        <Smartphone size={22} />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-ink">Two-factor authentication</h2>
      <p className="mt-1 text-sm text-slate-500">
        {recovery ? "Enter one of your recovery codes. Each works once." : "Enter the 6-digit code from your authenticator app."}
      </p>
      {error ? <Alert type="error" showIcon title={error} className="!mt-4 text-left" /> : null}
      <div className="mt-5 flex justify-center">
        {recovery ? (
          <Input size="large" placeholder="XXXX-XXXX" className="!max-w-56 text-center uppercase" value={code} onChange={(e) => setCode(e.target.value)} onPressEnter={() => verify(code)} autoFocus />
        ) : (
          <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={loading} />
        )}
      </div>
      <Button type="primary" size="large" block className="!mt-5" loading={loading} disabled={recovery ? code.length < 8 : code.length !== 6} onClick={() => verify(code)}>
        Verify
      </Button>
      <div className="mt-4 flex justify-between text-xs">
        <button type="button" className="font-medium text-slate-500 hover:text-brand" onClick={() => (setRecovery((r) => !r), setCode(""), setError(null))}>
          {recovery ? "Use an authenticator code" : "Use a recovery code"}
        </button>
        {onCancel ? <button type="button" className="text-slate-400 hover:text-ink" onClick={onCancel}>Back</button> : null}
      </div>
    </div>
  );
}

export function RecoveryCodes({ codes, onDone }) {
  const { message } = App.useApp();
  const text = `ResumeX recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "resumex-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <Alert type="warning" showIcon title="Save these recovery codes now" description="If you lose your phone, a recovery code is the only way back in. Each code works once, and you won't see them again." />
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-4 font-mono text-sm text-ink">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="mt-3 flex gap-2">
        <Button icon={<Download size={14} />} onClick={download}>Download</Button>
        <Button icon={<Copy size={14} />} onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => message.success("Copied"))}>Copy</Button>
      </div>
      {onDone ? <Button type="primary" block size="large" className="!mt-5" onClick={onDone}>I&apos;ve saved them</Button> : null}
    </div>
  );
}

/** Scan a QR code with Google Authenticator (or any TOTP app), confirm with a code, then save recovery codes. */
export function TwoFactorSetup({ token, onEnabled, onFinished }) {
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [codes, setCodes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api("/auth/2fa/setup", { token, method: "POST" })
      .then(async ({ data }) => {
        if (cancelled) return;
        setSetup(data);
        setQr(await QRCode.toDataURL(data.otpauthUrl, { width: 220, margin: 1, color: { dark: "#0f1f2a" } }));
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const enable = async (value) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/auth/2fa/enable", { token, method: "POST", body: { code: value } });
      onEnabled?.(data);
      setCodes(data.recoveryCodes);
    } catch (err) {
      setError(err.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  if (codes) return <RecoveryCodes codes={codes} onDone={onFinished} />;

  return (
    <div>
      {error ? <Alert type="error" showIcon title={error} className="!mb-4" /> : null}
      <ol className="space-y-5">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">1</span>
          <p className="text-sm text-slate-600">
            Install <b className="text-ink">Google Authenticator</b> (or Authy, 1Password, Microsoft Authenticator) on your phone.
          </p>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">2</span>
          <div className="text-sm text-slate-600">
            <p>Tap <b className="text-ink">+</b> and scan this QR code.</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2" />
              ) : (
                <div className="h-44 w-44 animate-pulse rounded-xl bg-slate-100" />
              )}
              {setup ? (
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Can&apos;t scan? Enter this key instead:</p>
                  <code className="mt-1 block rounded-lg bg-slate-100 px-2 py-1.5 font-mono text-xs break-all text-ink">{setup.secret.match(/.{1,4}/g).join(" ")}</code>
                </div>
              ) : null}
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">3</span>
          <div className="text-sm text-slate-600">
            <p>Enter the 6-digit code it shows.</p>
            <div className="mt-3">
              <CodeInput value={code} onChange={setCode} onComplete={enable} disabled={loading || !setup} autoFocus={false} />
            </div>
          </div>
        </li>
      </ol>
      <Button type="primary" size="large" block className="!mt-6" icon={<ShieldCheck size={16} />} loading={loading} disabled={code.length !== 6} onClick={() => enable(code)}>
        Turn on two-factor authentication
      </Button>
    </div>
  );
}

/** Email verification with a 6-digit code (required for super admins). */
export function EmailVerify({ token, email, onVerified }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setError(null);
    try {
      await api("/auth/email/send-code", { token, method: "POST" });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const verify = async (value) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/auth/email/verify", { token, method: "POST", body: { code: value } });
      onVerified(data);
    } catch (err) {
      setError(err.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error ? <Alert type="error" showIcon title={error} className="!mb-4" /> : null}
      <p className="text-sm text-slate-600">
        We&apos;ll send a code to <b className="text-ink">{email}</b> to confirm this address is yours.
      </p>
      {sent ? (
        <div className="mt-4">
          <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={loading} />
          <button type="button" onClick={send} className="mt-3 block text-xs font-medium text-slate-500 hover:text-brand">Send a new code</button>
        </div>
      ) : (
        <Button type="primary" className="!mt-4" icon={<KeyRound size={15} />} loading={loading} onClick={send}>Email me a code</Button>
      )}
    </div>
  );
}
