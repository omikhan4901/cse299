"use client";

import { useState } from "react";
import { App } from "antd";
import { useAdmin } from "./useAdmin";

/**
 * Loads the admin settings and keeps an editable copy. `save()` sends the
 * whole draft; the server validates and fills anything missing.
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
    try {
      const d = await call("/settings", { method: "PUT", body: draft });
      setData(d.data);
      setDraft(null);
      message.success("Settings saved — live for everyone now");
    } catch (err) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return { settings: current, meta: data, error, loading, update, save, saving, dirty, discard: () => setDraft(null) };
}
