/**
 * context.jsx
 * Global State Management.
 * Implements Authentication Provider and a custom Router solution for navigation.
 */
import React, { useState, useEffect, useMemo, useContext } from "react";
import { API_BASE_URL } from "../Config/constraints";

// 1. Import the contexts from our definitions file
import { AuthContext, RouterContext } from "./context-definitions";

/**
 * Provides a simple, custom routing solution (path, navigate)
 */
export const BrowserRouter = ({ children }) => {
  const [path, setPath] = useState(window.location.pathname);

  // Listen for browser's back/forward button clicks
  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // The navigate function for all components to use
  const navigate = (newPath, state = {}) => {
    if (newPath === path) return;

    // Pass the state object to pushState
    window.history.pushState(state, "", newPath);
    setPath(newPath);
  };
  const value = useMemo(() => ({ path, navigate }), [path]);

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
};

// --- Custom Hook for Routing (REMOVED) ---
// export const useRouter = () => useContext(RouterContext); // <-- Moved to definitions

/**
 * Provides the application-wide authentication state.
 * (token, user, login, logout)
 * It ALSO manages the state of the authentication modal.
 */
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Loading user data on initial page load

  // Can be 'login', 'register', or null (closed)
  const [authModalOpen, setAuthModalOpen] = useState(null);

  // We need to get 'navigate' here, but we can't use the hook
  // since it's not defined in this file.
  // We'll consume the RouterContext directly.
  const router = useContext(RouterContext);

  // This effect runs on app start to check if a token is valid
  const fetchUser = async (authToken) => {
    if (!authToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
      } else {
        console.warn("Token invalid, logging out.");
        logout(false); // Don't redirect
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      logout(false); // Don't redirect
    } finally {
      setLoading(false);
    }
  };

  // Run fetchUser once when the provider loads
  useEffect(() => {
    fetchUser(token);
  }, [token]);

  // Called from AuthModal on successful API call
  const login = (userData, redirect = true) => {
    localStorage.setItem("token", userData.token);
    setToken(userData.token);
    setUser(userData.user);
    setAuthModalOpen(null); // Close modal on successful login
    if (redirect && router) router.navigate("/builder"); // Use router.navigate
  };

  // Called from Navbar
  const logout = (redirect = true) => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setAuthModalOpen(null); // Ensure modal is closed
    if (redirect && router) router.navigate("/"); // Use router.navigate
  };

  // The value provided to all consumers of the context
  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user,
      authModalOpen,
      setAuthModalOpen, // Expose this to open/close the modal
    }),
    [token, user, loading, authModalOpen, setAuthModalOpen, router]
  ); // Add router to dependency

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Custom Hook for Auth (REMOVED) ---
// export const useAuth = () => useContext(AuthContext); // <-- Moved to definitions
