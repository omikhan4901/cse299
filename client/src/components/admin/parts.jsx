"use client";

import { useState } from "react";
import { App, Button, Popconfirm, Segmented, Tooltip } from "antd";
import { CircleUserRound, FileText, SquareKanban, Trash2, Zap } from "lucide-react";

/** One switch per feature: follow the plan, or always on / off for members. */
export function FeatureSwitches({ value = {}, onChange, features, plan, freeMode }) {
  const set = (key, v) => {
    const next = { ...value };
    if (v === "plan") delete next[key];
    else next[key] = v === "on";
    onChange?.(next);
  };
  return (
    <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
      {features.map((f) => {
        const byPlan = freeMode || !!plan?.features?.[f.key];
        const v = typeof value[f.key] === "boolean" ? (value[f.key] ? "on" : "off") : "plan";
        return (
          <div key={f.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">{f.name}</span>
            <Segmented
              size="small"
              value={v}
              onChange={(x) => set(f.key, x)}
              options={[{ value: "plan", label: `Plan (${byPlan ? "on" : "off"})` }, { value: "on", label: "On" }, { value: "off", label: "Off" }]}
            />
          </div>
        );
      })}
    </div>
  );
}

/** What someone did after signing up, as small counts (empty until they do something). */
export function FirstSteps({ did }) {
  const steps = [
    { on: did.resumes > 0, icon: FileText, text: `${did.resumes} resume${did.resumes === 1 ? "" : "s"}` },
    { on: did.profile, icon: CircleUserRound, text: "Career Profile" },
    { on: did.applications > 0, icon: SquareKanban, text: `${did.applications} application${did.applications === 1 ? "" : "s"}` },
    { on: did.aiUses > 0, icon: Zap, text: `AI ${did.aiUses}× · ${did.aiCredits} credits` },
  ].filter((s) => s.on);
  if (!steps.length) return <span className="text-xs text-slate-400">Nothing yet</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
      {steps.map(({ icon: Icon, text }) => (
        <span key={text} className="inline-flex items-center gap-1"><Icon size={12} className="text-brand" /> {text}</span>
      ))}
    </span>
  );
}

/**
 * Delete an account straight from a list (Users, a campaign's members). Its resumes, profile
 * and applications go too; a campaign member still inside their campaign days frees the place.
 */
export function DeleteUserButton({ user, call, onDone }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  if (!user || user.role === "superadmin") return null;
  const remove = async () => {
    setBusy(true);
    try {
      const r = await call(`/users/${user._id}`, { method: "DELETE" });
      message.success(r.placeFreed ? `${user.name || "Account"} deleted. Their campaign place is free again.` : `${user.name || "Account"} deleted.`);
      onDone?.();
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Popconfirm
        title={`Delete ${user.name || user.email}?`}
        description={<span className="block max-w-64">Their resumes, profile and applications are deleted too{user.campaign ? ", and an unfinished campaign place is freed" : ""}. This can&apos;t be undone.</span>}
        okText="Delete"
        okButtonProps={{ danger: true }}
        onConfirm={remove}
      >
        <Tooltip title="Delete account">
          <Button size="small" type="text" danger loading={busy} icon={<Trash2 size={14} />} aria-label={`Delete ${user.name || user.email}`} />
        </Tooltip>
      </Popconfirm>
    </span>
  );
}
