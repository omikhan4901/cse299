"use client";

import { useEffect, useState } from "react";
import { Button, Modal } from "antd";
import { CalendarClock, PartyPopper, Zap } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { useBilling } from "../BillingProvider";

const key = (id) => `resumex.welcomed.${id}`;

/**
 * Once, for people who joined through a campaign: what they got (plan until when, credits)
 * and the welcome note from Admin › Site. Remembered per account in this browser.
 */
export default function CampaignWelcome() {
  const { user } = useAuth();
  const billing = useBilling();
  const [open, setOpen] = useState(false);
  const note = billing?.config?.beta?.welcome;
  const ready = !!user?.viaCampaign && !!billing?.ready;

  useEffect(() => {
    if (!ready) return;
    try {
      // Only soon after joining, and once.
      const recent = !user.createdAt || Date.now() - new Date(user.createdAt) < 30 * 864e5;
      // localStorage is only readable in the browser, after the account is known.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (recent && !localStorage.getItem(key(user.id))) setOpen(true);
    } catch {
      // Storage blocked: skip the welcome rather than show it every time.
    }
  }, [ready, user?.id, user?.createdAt]);

  const close = () => {
    try {
      localStorage.setItem(key(user.id), "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };
  if (!open) return null;
  const until = user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : null;
  const plan = billing.plan?.name;
  const credits = billing.usage;
  return (
    <Modal open onCancel={close} footer={null} width={440} centered>
      <div className="pt-2 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><PartyPopper size={22} /></span>
        <h2 className="mt-4 font-display text-xl font-bold text-ink">Welcome to the ResumeX beta</h2>
        {note ? <p className="mt-2 text-sm text-slate-600">{note}</p> : null}
        <ul className="mx-auto mt-4 max-w-xs space-y-2 text-left text-sm text-slate-700">
          {plan && plan !== "Free" ? <li className="flex gap-2"><CalendarClock size={15} className="mt-0.5 text-brand" /> {plan}{until ? ` until ${until}` : ""}</li> : null}
          {credits ? <li className="flex gap-2"><Zap size={15} className="mt-0.5 fill-amber-400 text-amber-500" /> {credits.limit} AI credits {credits.period === "month" ? "a month" : "a day"}</li> : null}
        </ul>
        <Button type="primary" size="large" className="!mt-6" onClick={close}>Let&apos;s go</Button>
      </div>
    </Modal>
  );
}
