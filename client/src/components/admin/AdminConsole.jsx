"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Result, Button, Tabs, Skeleton } from "antd";
import { BarChart3, Users, Crown, Zap, Megaphone, ShieldCheck, ScrollText, Lock, Mail, Smartphone, LayoutTemplate, Gauge, Coins, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { EmailVerify, TwoFactorSetup } from "../security/TwoFactor";
import AuditTab from "./AuditTab";
import { useAuth } from "../AuthProvider";
import Overview from "./Overview";
import UsersTab from "./UsersTab";
import PlansTab from "./PlansTab";
import CreditsTab from "./CreditsTab";
import CampaignsTab from "./CampaignsTab";
import TemplatesTab from "./TemplatesTab";
import RateLimitsTab from "./RateLimitsTab";
import EconomicsTab from "./EconomicsTab";
import RevenueTab from "./RevenueTab";

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3, Comp: Overview },
  { key: "revenue", label: "Revenue", icon: Wallet, Comp: RevenueTab },
  { key: "users", label: "Users", icon: Users, Comp: UsersTab },
  { key: "plans", label: "Plans & pricing", icon: Crown, Comp: PlansTab },
  { key: "templates", label: "Templates", icon: LayoutTemplate, Comp: TemplatesTab },
  { key: "credits", label: "Credits & access", icon: Zap, Comp: CreditsTab },
  { key: "economics", label: "AI costs", icon: Coins, Comp: EconomicsTab },
  { key: "campaigns", label: "Campaigns", icon: Megaphone, Comp: CampaignsTab },
  { key: "limits", label: "Rate limits", icon: Gauge, Comp: RateLimitsTab },
  { key: "audit", label: "Audit log", icon: ScrollText, Comp: AuditTab },
];

/**
 * Before the console opens: super admins verify their email, every admin turns
 * on two-factor authentication, and this session must have passed it.
 */
function SecurityGate({ me, onChange }) {
  const { token, updateSession, logout, openAuth } = useAuth();
  // The new 2FA session is applied only after the recovery codes have been saved.
  const [enabled, setEnabled] = useState(null);
  const needEmail = me.role === "superadmin" && !me.emailVerified;
  const needMfa = !me.twoFactorEnabled;
  const step = needEmail ? "email" : needMfa ? "mfa" : "session";
  const steps = [
    ...(me.role === "superadmin" ? [{ key: "email", label: "Verify email", icon: Mail, done: !needEmail }] : []),
    { key: "mfa", label: "Authenticator", icon: Smartphone, done: !needMfa },
  ];
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_24px_60px_-28px_rgba(15,31,42,.35)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white"><Lock size={22} /></span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Secure your admin account</h1>
        <p className="mt-1 text-sm text-slate-500">The admin console controls every account, so it needs extra protection.</p>
        <div className="mt-5 flex gap-2">
          {steps.map(({ key, label, icon: Icon, done }) => (
            <span key={key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${done ? "bg-emerald-50 text-emerald-700" : step === key ? "bg-brand-50 text-brand" : "bg-slate-100 text-slate-500"}`}>
              <Icon size={13} /> {label}{done ? " ✓" : ""}
            </span>
          ))}
        </div>
        <div className="mt-6">
          {step === "email" ? (
            <EmailVerify token={token} email={me.email} onVerified={() => onChange()} />
          ) : step === "mfa" ? (
            <TwoFactorSetup token={token} onEnabled={setEnabled} onFinished={() => (enabled ? updateSession(enabled) : onChange())} />
          ) : (
            <div>
              <p className="text-sm text-slate-600">For your security, log in again and enter the code from your authenticator app to open the console.</p>
              <Button type="primary" className="!mt-4" onClick={() => { logout(); setTimeout(() => openAuth("login", "/admin"), 50); }}>Log in with my code</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The admin console. Access is checked again by every /api/admin request. */
export default function AdminConsole() {
  const { user, token, loading, openAuth } = useAuth();
  const [tab, setTab] = useState("overview");
  const [me, setMe] = useState(null);
  const loadMe = useCallback(() => {
    if (!token) return;
    api("/auth/me", { token })
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
  }, [token]);
  useEffect(() => {
    // Security status (email verified, 2FA, whether this session passed 2FA) comes fresh from the server.
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    // Restore the tab from the URL once on load (e.g. /admin#users).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (TABS.some((t) => t.key === fromHash)) setTab(fromHash);
  }, []);

  if (loading) return <div className="container-x py-12"><Skeleton active paragraph={{ rows: 10 }} /></div>;
  if (!user) return <Result status="403" title="Log in to continue" extra={<Button type="primary" onClick={() => openAuth("login", "/admin")}>Log in</Button>} />;
  if (user.role !== "admin" && user.role !== "superadmin") {
    return <Result status="403" title="Admins only" subTitle="Your account doesn't have access to the admin console." extra={<Link href="/dashboard"><Button>Back to my resumes</Button></Link>} />;
  }
  if (!me) return <div className="container-x py-12"><Skeleton active paragraph={{ rows: 6 }} /></div>;
  if ((me.role === "superadmin" && !me.emailVerified) || !me.twoFactorEnabled || !me.sessionMfa) return <SecurityGate me={me} onChange={loadMe} />;

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-ink">
            <ShieldCheck className="text-brand" /> Admin console
          </h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user.email} · {user.role === "superadmin" ? "Super admin" : "Admin"}</p>
        </div>
      </div>
      <Tabs
        activeKey={tab}
        onChange={(k) => {
          setTab(k);
          window.history.replaceState(null, "", `#${k}`);
        }}
        destroyOnHidden
        items={TABS.map(({ key, label, icon: Icon, Comp }) => ({
          key,
          label: <span className="inline-flex items-center gap-1.5"><Icon size={15} /> {label}</span>,
          children: <Comp isSuper={user.role === "superadmin"} />,
        }))}
      />
    </div>
  );
}
