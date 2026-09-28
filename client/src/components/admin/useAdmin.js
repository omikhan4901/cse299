"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "../AuthProvider";

/** Loads an /api/admin resource and exposes { data, error, loading, reload, call }. */
export function useAdmin(path) {
  const { token } = useAuth();
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const reload = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const d = await api(`/admin${path}`, { token });
      setState({ data: d.data, error: null, loading: false });
    } catch (err) {
      setState({ data: null, error: err.message, loading: false });
    }
  }, [path, token]);

  useEffect(() => {
    // Fetch when the path changes; state is only set once the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const call = useCallback((p, opts = {}) => api(`/admin${p}`, { token, ...opts }), [token]);
  return { ...state, reload, call, setData: (data) => setState((s) => ({ ...s, data })) };
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
