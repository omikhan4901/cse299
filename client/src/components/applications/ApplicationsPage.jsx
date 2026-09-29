"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { App, Button, Dropdown, Input, Result, Segmented, Skeleton, Table, Tooltip } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArrowRight, Briefcase, CalendarPlus, Columns3, FileCheck2, List, MoreHorizontal, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { ACTIVE, STATUSES, isActive, nextStep, statusOf } from "@/lib/applications";
import { useAuth } from "../AuthProvider";
import { useBilling } from "../BillingProvider";
import { useApplications } from "./useApplications";
import AddApplication from "./AddApplication";
import ApplicationDrawer from "./ApplicationDrawer";
import { DeadlineChip, StatusChip, TONE, jobName } from "./ui";
import TailorModal from "./TailorModal";
import LockedArea from "../billing/LockedArea";
import { api } from "@/lib/api";
import { calendarFor } from "@/lib/ics";

const BOARD = ["saved", "preparing", "applied", "interviewing", "offer"];
const CLOSED = ["rejected", "withdrawn", "noResponse"];

/** /applications: every job being applied to, as a board or a list (V2). */
export default function ApplicationsPage() {
  const { token, user, loading: authLoading, openAuth } = useAuth();
  const billing = useBilling();
  const { message, modal } = App.useApp();
  // Only once the plan is known, and only if it includes Applications (else a preview page).
  const allowed = !!billing?.ready && billing.canUse("applications");
  const store = useApplications(token, { enabled: !!billing?.v2 && allowed });
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [view, setView] = useState("board");
  const [batch, setBatch] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    const id = params.get("open");
    // Deep links from the home page ("Deadline in 3 days") open that application.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setOpenId(id);
    try {
      const saved = localStorage.getItem("resumex:applications-view");
      if (saved === "list" || saved === "board") setView(saved);
    } catch {
      // Storage blocked: the board is the default.
    }
  }, [params]);

  if (!authLoading && !token) {
    return <Result icon={<Briefcase size={48} className="mx-auto text-brand" />} title="Log in to track your applications" extra={<Button type="primary" onClick={() => openAuth("login", "/applications")}>Log in</Button>} />;
  }
  if (user && billing?.config && !billing.v2) {
    return <Result status="404" title="Not available yet" subTitle="This part of ResumeX isn't open yet." extra={<Link href="/dashboard"><Button>My resumes</Button></Link>} />;
  }
  if (token && !billing?.ready) return <div className="container-x py-10"><Skeleton active paragraph={{ rows: 4 }} /></div>;
  if (!allowed) {
    return (
      <LockedArea
        feature="applications"
        title="Every job you apply to, in one place"
        intro="Paste a job link and it's saved with its deadline. Tailor a resume for it in a click, get ready for the interview, and see what gets you called back."
        scenes={[
          { feature: "applications", title: "From saved to offer", text: "A board of every application, with the next step for each and reminders before deadlines." },
          { feature: "tailored", title: "A resume made for each job", text: "Leads with the skills the job asks for, picked from your own profile. No AI, no credits." },
          { feature: "interviewPrep", title: "Ready for the interview", text: "Likely questions for that job, with answers built on your own experience." },
          { feature: "insights", title: "Learn what works", text: "Which resumes and roles get you interviews, from your own applications." },
        ]}
      />
    );
  }
  if (store.error) return <Result status="warning" title="We couldn't load your applications" subTitle={store.error.message} extra={<Button onClick={store.load}>Try again</Button>} />;

  const apps = store.apps;
  const active = apps?.filter(isActive).length || 0;
  // Jobs with a description and no resume yet: ready to tailor in one go.
  const untailored = (apps || []).filter((a) => isActive(a) && !a.resume && !a.snapshot?.at && a.job?.hasDescription);
  const max = billing?.limitOf("applications");
  const startAdding = () => {
    if (billing && !billing.requireLimit("applications", active, "More active applications")) return;
    setAdding(true);
  };
  const changeStatus = (a, status) =>
    store.update(a._id, { status }).catch((err) => {
      if (err.code === "conflict") store.adopt(err.data);
      if (err.code === "upgrade") billing?.requireLimit("applications", Infinity, "More active applications");
      else message.error(err.message);
      store.load();
    });
  // The ⋯ menu on every card and row: the everyday actions without opening the application.
  const actions = {
    open: (a) => setOpenId(a._id),
    move: changeStatus,
    archive: (a) => store.update(a._id, { archived: !a.archived }).then(() => message.success(a.archived ? "Back in your list" : "Archived. Find it under Closed in the list.")).catch((err) => message.error(err.message)),
    remove: (a) =>
      modal.confirm({
        title: `Delete “${jobName(a)}”?`,
        content: "Its notes, dates and the copy of the resume you sent go with it. The resume itself stays in My resumes. This can't be undone.",
        okText: "Delete",
        okButtonProps: { danger: true },
        onOk: () => store.remove(a._id).then(() => message.success("Deleted")),
      }),
  };
  const exportCalendar = () => {
    const { text, count } = calendarFor(apps, { site: window.location.origin });
    if (!count) return message.info("No deadlines, interviews or follow-ups to add yet.");
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "resumex-applications.ics" });
    link.click();
    URL.revokeObjectURL(url);
    message.success(`${count} date${count === 1 ? "" : "s"} ready for your calendar`);
  };
  const pickView = (v) => {
    setView(v);
    try {
      localStorage.setItem("resumex:applications-view", v);
    } catch {
      // Not remembered, that's all.
    }
  };

  return (
    <div className="container-x py-8 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Applications</h1>
          <p className="mt-1 text-slate-500">
            {apps?.length ? `${active} in progress${max != null ? ` · your plan tracks up to ${max}` : ""}` : "Every job you apply to, from saved to offer."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {apps?.length ? (
            <Segmented
              value={view}
              onChange={pickView}
              options={[
                { value: "board", icon: <Columns3 size={14} />, label: <span className="hidden sm:inline">Board</span> },
                { value: "list", icon: <List size={14} />, label: <span className="hidden sm:inline">List</span> },
              ]}
            />
          ) : null}
          {apps?.length ? (
            <Tooltip title="Deadlines, interviews and follow-ups for your calendar app">
              <Button size="large" icon={<CalendarPlus size={16} />} aria-label="Add to calendar" onClick={exportCalendar} />
            </Tooltip>
          ) : null}
          {untailored.length >= 2 ? (
            <Tooltip title="One resume per job, picked from your profile. Free, no AI credits.">
              <Button size="large" icon={<Wand2 size={16} />} onClick={() => setBatch(true)}>
                <span className="hidden sm:inline">Tailor resumes</span>
              </Button>
            </Tooltip>
          ) : null}
          <Button type="primary" size="large" icon={<Plus size={17} />} onClick={startAdding}>
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add application</span>
          </Button>
        </div>
      </div>

      {!apps ? (
        <div className="grid gap-4 md:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton.Node key={i} active className="!h-64 !w-full" />)}</div>
      ) : !apps.length ? (
        <Empty onAdd={startAdding} />
      ) : view === "board" ? (
        <Board apps={apps} onOpen={setOpenId} onMove={changeStatus} actions={actions} />
      ) : (
        <ListView apps={apps} onOpen={setOpenId} actions={actions} />
      )}

      <AddApplication open={adding} onClose={() => setAdding(false)} token={token} onCreate={async (body) => setOpenId((await store.create(body))._id)} />
      <ApplicationDrawer id={openId} store={store} token={token} onClose={() => setOpenId(null)} />
      {batch ? <BatchTailor ids={untailored.map((a) => a._id)} token={token} onClose={() => setBatch(false)} onDone={store.load} /> : null}
    </div>
  );
}

