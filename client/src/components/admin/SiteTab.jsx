"use client";

import { useState } from "react";
import { Alert, Input, InputNumber, Skeleton, Switch } from "antd";
import { Megaphone, Wrench, Bug } from "lucide-react";
import { useSettingsDraft } from "./useSettingsDraft";
import SaveBar from "./SaveBar";

/** One note per line; taken when the field is left (so typing a new line works). */
function Lines({ value, onChange, rows = 3, placeholder }) {
  const [text, setText] = useState(null);
  return (
    <Input.TextArea
      rows={rows}
      placeholder={placeholder}
      value={text ?? value.join("\n")}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text == null) return;
        onChange(text.split("\n").map((l) => l.trim()).filter(Boolean));
        setText(null);
      }}
    />
  );
}

function Section({ icon: Icon, title, text, children, tone = "slate" }) {
  return (
    <section className={`rounded-2xl border p-5 ${tone === "amber" ? "border-amber-300 bg-amber-50/50" : "border-slate-200 bg-white"}`}>
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon size={19} /></span>
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          <p className="text-sm text-slate-600">{text}</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const Label = ({ children, hint }) => (
  <span className="mb-1 block text-xs font-medium text-slate-600">
    {children}
    {hint ? <span className="font-normal text-slate-400"> · {hint}</span> : null}
  </span>
);

/** The beta around the site: the Beta tag's notes, the campaign welcome, maintenance mode and error alerts. */
export default function SiteTab() {
  const { settings, error, loading, update, save, saving, dirty, discard } = useSettingsDraft();
  if (loading && !settings) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) return <Alert type="error" showIcon title={error} />;
  const beta = settings.beta;
  const setBeta = (patch) => update((s) => ((s.beta = { ...s.beta, ...patch }), s));
  const m = settings.maintenance;
  const setM = (patch) => update((s) => ((s.maintenance = { ...s.maintenance, ...patch }), s));

  return (
    <div className="grid gap-6 pb-20 lg:grid-cols-2">
      <Section icon={Megaphone} title="Beta" text="The Beta tag by the logo opens these notes and a feedback form.">
        <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
          Show the Beta tag
          <Switch checked={beta.label} onChange={(v) => setBeta({ label: v })} />
        </label>
        <label className="block">
          <Label hint="one per line, up to 8">What&apos;s new</Label>
          <Lines value={beta.whatsNew} onChange={(v) => setBeta({ whatsNew: v })} />
        </label>
        <label className="block">
          <Label hint="one per line; leave empty when there are none">Known issues</Label>
          <Lines rows={2} value={beta.knownIssues} onChange={(v) => setBeta({ knownIssues: v })} placeholder="PDF export can be slow on older phones" />
        </label>
        <label className="block">
          <Label hint="shown once, to people who joined with a campaign code">Welcome note</Label>
          <Input.TextArea rows={2} maxLength={400} value={beta.welcome} onChange={(e) => setBeta({ welcome: e.target.value })} />
        </label>
      </Section>

      <Section icon={Wrench} title="Maintenance mode" text="Everyone can still look around; only admins can change anything. A bar across the site shows the message." tone={m.enabled ? "amber" : "slate"}>
        <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
          {m.enabled ? <b className="text-amber-800">On: saving is paused for everyone but admins</b> : "Off"}
          <Switch checked={m.enabled} onChange={(v) => setM({ enabled: v })} />
        </label>
        <label className="block">
          <Label>Message</Label>
          <Input.TextArea rows={2} maxLength={300} value={m.message} onChange={(e) => setM({ message: e.target.value })} />
        </label>
      </Section>

      <Section icon={Bug} title="Error alerts" text="Browser errors and server errors are grouped in Feedback › Errors. You're emailed when one keeps happening.">
        <label className="block max-w-xs">
          <Label hint="0 turns it off">Email me when one error happens this often in an hour</Label>
          <InputNumber min={0} className="!w-full" value={settings.errors.spikePerHour} onChange={(v) => update((s) => ((s.errors = { spikePerHour: v ?? 20 }), s))} />
        </label>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
