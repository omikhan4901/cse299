"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CONTENT_KEYS } from "@/lib/resume";

/**
 * The signed-in account's Career Profile: loads it, saves with the revision it was loaded
 * at (a newer save from another tab comes back as a conflict instead of being overwritten),
 * and refreshes when the tab comes back into view.
 *   profile: undefined while loading, null when there isn't one yet
 */
export function useProfile(token, { enabled = true } = {}) {
  const [profile, setProfile] = useState(undefined);
  const [error, setError] = useState(null);
  const rev = useRef(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api("/profile", { token });
      rev.current = data?.rev || 0;
      setProfile(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err);
      return undefined;
    }
  }, [token]);

  useEffect(() => {
    // Loaded once the account is known; state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token && enabled) load();
  }, [token, enabled, load]);

  /** Saves content; throws ApiError (code "conflict" with the latest copy in err.data). */
  const save = useCallback(
    async (content, extra = {}) => {
      const body = Object.fromEntries(CONTENT_KEYS.map((k) => [k, content[k]]));
      if (content.summaries) body.summaries = content.summaries;
      const { data } = await api("/profile", { token, method: "PUT", body: { ...body, ...extra, baseRev: rev.current } });
      rev.current = data.rev;
      return data;
    },
    [token]
  );

  /** After a conflict: take their copy as the base (the next save overwrites it). */
  const adoptRev = useCallback((r) => (rev.current = r || 0), []);

  const remove = useCallback(async () => {
    await api("/profile", { token, method: "DELETE" });
    rev.current = 0;
    setProfile(null);
  }, [token]);

  return { profile, setProfile, error, load, save, adoptRev, remove, rev };
}
