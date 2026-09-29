"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * The account's tracked applications. Changes show at once and are saved in order per
 * application, each with the revision it was based on; a newer save from another tab comes
 * back as a conflict (err.code "conflict", latest copy in err.data) instead of being lost.
 */
export function useApplications(token, { enabled = true } = {}) {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState(null);
  const revs = useRef(new Map());
  const queues = useRef(new Map());

  const remember = (a) => a && revs.current.set(a._id, a.rev || 0);

  const load = useCallback(async () => {
    try {
      const { data } = await api("/applications", { token });
      data.forEach(remember);
      setApps(data);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [token]);

  useEffect(() => {
    // Loaded once the account is known; state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token && enabled) load();
    const onFocus = () => document.visibilityState === "visible" && token && enabled && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [token, enabled, load]);

  const create = useCallback(
    async (body) => {
      const { data } = await api("/applications", { token, method: "POST", body });
      remember(data);
      setApps((list) => [data, ...(list || [])]);
      return data;
    },
    [token]
  );

  /** Shows the change now and saves it after any save already in flight for this application. */
  const update = useCallback(
    (id, patch, { local } = {}) => {
      setApps((list) => list?.map((a) => (a._id === id ? { ...a, ...(local || patch), job: { ...a.job, ...(local || patch).job } } : a)));
      const run = async () => {
        const { data } = await api(`/applications/${id}`, { token, method: "PUT", body: { ...patch, baseRev: revs.current.get(id) } });
        remember(data);
        setApps((list) => list?.map((a) => (a._id === id ? { ...a, ...data } : a)));
        return data;
      };
      const next = (queues.current.get(id) || Promise.resolve()).catch(() => {}).then(run);
      queues.current.set(id, next);
      return next;
    },
    [token]
  );

  /** After a conflict: take the other copy. */
  const adopt = useCallback((data) => {
    remember(data);
    setApps((list) => list?.map((a) => (a._id === data._id ? data : a)));
  }, []);

  const remove = useCallback(
    async (id) => {
      await api(`/applications/${id}`, { token, method: "DELETE" });
      setApps((list) => list?.filter((a) => a._id !== id));
    },
    [token]
  );

  return { apps, error, load, create, update, adopt, remove, revs };
}
