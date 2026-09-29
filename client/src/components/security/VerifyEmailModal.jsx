"use client";

import { useEffect, useState } from "react";
import { App, Modal } from "antd";
import { MailCheck } from "lucide-react";
import { VERIFY_NEEDED } from "@/lib/api";
import { useAuth } from "../AuthProvider";
import { EmailVerify } from "./TwoFactor";

/**
 * "Verify your email": opens when an AI request needs a verified address first (the server
 * answers code "verify-email"), or from Account settings. A 6-digit code by email.
 */
export default function VerifyEmailModal() {
  const { token, user, updateSession } = useAuth();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(VERIFY_NEEDED, show);
    return () => window.removeEventListener(VERIFY_NEEDED, show);
  }, []);
  if (!user || user.emailVerified) return null;
  return (
    <Modal open={open} onCancel={() => setOpen(false)} footer={null} width={440} centered destroyOnHidden>
      <div className="pt-1">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand"><MailCheck size={19} /></span>
        <h2 className="mt-4 font-display text-lg font-bold text-ink">Verify your email to use AI</h2>
        <p className="mb-4 text-sm text-slate-500">It keeps AI credits for real people. Everything else works without it.</p>
        <EmailVerify
          token={token}
          email={user.email}
          onVerified={(data) => {
            updateSession({ user: data.user || { ...user, emailVerified: true } });
            setOpen(false);
            message.success("Email verified. AI features are ready.");
          }}
        />
      </div>
    </Modal>
  );
}

/** Opens the dialog from anywhere (e.g. Account settings). */
export const askToVerify = () => window.dispatchEvent(new Event(VERIFY_NEEDED));
