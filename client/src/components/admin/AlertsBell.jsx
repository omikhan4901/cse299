"use client";

import { useState } from "react";
import { Badge, Button, Popover } from "antd";
import { Bell, Database, Network, UserPlus, Zap } from "lucide-react";
import { useAdmin } from "./useAdmin";

const KEY = "resumex.admin.alertsSeen";
const ICON = { ai: Zap, storage: Database, signups: UserPlus, burst: Network };
const seenAt = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};

/** The owner's alerts (AI spend, storage, sign-ups, bursts), newest first; a dot for new ones. */
export default function AlertsBell() {
  const { data } = useAdmin("/alerts");
  const [seen, setSeen] = useState(seenAt);
  const alerts = data || [];
  const fresh = alerts.filter((a) => new Date(a.at).getTime() > seen).length;
  const open = (v) => {
    if (!v || !alerts.length) return;
    const latest = new Date(alerts[0].at).getTime();
    try {
      localStorage.setItem(KEY, String(latest));
    } catch {
      // Storage blocked: the dot just stays.
    }
    setSeen(latest);
  };
  const list = (
    <div className="thin-scroll max-h-96 w-80 overflow-auto">
      {alerts.length ? (
        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => {
            const Icon = ICON[a.kind] || Bell;
            return (
              <li key={a._id} className="flex gap-2.5 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><Icon size={14} /></span>
                <span className="min-w-0 text-sm text-slate-700">
                  {a.text}
                  <span className="mt-0.5 block text-xs text-slate-400">{new Date(a.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-3 text-sm text-slate-500">Nothing to report. You&apos;ll also get these by email.</p>
      )}
    </div>
  );
  return (
    <Popover trigger="click" placement="bottomRight" title="Alerts" content={list} onOpenChange={open}>
      <Badge count={fresh} size="small" offset={[-4, 4]}>
        <Button shape="circle" icon={<Bell size={16} />} aria-label={`Alerts${fresh ? `, ${fresh} new` : ""}`} />
      </Badge>
    </Popover>
  );
}
