"use client";

import { useState } from "react";
import { Modal, Switch, Input, Button, App } from "antd";
import { Copy, Globe, Lock, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "../AuthProvider";

export default function ShareModal({ open, onClose, resume, onChange }) {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  if (!resume?._id) return null;

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/view/${resume.shortId || resume._id}`;

  const toggle = async (isPublic) => {
    setLoading(true);
    try {
      const { data } = await api(`/resumes/${resume._id}`, { token, method: "PUT", body: { isPublic } });
      onChange({ isPublic: data.isPublic, shortId: data.shortId });
      message.success(isPublic ? "Your resume is now public" : "Your resume is private again");
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      message.success("Link copied");
    } catch {
      message.info(url);
    }
  };

  return (
    <Modal title="Share your resume" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${resume.isPublic ? "bg-brand-50 text-brand" : "bg-slate-100 text-slate-500"}`}>
            {resume.isPublic ? <Globe size={18} /> : <Lock size={18} />}
          </span>
          <div>
            <p className="font-medium text-ink">{resume.isPublic ? "Anyone with the link can view" : "Only you can see this resume"}</p>
            <p className="text-xs text-slate-500">Public resumes get a web page and a PDF download.</p>
          </div>
        </div>
        <Switch checked={!!resume.isPublic} loading={loading} onChange={toggle} />
      </div>
      {resume.isPublic ? (
        <div className="mt-4">
          <Input.Search value={url} readOnly enterButton={<span className="inline-flex items-center gap-1.5"><Copy size={14} /> Copy</span>} onSearch={copy} />
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
            Open public page <ExternalLink size={13} />
          </a>
        </div>
      ) : null}
      <div className="mt-5 text-right">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
