"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, Input, Button, Progress, App } from "antd";
import { Send, Sparkles, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

const { TextArea } = Input;

/** Resume data for the AI: no photo (large and private) and no database fields. */
export function aiResume(resume) {
  const { _id, shortId, isPublic, isMaster, updatedAt, nickname, theme, template, ...rest } = resume;
  return { ...rest, personal: { ...rest.personal, profilePic: undefined } };
}

export function ChatModal({ open, onClose, resume, token, onUseAsSummary }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      const first = resume.personal.name?.split(" ")[0];
      setMessages([{ role: "assistant", content: `Hi${first ? ` ${first}` : ""}! I've read your resume. Ask me to rewrite a section, suggest skills for a role, or check your bullet points.` }]);
    }
  }, [open, messages.length, resume.personal.name]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const data = await api("/ai/chat", { token, method: "POST", body: { conversation: next.slice(1), fullResume: aiResume(resume) } });
      setMessages((m) => [...m, { role: "assistant", content: data.response }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err.message, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={<span className="inline-flex items-center gap-2"><Sparkles size={16} className="text-brand" /> AI resume assistant</span>} open={open} onCancel={onClose} footer={null} width={640}>
      <div ref={listRef} className="thin-scroll h-[55vh] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-brand text-white" : m.error ? "bg-red-50 text-red-700" : "bg-white text-ink shadow-sm"}`}>
              {m.content}
              {i > 0 && m.role === "assistant" && !m.error ? (
                <button type="button" className="mt-2 block text-xs font-medium text-brand hover:underline" onClick={() => onUseAsSummary(m.content)}>
                  Use as my “About me”
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? <div className="text-sm text-slate-400">Thinking…</div> : null}
      </div>
      <div className="mt-3 flex gap-2">
        <Input size="large" value={input} onChange={(e) => setInput(e.target.value)} onPressEnter={send} placeholder="e.g. What skills am I missing for a data analyst role?" disabled={loading} />
        <Button size="large" type="primary" icon={<Send size={16} />} onClick={send} loading={loading} />
      </div>
    </Modal>
  );
}

export function AuditModal({ open, onClose, resume, token }) {
  return (
    <Modal title="ATS check" open={open} onCancel={onClose} footer={null} width={620} destroyOnHidden>
      <Audit resume={resume} token={token} />
    </Modal>
  );
}

function Audit({ resume, token }) {
  const [job, setJob] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/ai/audit", { token, method: "POST", body: { resumeData: aiResume(resume), jobDescription: job } });
      setResult(data.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const color = (s) => (s >= 75 ? "#16a34a" : s >= 50 ? "#d97706" : "#dc2626");

  return (
    <>
      {!result ? (
        <div>
          <p className="mb-3 text-sm text-slate-500">Paste a job description to see how well your resume matches it, or leave it empty for a general review.</p>
          <TextArea rows={7} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the job description here (optional)" />
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <Button type="primary" size="large" block className="!mt-4" loading={loading} onClick={run}>
            {job.trim() ? "Check my match" : "Run a general check"}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <Progress type="circle" percent={result.score} size={96} strokeColor={color(result.score)} />
            <div>
              <p className="font-semibold text-ink">{job.trim() ? "Job match score" : "Resume health score"}</p>
              <p className="text-sm text-slate-500">{result.summary}</p>
            </div>
          </div>
          {result.missingKeywords?.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Missing keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {result.missingKeywords.map((k) => (
                  <span key={k} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200">{k}</span>
                ))}
              </div>
            </div>
          ) : null}
          <List title="Strengths" icon={<CheckCircle2 size={15} className="text-green-600" />} items={result.strengths} />
          <List title="Improve" icon={<AlertTriangle size={15} className="text-amber-600" />} items={result.improvements} />
          <Button block onClick={() => setResult(null)}>Check another job</Button>
        </div>
      )}
    </>
  );
}

function List({ title, icon, items = [] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">{icon} {title}</p>
      <ul className="space-y-1.5 text-sm text-slate-600">
        {items.map((it, i) => (
          <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">{it}</li>
        ))}
      </ul>
    </div>
  );
}

export function CoverLetterModal({ open, onClose, resume, token }) {
  const { message } = App.useApp();
  const [job, setJob] = useState("");
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!job.trim()) return message.warning("Paste the job description first.");
    setLoading(true);
    try {
      const data = await api("/ai/cover-letter", { token, method: "POST", body: { resumeData: aiResume(resume), jobDescription: job } });
      setLetter(data.coverLetter);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Cover letter writer" open={open} onCancel={onClose} footer={null} width={720}>
      {!letter ? (
        <div>
          <p className="mb-3 text-sm text-slate-500">We&apos;ll write a letter that connects your experience to this job.</p>
          <TextArea rows={8} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the full job description" />
          <Button type="primary" size="large" block className="!mt-4" loading={loading} onClick={generate}>
            Write my cover letter
          </Button>
        </div>
      ) : (
        <div>
          <TextArea value={letter} onChange={(e) => setLetter(e.target.value)} autoSize={{ minRows: 12, maxRows: 22 }} />
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setLetter("")}>Start over</Button>
            <Button type="primary" icon={<Copy size={14} />} onClick={() => navigator.clipboard.writeText(letter).then(() => message.success("Copied"))}>
              Copy letter
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