function Empty({ onAdd }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Briefcase size={22} /></span>
      <h2 className="mt-4 font-display text-xl font-bold text-ink">Track every job you apply to</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Paste a job link or circular and we fill in the details. Deadlines, follow-ups and the resume you sent stay in one place.</p>
      <Button type="primary" className="!mt-6" icon={<Plus size={16} />} onClick={onAdd}>Add your first application</Button>
    </motion.div>
  );
}

/** Open, move, archive or delete one application. */
function AppMenu({ a, actions, className = "" }) {
  const items = [
    { key: "open", label: "Open" },
    { key: "move", label: "Move to", children: STATUSES.filter((s) => s.id !== a.status).map((s) => ({ key: `move:${s.id}`, label: <StatusChip status={s.id} /> })) },
    { key: "archive", icon: <Archive size={14} />, label: a.archived ? "Unarchive" : "Archive" },
    { type: "divider" },
    { key: "delete", icon: <Trash2 size={14} />, label: "Delete", danger: true },
  ];
  const onClick = ({ key }) => {
    if (key === "open") actions.open(a);
    else if (key === "archive") actions.archive(a);
    else if (key === "delete") actions.remove(a);
    else if (key.startsWith("move:")) actions.move(a, key.slice(5));
  };
  // Clicks in the menu (rendered in a portal) still bubble through React to the card: stop them here.
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} draggable={false} onDragStart={(e) => e.preventDefault()}>
      <Dropdown trigger={["click"]} menu={{ items, onClick }}>
        <Button type="text" size="small" icon={<MoreHorizontal size={16} />} aria-label={`Actions for ${jobName(a)}`} className={`!text-slate-400 hover:!text-ink ${className}`} />
      </Dropdown>
    </span>
  );
}

function Card({ a, onOpen, actions, draggable = true }) {
  const step = nextStep(a);
  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", a._id)}
      onClick={() => onOpen(a._id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onOpen(a._id))}
      className="group relative block w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[0_1px_2px_rgba(15,31,42,0.04)] transition hover:border-brand-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:outline-none"
    >
      {actions ? <AppMenu a={a} actions={actions} className="!absolute top-1.5 right-1.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" /> : null}
      <span className="line-clamp-2 block pr-6 text-sm font-semibold text-ink">{jobName(a)}</span>
      {a.job?.title && a.job?.organisation ? <span className="block truncate text-xs text-slate-500">{a.job.organisation}</span> : null}
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <DeadlineChip deadline={a.job?.deadline} open={["saved", "preparing"].includes(a.status)} />
        {a.snapshot?.at ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><FileCheck2 size={12} /> Resume sent</span> : null}
      </span>
      {step ? (
        <span className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <ArrowRight size={12} className="shrink-0 text-brand" /> <span className="truncate">{step.label}</span>
        </span>
      ) : null}
    </motion.div>
  );
}

