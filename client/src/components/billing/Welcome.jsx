"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Spin } from "antd";
import { CheckCircle2, Clock, FileText, Sparkles, Zap } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { useBilling } from "../BillingProvider";
import { BuilderLink } from "../BuilderLauncher";
import { celebrate } from "../celebrate";

const WAIT_MS = 45000;

/**
 * Where Paddle sends people after paying. The plan switches on when Paddle's webhook
 * reaches the API (usually a few seconds), so this checks until it has.
 */
export default function Welcome() {
  const { token, loading } = useAuth();
  const billing = useBilling();
  const [waited, setWaited] = useState(false);
  const started = useRef(0);
  const cheered = useRef(null);

  const plan = billing?.usage?.plan;
  const paid = !!plan && plan.id !== "free";

  useEffect(() => {
    if (!token || paid) return;
    started.current ||= Date.now();
    const t = setInterval(() => {
      if (Date.now() - started.current > WAIT_MS) {
        setWaited(true);
        clearInterval(t);
      } else billing?.refreshUsage();
    }, 2500);
    return () => clearInterval(t);
  }, [token, paid, billing]);

  useEffect(() => {
    if (paid && cheered.current) celebrate(cheered.current);
  }, [paid]);

  if (loading) return null;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {paid ? (
          <>
            <span ref={cheered} className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">
              <CheckCircle2 size={28} />
            </span>
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">Welcome to {plan.name}</h1>
            <p className="mt-2 text-slate-600">Your payment went through and your plan is active. Paddle has emailed you a receipt.</p>
            <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-slate-700">
              <li className="flex gap-2"><Zap size={16} className="mt-0.5 shrink-0 fill-amber-400 text-amber-500" /> {billing.usage.limit.toLocaleString()} AI credits {billing.usage.period === "month" ? "a month" : "a day"}</li>
              <li className="flex gap-2"><FileText size={16} className="mt-0.5 shrink-0 text-brand" /> Every template your plan includes, unlocked</li>
              <li className="flex gap-2"><Sparkles size={16} className="mt-0.5 shrink-0 text-brand" /> Manage or cancel any time from your account</li>
            </ul>
            <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <BuilderLink className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-dark">Open the builder</BuilderLink>
              <Link href="/dashboard"><Button size="large" className="!h-10 w-full">My resumes</Button></Link>
            </div>
          </>
        ) : waited || !token ? (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Clock size={26} />
            </span>
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">Thanks! Your payment is being confirmed</h1>
            <p className="mt-2 text-slate-600">
              This usually takes a few seconds but can take a couple of minutes. Your plan switches on by itself, and Paddle emails you a receipt.
              If it hasn&apos;t switched on within 10 minutes, reply to that receipt or email us.
            </p>
            <div className="mt-7 flex justify-center gap-2">
              <Link href="/account"><Button size="large" type="primary">Check my account</Button></Link>
              <Link href="/dashboard"><Button size="large">My resumes</Button></Link>
            </div>
          </>
        ) : (
          <div role="status" aria-live="polite">
            <Spin size="large" />
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">Setting up your plan…</h1>
            <p className="mt-2 text-slate-600">Your payment went through. We&apos;re switching on your new plan, which takes a few seconds.</p>
          </div>
        )}
      </div>
    </div>
  );
}
