"use client";

import { useState } from "react";
import { App, Button, Input, Modal } from "antd";
import { motion } from "motion/react";
import { ArrowLeft, Briefcase, CalendarClock, Link2, MapPin, Search } from "lucide-react";
import { api } from "@/lib/api";
import { captureJob } from "@/lib/capture";

const isLink = (t) => /^https?:\/\/\S+$/i.test(t.trim());
const VIA = { teletalk: "Apply through Teletalk", bdjobs: "Apply on Bdjobs", email: "Apply by email", post: "Apply by post", online: "Apply online" };

/**
 * + Add application: paste a job link or the whole circular → Analyze → check the few
 * details found → Save. Rule-based (no AI, no credits). Everything else can come later.
 */
export default function AddApplication({ open, onClose, token, onCreate }) {
  const { message } = App.useApp();
  const [input, setInput] = useState("");
  const [found, setFound] = useState(null); // the job, once analysed
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setInput("");
    setFound(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const analyze = async () => {
    const raw = input.trim();
    if (!raw) return;
    setBusy(true);
    try {
      let text = raw;
      let url = "";
      if (isLink(raw)) {
        url = raw;
        try {
          const { data } = await api("/applications/fetch", { token, method: "POST", body: { url } });
          text = `${data.title}\n${data.text}`;
        } catch (err) {
          // Couldn't read the page: keep the link, let them fill in or paste the text.
          message.info(err.message, 6);
          text = "";
        }
      }
      const job = captureJob(text);
      setFound({ ...job, url: url || job.url, description: text.slice(0, 30000) });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!found.title.trim() && !found.organisation.trim()) return message.warning("Add at least the job title or the organisation.");
    setBusy(true);
    try {
      const { title, organisation, deadline, location, jobType, salary, applyVia, email, url, keywords, description } = found;
      await onCreate({ job: { title, organisation, deadline: deadline || null, location, jobType, salary, applyVia, email, url, keywords, description } });
      message.success("Application saved");
      close();
    } catch (err) {
      if (err.code !== "upgrade") message.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setFound((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onCancel={close} footer={null} width={560} centered destroyOnHidden>
      {!found ? (
        <div className="pt-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-600 text-white shadow-md shadow-brand/25">
            <Briefcase size={18} />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-ink">Add an application</h2>
          <p className="text-sm text-slate-500">Paste the job link or the whole circular. We&apos;ll pick out the title, organisation and deadline. Uses no AI credits.</p>
          <Input.TextArea
            className="!mt-4"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoSize={{ minRows: 5, maxRows: 12 }}
            maxLength={30000}
            placeholder={"https://… or the full job post (English or Bangla)"}
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setFound({ ...captureJob(""), url: "", description: "" })} className="text-sm font-medium text-slate-500 hover:text-brand">
              Fill in by hand
            </button>
            <Button type="primary" icon={<Search size={15} />} loading={busy} disabled={!input.trim()} onClick={analyze}>
              Analyze
            </Button>
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="pt-1">
          <button type="button" onClick={() => setFound(null)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="mt-3 font-display text-lg font-bold text-ink">{found.title || found.organisation ? "Is this right?" : "Add the details"}</h2>
          <div className="mt-4 space-y-3">
            <div>
              <Input size="large" placeholder="Job title" autoFocus={!found.title} status={found.description && !found.title.trim() ? "warning" : undefined} value={found.title} onChange={set("title")} prefix={<Briefcase size={15} className="text-slate-400" />} />
              {found.description && !found.title.trim() ? <p className="mt-1 text-xs text-amber-700">We couldn&apos;t spot the job title. Add it: the match and interview prep use it.</p> : null}
            </div>
            <Input placeholder="Organisation" value={found.organisation} onChange={set("organisation")} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500"><CalendarClock size={12} /> Deadline</span>
                <Input type="date" value={found.deadline} onChange={set("deadline")} />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500"><MapPin size={12} /> Location</span>
                <Input value={found.location} onChange={set("location")} placeholder="Optional" />
              </label>
            </div>
            {found.url ? (
              <p className="flex items-center gap-1.5 truncate text-xs text-slate-500"><Link2 size={12} /> {found.url}</p>
            ) : null}
            {found.applyVia.length || found.keywords.length ? (
              <div className="flex flex-wrap gap-1.5">
                {found.applyVia.map((v) => (
                  <span key={v} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">{VIA[v]}</span>
                ))}
                {found.keywords.slice(0, 8).map((k) => (
                  <span key={k} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{k}</span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={close}>Cancel</Button>
            <Button type="primary" loading={busy} onClick={save}>Save application</Button>
          </div>
        </motion.div>
      )}
    </Modal>
  );
}
