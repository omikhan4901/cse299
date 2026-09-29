"use client";

import Link from "next/link";
import { BuilderLink } from "./BuilderLauncher";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, Dropdown } from "antd";
import { motion } from "motion/react";
import { Menu, X, LayoutDashboard, LogOut, FilePlus2, Settings, ShieldCheck, UserRound, Briefcase } from "lucide-react";
import { useBilling } from "./BillingProvider";
import Logo from "./Logo";
import { useAuth } from "./AuthProvider";

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/ats-checker", label: "ATS Checker" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
];

export default function Navbar({ compact = false }) {
  const pathname = usePathname();
  const { isAuthenticated, user, loading, logout, openAuth } = useAuth();
  const [open, setOpen] = useState(false);

  const billing = useBilling();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const base = billing?.config?.showPricing ? [...LINKS, { href: "/pricing", label: "Pricing" }] : LINKS;
  // V2: the Career Profile sits next to the resumes made from it.
  const mine = billing?.v2
    ? [{ href: "/career", label: "Profile" }, { href: "/applications", label: "Applications" }, { href: "/dashboard", label: "My Resumes" }]
    : [{ href: "/dashboard", label: "My Resumes" }];
  const links = isAuthenticated ? [...base, ...mine] : base;
  const mobileLinks = isAuthenticated ? [...links, { href: "/account", label: "Account settings" }, ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])] : links;

  const userMenu = {
    items: [
      ...(billing?.v2
        ? [
            { key: "profile", icon: <UserRound size={15} />, label: <Link href="/career">Career Profile</Link> },
            { key: "applications", icon: <Briefcase size={15} />, label: <Link href="/applications">Applications</Link> },
          ]
        : []),
      { key: "dash", icon: <LayoutDashboard size={15} />, label: <Link href="/dashboard">My resumes</Link> },
      { key: "new", icon: <FilePlus2 size={15} />, label: <Link href="/builder?new=1">New resume</Link> },
      { key: "account", icon: <Settings size={15} />, label: <Link href="/account">Account settings</Link> },
      ...(isAdmin ? [{ key: "admin", icon: <ShieldCheck size={15} />, label: <Link href="/admin">Admin console</Link> }] : []),
      { type: "divider" },
      { key: "logout", icon: <LogOut size={15} />, label: "Log out", danger: true, onClick: logout },
    ],
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md print:hidden">
      <nav className={`${compact ? "px-4 md:px-6" : "container-x"} flex h-16 items-center justify-between gap-4`} aria-label="Main">
        <Logo href="/" />

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === l.href ? "text-brand" : "text-slate-600 hover:bg-slate-50 hover:text-ink"
              }`}
            >
              {pathname === l.href ? (
                <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-lg bg-brand-50" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              ) : null}
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-9 w-40" />
          ) : isAuthenticated ? (
            <>
              <BuilderLink>
                <Button type="primary">Open builder</Button>
              </BuilderLink>
              <Dropdown menu={userMenu} placement="bottomRight" trigger={["click"]}>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white" aria-label="Account menu">
                  {(user?.name || "?").trim().charAt(0).toUpperCase()}
                </button>
              </Dropdown>
            </>
          ) : (
            <>
              <Button type="text" onClick={() => openAuth("login")}>
                Log in
              </Button>
              <Button type="primary" onClick={() => openAuth("register")}>
                Get started free
              </Button>
            </>
          )}
        </div>

        <button className="rounded-lg p-2 text-slate-700 md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open ? (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden border-t border-slate-200 bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {mobileLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex gap-2">
              {isAuthenticated ? (
                <>
                  <BuilderLink className="flex-1" onClick={() => setOpen(false)}>
                    <Button type="primary" block>
                      Open builder
                    </Button>
                  </BuilderLink>
                  <Button onClick={logout}>Log out</Button>
                </>
              ) : (
                <>
                  <Button block onClick={() => { setOpen(false); openAuth("login"); }}>
                    Log in
                  </Button>
                  <Button block type="primary" onClick={() => { setOpen(false); openAuth("register"); }}>
                    Sign up
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      ) : null}
    </header>
  );
}
