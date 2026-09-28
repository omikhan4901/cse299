"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Dropdown, App, Result, Skeleton, Tooltip } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { Plus, MoreVertical, Pencil, Copy, Crown, Trash2, Download, Globe, FileText, HardDrive, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { normalizeResume } from "@/lib/resume";
import { templateById } from "@/pdf/registry";
import { downloadPdf } from "@/pdf/client";
import { useAuth } from "./AuthProvider";
import ResumeThumbnail from "./ResumeThumbnail";
import { readDraft, isWorthKeeping, draftLabel } from "./builder/drafts";
import { timeAgo } from "@/lib/time";
import { BuilderLink } from "@/components/BuilderLauncher";

export default function Dashboard() {
  const { token, user, loading: authLoading, openAuth } = useAuth();
  const { message, modal } = App.useApp();
  const [resumes, setResumes] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  // A resume started in this browser that never made it into the account.
  const [localDraft, setLocalDraft] = useState(null);
  useEffect(() => {
    const draft = readDraft();
    // localStorage is only readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isWorthKeeping(draft)) setLocalDraft(draft);
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await api("/resumes", { token });
      setResumes(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    // Fetch the list once the token is known; state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) load();
  }, [token, load]);

  if (!authLoading && !token) {
    return (
      <Result
        icon={<FileText size={48} className="mx-auto text-brand" />}
        title="Log in to see your resumes"
        subTitle="Or jump straight in — you can build and download a resume without an account."
        extra={[
          <Button key="l" type="primary" onClick={() => openAuth("login", "/dashboard")}>Log in</Button>,
          <BuilderLink key="b"><Button>Open the builder</Button></BuilderLink>,
        ]}
      />
    );
  }

  const act = async (id, fn) => {
    setBusy(id);
    try {
      await fn();
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const duplicate = (r) =>
    act(r._id, async () => {
      await api(`/resumes/${r._id}/duplicate`, { token, method: "POST" });
      await load();
      message.success("Resume duplicated");
    });

  const makeMaster = (r) =>
    act(r._id, async () => {
      await api(`/resumes/${r._id}`, { token, method: "PUT", body: { isMaster: !r.isMaster } });
      await load();
      message.success(r.isMaster ? "Master profile removed" : `"${r.nickname}" is now your master profile`);
    });

  const download = (r) =>
    act(r._id, async () => {
      const { data } = await api(`/resumes/${r._id}`, { token });
      await downloadPdf(normalizeResume(data));
    });

  const remove = (r) =>
    modal.confirm({
      title: `Delete "${r.nickname}"?`,
      content: "This can't be undone. Anyone with its share link will lose access.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/resumes/${r._id}`, { token, method: "DELETE" });
          setResumes((list) => list.filter((x) => x._id !== r._id));
          message.success("Resume deleted");
        } catch (err) {
          message.error(err.message);
        }
      },
    });

  const sorted = resumes ? [...resumes].sort((a, b) => (a.isMaster === b.isMaster ? new Date(b.updatedAt) - new Date(a.updatedAt) : a.isMaster ? -1 : 1)) : null;

  return (
    <div className="container-x py-8 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">My resumes</h1>
          <p className="mt-1 text-slate-500">
            {user ? `Hi ${user.name.split(" ")[0]}! ` : ""}Keep a version for every kind of job. Your <Crown size={14} className="inline text-amber-500" /> master profile can fill new resumes in one click.
          </p>
        </div>
        <Link href="/builder?new=1">
          <Button type="primary" size="large" icon={<Plus size={17} />}>New resume</Button>
        </Link>
      </div>

      {localDraft && token ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><HardDrive size={17} /></span>
          <p className="min-w-0 flex-1 text-sm text-amber-900">
            <b>{draftLabel(localDraft)}</b> is only saved in this browser, not in your account yet.
          </p>
          <Link href="/builder">
            <Button type="primary" icon={<ArrowRight size={15} />} iconPlacement="end">Open and save it</Button>
          </Link>
        </div>
      ) : null}

      {error ? (
        <Result status="warning" title="We couldn't load your resumes" subTitle={error} extra={<Button onClick={load}>Try again</Button>} />
      ) : !sorted ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3">
              <Skeleton.Node active className="!h-60 !w-full" />
              <Skeleton active paragraph={{ rows: 1 }} className="mt-3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/builder?new=1" className="group flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 text-slate-500 transition hover:border-brand hover:text-brand">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition group-hover:bg-brand-50">
              <Plus size={22} />
            </span>
            <span className="mt-3 font-medium">Create a new resume</span>
          </Link>
          <AnimatePresence>
          {sorted.map((r, index) => {
            const tpl = templateById(r.template);
            const menu = {
              items: [
                { key: "edit", icon: <Pencil size={14} />, label: <Link href={`/builder?id=${r._id}`}>Edit</Link> },
                { key: "dl", icon: <Download size={14} />, label: "Download PDF", onClick: () => download(r) },
                { key: "dup", icon: <Copy size={14} />, label: "Duplicate", onClick: () => duplicate(r) },
                { key: "master", icon: <Crown size={14} />, label: r.isMaster ? "Remove master profile" : "Set as master profile", onClick: () => makeMaster(r) },
                { type: "divider" },
                { key: "del", icon: <Trash2 size={14} />, label: "Delete", danger: true, onClick: () => remove(r) },
              ],
            };
            return (
              <motion.div
                key={r._id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 260, damping: 26, delay: Math.min(index, 8) * 0.06 }}
                className={`group relative overflow-hidden rounded-2xl border bg-white transition-shadow duration-300 hover:shadow-xl ${r.isMaster ? "border-amber-300" : "border-slate-200"}`}
              >
                <Link href={`/builder?id=${r._id}`} className="block">
                  <div className="relative h-60 overflow-hidden border-b border-slate-100 bg-slate-100">
                    <ResumeThumbnail resume={normalizeResume(r)} fallback={`/templates/${tpl.id}.jpg`} />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
                  </div>
                </Link>
                <div className="flex items-start gap-2 p-4">
                  <Link href={`/builder?id=${r._id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{r.nickname}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{tpl.name} · edited {timeAgo(r.updatedAt)}</p>
                  </Link>
                  <Dropdown menu={menu} trigger={["click"]} placement="bottomRight">
                    <Button type="text" size="small" loading={busy === r._id} icon={<MoreVertical size={16} />} aria-label="Resume actions" />
                  </Dropdown>
                </div>
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {r.isMaster ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950 shadow-sm"><Crown size={11} /> Master</span>
                  ) : null}
                  {r.isPublic ? (
                    <Tooltip title="Anyone with the link can view">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"><Globe size={11} /> Public</span>
                    </Tooltip>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
