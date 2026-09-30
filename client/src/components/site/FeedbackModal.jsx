"use client";

import { useEffect, useState } from "react";
import { App, Button, Input, Modal } from "antd";
import { ImagePlus, X } from "lucide-react";
import { api } from "@/lib/api";
import { FEEDBACK_EVENT } from "@/lib/reportError";
import { readPhoto } from "../builder/photo";
import { useAuth } from "../AuthProvider";

/**
 * Feedback during the beta (Admin › Feedback): a few words, the page it's about (added for
 * them), an optional screenshot (shrunk in the browser) and, when signed out, an email for a
 * reply. Opened from the Beta tag, the account menu or an error screen.
 */
export default function FeedbackModal() {
  const { token, isAuthenticated } = useAuth();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [shot, setShot] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(FEEDBACK_EVENT, show);
    return () => window.removeEventListener(FEEDBACK_EVENT, show);
  }, []);

  const attach = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setShot(await readPhoto(file, 1400));
    } catch (err) {
      message.error(err.message);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      await api("/reports/feedback", { method: "POST", token, body: { message: text, page: window.location.pathname, screenshot: shot || undefined, email: isAuthenticated ? undefined : email || undefined } });
      message.success("Thanks! We read every note.");
      setOpen(false);
      setText("");
      setShot(null);
    } catch (err) {
      message.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      title="Send feedback"
      width={480}
      centered
      destroyOnHidden
      styles={{ body: { maxHeight: "min(76vh, 640px)", overflowY: "auto" } }}
      footer={
        <Button type="primary" loading={sending} disabled={text.trim().length < 3} onClick={send}>
          Send
        </Button>
      }
    >
      <p className="mb-3 text-sm text-slate-600">What worked, what didn&apos;t, what you wish it did. We&apos;ll see which page you were on.</p>
      <Input.TextArea autoFocus rows={5} maxLength={2000} showCount value={text} onChange={(e) => setText(e.target.value)} placeholder="The PDF download was slow on my phone…" />
      {!isAuthenticated ? <Input className="!mt-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email, if you'd like a reply (optional)" /> : null}
      <div className="mt-3">
        {shot ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot} alt="Your screenshot" className="max-h-32 rounded-lg border border-slate-200" />
            <button type="button" aria-label="Remove the screenshot" onClick={() => setShot(null)} className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500 shadow hover:text-rose-600">
              <X size={13} />
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand">
            <ImagePlus size={15} /> Add a screenshot (optional)
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={attach} />
          </label>
        )}
      </div>
    </Modal>
  );
}
