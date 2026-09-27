"use client";

import { useCallback, useState } from "react";
import { EMPTY_ITEMS, newId } from "@/lib/resume";

/** Resume state plus small, immutable update helpers used by the forms. */
export function useResumeEditor(initial) {
  const [resume, setResume] = useState(initial);

  const setPersonal = useCallback((field, value) => setResume((r) => ({ ...r, personal: { ...r.personal, [field]: value } })), []);
  const setField = useCallback((field, value) => setResume((r) => ({ ...r, [field]: value })), []);
  const setTheme = useCallback((patch) => setResume((r) => ({ ...r, theme: { ...r.theme, ...patch } })), []);

  const updateItem = useCallback(
    (section, id, patch) => setResume((r) => ({ ...r, [section]: r[section].map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
    []
  );
  const addItem = useCallback((section) => {
    const item = { id: newId(), ...EMPTY_ITEMS[section] };
    setResume((r) => ({ ...r, [section]: [...r[section], item] }));
    return item.id;
  }, []);
  const removeItem = useCallback((section, id) => setResume((r) => ({ ...r, [section]: r[section].filter((it) => it.id !== id) })), []);
  const duplicateItem = useCallback(
    (section, id) =>
      setResume((r) => {
        const index = r[section].findIndex((it) => it.id === id);
        if (index < 0) return r;
        const list = [...r[section]];
        list.splice(index + 1, 0, { ...list[index], id: newId() });
        return { ...r, [section]: list };
      }),
    []
  );
  const moveItem = useCallback(
    (section, index, delta) =>
      setResume((r) => {
        const list = [...r[section]];
        const target = index + delta;
        if (target < 0 || target >= list.length) return r;
        [list[index], list[target]] = [list[target], list[index]];
        return { ...r, [section]: list };
      }),
    []
  );

  return { resume, setResume, setPersonal, setField, setTheme, updateItem, addItem, removeItem, duplicateItem, moveItem };
}
