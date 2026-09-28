"use client";

import { useState } from "react";
import { App } from "antd";
import { useAdmin } from "./useAdmin";
import { SETTINGS_CHANGED } from "@/lib/api";

/** Top-level sections of `draft` that differ from `saved`. */
const changedSections = (draft, saved) =>
  Object.fromEntries(Object.keys(draft).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved?.[k])).map((k) => [k, draft[k]]));

/**
 * Loads the admin settings and keeps an editable copy. `save()` sends only the
 * sections that changed, with the revision they were loaded at: if someone saved
 * in the meantime, the server refuses, and the edits are put back on top of the
 * latest settings to check and save again (nothing is silently undone).
 */
export function useSettingsDraft() {
  const { message } = App.useApp();
  const { data, error, loading, call, setData } = useAdmin("/settings");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const current = draft || data?.settings || null;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(data?.settings);

  const update = (fn) => setDraft((d) => fn(structuredClone(d || data.settings)));

  const save = async () => {
    setSaving(true);
    const changes = changedSections(draft, data.settings);
    try {
      const d = await call("/settings", { method: "PUT", body: { ...changes, baseRev: data.rev } });
      setData(d.data);
      setDraft(null);
      window.dispatchEvent(new Event(SETTINGS_CHANGED)); // this tab's builder/pricing pick it up now
      message.success("Settings saved. Live for everyone now.");
    } catch (err) {
      if (err.code === "conflict" && err.data?.settings) {
        setData(err.data);
        setDraft({ ...structuredClone(err.data.settings), ...changes });
        message.warning("Someone else saved settings while you were editing. Your changes are kept on top of theirs: check them and save again.", 8);
      } else message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return { settings: current, meta: data, error, loading, update, save, saving, dirty, discard: () => setDraft(null) };
}
