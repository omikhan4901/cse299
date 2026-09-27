"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, Input, Button, App } from "antd";
import { Send, Sparkles, Copy } from "lucide-react";
import { api } from "@/lib/api";

const { TextArea } = Input;

/** Resume data for the AI: no photo (large and private) and no database fields. */
export function aiResume(resume) {
  const { _id, shortId, isPublic, isMaster, updatedAt, nickname, theme, template, ...rest } = resume;
  return { ...rest, personal: { ...rest.personal, profilePic: undefined, profilePicSource: undefined, photoCrop: undefined } };
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
