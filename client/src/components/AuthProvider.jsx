"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const AuthContext = createContext(null);
const TOKEN_KEY = "token";

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // "login" | "register" | null — which tab of the auth modal is open.
  const [authModal, setAuthModal] = useState(null);
  // Where to go after a successful sign-in from the modal.
  const [afterAuth, setAfterAuth] = useState(null);

  useEffect(() => {
    const stored = readToken();
    if (!stored) {
      // localStorage only exists in the browser, so the logged-out state is known after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    setToken(stored);
    api("/auth/me", { token: stored })
      .then((data) => setUser(data.user))
      .catch((err) => {
        // Only forget the token when the server rejects it, not when it is unreachable.
        if (err.status === 401 || err.status === 404) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const openAuth = useCallback((mode = "login", redirectTo = null) => {
    setAfterAuth(redirectTo);
    setAuthModal(mode);
  }, []);

  const login = useCallback(
    ({ token: newToken, user: newUser }, mode) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(newUser);
      setAuthModal(null);
      router.push(afterAuth || (mode === "register" ? "/builder" : "/dashboard"));
      setAfterAuth(null);
    },
    [router, afterAuth]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    router.push("/");
  }, [router]);

  const value = useMemo(
    () => ({ token, user, loading, isAuthenticated: !!user, login, logout, authModal, setAuthModal, openAuth }),
    [token, user, loading, login, logout, authModal, openAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
