"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Result, Button, Tabs, Skeleton } from "antd";
import { BarChart3, Users, Crown, Zap, Megaphone, ShieldCheck } from "lucide-react";
import { useAuth } from "../AuthProvider";
import Overview from "./Overview";
import UsersTab from "./UsersTab";
import PlansTab from "./PlansTab";
import CreditsTab from "./CreditsTab";
import CampaignsTab from "./CampaignsTab";

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3, Comp: Overview },
  { key: "users", label: "Users", icon: Users, Comp: UsersTab },
  { key: "plans", label: "Plans & pricing", icon: Crown, Comp: PlansTab },
  { key: "credits", label: "Credits & access", icon: Zap, Comp: CreditsTab },
  { key: "campaigns", label: "Campaigns", icon: Megaphone, Comp: CampaignsTab },
];

/** The admin console. Access is checked again by every /api/admin request. */
export default function AdminConsole() {
  const { user, loading, openAuth } = useAuth();
  const [tab, setTab] = useState("overview");

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
