"use client";

import { useState } from "react";
import { Alert, App, Button, Empty, Input, Segmented, Select, Skeleton, Tag, Tooltip } from "antd";
import { ImageIcon, Mail, RotateCcw, Check } from "lucide-react";
import { useAdmin, fmtDate } from "./useAdmin";

const STATUS = [
  { value: "new", label: "New", color: "blue" },
  { value: "seen", label: "Seen", color: "default" },
  { value: "fixed", label: "Fixed", color: "green" },
];
const when = (d) => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One piece of feedback: the note, where it was sent from, its status, the screenshot and a reply. */
function Item({ f, call, onChanged }) {
  const { message } = App.useApp();
  const [shot, setShot] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const setStatus = async (status) => {
    try {
      onChanged((await call(`/feedback/${f._id}`, { method: "PATCH", body: { status } })).data);
    } catch (err) {
      message.error(err.message);
    }
  };
  const send = async () => {
    setBusy(true);
    try {
      onChanged((await call(`/feedback/${f._id}/reply`, { method: "POST", body: { text: reply } })).data);
      setReply("");
      message.success("Reply sent");
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap text-ink">{f.message}</p>
        <Select size="small" value={f.status} onChange={setStatus} options={STATUS.map((s) => ({ value: s.value, label: s.label }))} className="w-24" />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {f.name || "Signed out"}
        {f.email ? ` · ${f.email}` : ""} · {f.page || "unknown page"} · {when(f.createdAt)}
      </p>
      {f.hasScreenshot ? (
        shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="Their screenshot" className="mt-3 max-h-72 rounded-lg border border-slate-200" />
        ) : (
          <Button size="small" type="link" className="!px-0" icon={<ImageIcon size={13} />} onClick={async () => setShot((await call(`/feedback/${f._id}`)).data.screenshot)}>
            Show the screenshot
          </Button>
        )
      ) : null}
      {f.replies?.length ? (
        <ul className="mt-3 space-y-1.5 border-l-2 border-brand-100 pl-3">
          {f.replies.map((r, i) => (
            <li key={i} className="text-sm text-slate-600">
              {r.text} <span className="text-xs text-slate-400">· {r.by} · {when(r.at)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {f.email ? (
        <div className="mt-3 flex gap-2">
          <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${f.email}`} />
          <Button icon={<Mail size={14} />} loading={busy} disabled={!reply.trim()} onClick={send}>Send</Button>
        </div>
      ) : null}
    </li>
  );
}

function FeedbackList() {
  const [status, setStatus] = useState("new");
  const { data, error, loading, call, setData } = useAdmin(`/feedback${status === "all" ? "" : `?status=${status}`}`);
  if (error) return <Alert type="error" showIcon title={error} />;
  if (!data) return <Skeleton active paragraph={{ rows: 5 }} />;
  const onChanged = (fb) => setData({ ...data, items: data.items.map((x) => (x._id === fb._id ? { ...x, ...fb } : x)) });
  return (
    <div>
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: "new", label: `New (${data.counts.new})` },
          { value: "seen", label: `Seen (${data.counts.seen})` },
          { value: "fixed", label: `Fixed (${data.counts.fixed})` },
          { value: "all", label: "All" },
        ]}
      />
      {loading ? <Skeleton active className="!mt-4" /> : data.items.length ? (
        <ul className="mt-4 space-y-3">
          {data.items.map((f) => <Item key={f._id} f={f} call={call} onChanged={onChanged} />)}
        </ul>
      ) : (
        <Empty className="!my-10" description={status === "new" ? "Nothing new. People send feedback from the Beta tag or their account menu." : "Nothing here."} />
      )}
    </div>
  );
}

function ErrorList() {
  const [kind, setKind] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const { data, error, call, reload } = useAdmin(`/errors?${new URLSearchParams({ ...(kind && { kind }), ...(showResolved && { resolved: "1" }) })}`);
  if (error) return <Alert type="error" showIcon title={error} />;
  if (!data) return <Skeleton active paragraph={{ rows: 5 }} />;
  const toggle = async (g) => {
    await call(`/errors/${g._id}`, { method: "PATCH", body: { resolved: !!g.resolvedAt ? false : true } });
    reload();
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={kind} onChange={setKind} options={[{ value: "", label: "All" }, { value: "browser", label: "In browsers" }, { value: "server", label: "On the server" }]} />
        <Button size="small" type={showResolved ? "primary" : "default"} ghost={showResolved} onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? "Showing resolved too" : "Show resolved"}
        </Button>
      </div>
      {data.length ? (
        <ul className="mt-4 space-y-3">
          {data.map((g) => (
            <li key={g._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words text-ink">{g.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    <Tag color={g.kind === "server" ? "volcano" : "geekblue"}>{g.kind}</Tag>
                    {g.where || "unknown place"} · first {fmtDate(g.firstAt)} · last {when(g.lastAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold text-ink tabular-nums">{g.count}</p>
                  <p className="text-xs text-slate-500">{g.lastHour} in the last hour · {g.lastDay} today</p>
                </div>
              </div>
              {g.stack ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500">Details</summary>
                  <pre className="thin-scroll mt-2 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">{g.stack}</pre>
                </details>
              ) : null}
              <Tooltip title={g.resolvedAt ? "It comes back here if it happens again" : "Hide it until it happens again"}>
                <Button size="small" className="!mt-2" icon={g.resolvedAt ? <RotateCcw size={13} /> : <Check size={13} />} onClick={() => toggle(g)}>
                  {g.resolvedAt ? "Reopen" : "Mark resolved"}
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="!my-10" description="No errors. Nice." />
      )}
    </div>
  );
}

/** Feedback from people and errors from browsers and the server (docs/v2/BETA-PLAN.md, Phase 6). */
export default function FeedbackTab() {
  const [view, setView] = useState("feedback");
  return (
    <div className="max-w-3xl space-y-4">
      <Segmented size="large" value={view} onChange={setView} options={[{ value: "feedback", label: "Feedback" }, { value: "errors", label: "Errors" }]} />
      {view === "feedback" ? <FeedbackList /> : <ErrorList />}
    </div>
  );
}
