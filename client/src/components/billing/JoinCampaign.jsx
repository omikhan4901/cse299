"use client";

import { Button } from "antd";
import { CalendarClock, GraduationCap, Mail, Users, Zap } from "lucide-react";
import { useAuth } from "../AuthProvider";

/** Landing card for a campaign invite link (/join/CODE). */
export default function JoinCampaign({ campaign }) {
  const { openAuth, isAuthenticated } = useAuth();
  const rows = [
    { icon: Zap, text: `${campaign.credits} AI credits a ${campaign.creditPeriod}` },
    campaign.plan.id !== "free" ? { icon: CalendarClock, text: `${campaign.plan.name} plan for ${campaign.durationDays} days` } : null,
    campaign.emailDomain ? { icon: Mail, text: `For @${campaign.emailDomain} email addresses` } : null,
    { icon: Users, text: `${campaign.placesLeft} place${campaign.placesLeft === 1 ? "" : "s"} left` },
  ].filter(Boolean);

  return (
    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,31,42,.35)]">
      <div className="bg-gradient-to-br from-brand to-navy px-8 pt-8 pb-7 text-white">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
          <GraduationCap size={22} />
        </span>
        <p className="mt-4 text-xs font-semibold tracking-wider text-white/70 uppercase">You&apos;re invited</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{campaign.name}</h1>
        {campaign.description ? <p className="mt-2 text-sm text-white/80">{campaign.description}</p> : null}
      </div>
      <div className="px-8 py-6">
        <ul className="space-y-3">
          {rows.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-slate-700">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <Icon size={15} />
              </span>
              {text}
            </li>
          ))}
        </ul>
        {isAuthenticated ? (
          <p className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Campaign codes work when you create a new account. Log out first to join with a new account.</p>
        ) : (
          <Button type="primary" size="large" block className="!mt-6" onClick={() => openAuth("register", "/builder", { campaignCode: campaign.code })}>
            Create my account
          </Button>
        )}
        <p className="mt-3 text-center text-xs text-slate-400">Code: <b className="text-slate-600">{campaign.code}</b></p>
      </div>
    </div>
  );
}