function Column({ status, apps, onOpen, onMove, actions, children }) {
  const s = statusOf(status);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        const a = apps.all.find((x) => x._id === id);
        if (a && a.status !== status) onMove(a, status);
      }}
      className={`flex w-72 shrink-0 snap-start flex-col rounded-2xl p-2 transition md:w-auto md:shrink ${over ? "bg-brand-50 ring-2 ring-brand-200" : "bg-slate-100/70"}`}
    >
      <p className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <span className={`h-2 w-2 rounded-full ${TONE[s.tone].dot}`} /> {children || s.label} <span className="ml-auto font-normal text-slate-400">{apps.here.length}</span>
      </p>
      <div className="flex min-h-24 flex-col gap-2">
        <AnimatePresence initial={false}>
          {apps.here.map((a) => <Card key={a._id} a={a} onOpen={onOpen} actions={actions} />)}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Board({ apps, onOpen, onMove, actions }) {
  const [showClosed, setShowClosed] = useState(false);
  const live = apps.filter((a) => !a.archived);
  const closed = live.filter((a) => CLOSED.includes(a.status));
  const byStatus = (s) => live.filter((a) => a.status === s).sort((x, y) => new Date(x.job?.deadline || 8.64e15) - new Date(y.job?.deadline || 8.64e15));
  return (
    <>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
        {BOARD.map((s) => <Column key={s} status={s} apps={{ here: byStatus(s), all: apps }} onOpen={onOpen} onMove={onMove} actions={actions} />)}
      </div>
      {closed.length ? (
        <div className="mt-6">
          <button type="button" onClick={() => setShowClosed((v) => !v)} className="text-sm font-medium text-slate-500 hover:text-brand">
            {showClosed ? "Hide" : "Show"} closed ({closed.length})
          </button>
          {showClosed ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {closed.map((a) => (
                <div key={a._id} className="relative">
                  <Card a={a} onOpen={onOpen} actions={actions} draggable />
                  <StatusChip status={a.status} className="pointer-events-none absolute right-9 bottom-3" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ListView({ apps, onOpen, actions }) {
  const [filter, setFilter] = useState("active");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return apps
      .filter((a) => (filter === "active" ? isActive(a) : filter === "closed" ? !isActive(a) : true))
      .filter((a) => !needle || `${a.job?.title} ${a.job?.organisation} ${a.job?.location}`.toLowerCase().includes(needle));
  }, [apps, filter, q]);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "active", label: "In progress" }, { value: "closed", label: "Closed" }, { value: "all", label: "All" }]} />
        <Input allowClear prefix={<Search size={14} className="text-slate-400" />} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="!max-w-xs" />
      </div>
      <Table
        rowKey="_id"
        size="middle"
        dataSource={rows}
        pagination={rows.length > 20 ? { pageSize: 20 } : false}
        onRow={(a) => ({ onClick: () => onOpen(a._id), className: "cursor-pointer" })}
        scroll={{ x: 640 }}
        columns={[
          { title: "Job", render: (_, a) => <span><b className="font-semibold text-ink">{jobName(a)}</b>{a.job?.title && a.job?.organisation ? <span className="block text-xs text-slate-500">{a.job.organisation}</span> : null}</span> },
          { title: "Status", dataIndex: "status", render: (s) => <StatusChip status={s} />, sorter: (x, y) => STATUSES.findIndex((s) => s.id === x.status) - STATUSES.findIndex((s) => s.id === y.status) },
          { title: "Deadline", render: (_, a) => <DeadlineChip deadline={a.job?.deadline} open={ACTIVE.slice(0, 2).includes(a.status)} />, sorter: (x, y) => new Date(x.job?.deadline || 8.64e15) - new Date(y.job?.deadline || 8.64e15) },
          { title: "Next step", render: (_, a) => <span className="text-sm text-slate-500">{nextStep(a)?.label || "—"}</span> },
          { title: "", width: 48, align: "right", render: (_, a) => <AppMenu a={a} actions={actions} /> },
        ]}
      />
    </div>
  );
}

/** Loads the full applications (with their job text) for tailoring several at once. */
function BatchTailor({ ids, token, onClose, onDone }) {
  const [apps, setApps] = useState(null);
  const key = ids.join(",");
  useEffect(() => {
    Promise.all(key.split(",").map((id) => api(`/applications/${id}`, { token }).then((d) => d.data)))
      .then(setApps)
      .catch(() => onClose());
    // Loaded once per set of applications.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token]);
  return apps ? <TailorModal open onClose={onClose} apps={apps} token={token} onDone={onDone} /> : null;
}
