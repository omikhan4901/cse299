import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';
import { API_BASE_URL } from "../Config/constraints";

// --- Contexts ---
export const AuthContext = createContext(null);
export const RouterContext = createContext(null);

// --- Router Component ---
export const BrowserRouter = ({ children }) => {
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
        const handlePopState = () => setPath(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigate = (newPath) => {
        if (newPath === path) return;
        window.history.pushState({}, '', newPath);
        setPath(newPath);
    };

    const value = useMemo(() => ({ path, navigate }), [path]);

    return (
        <RouterContext.Provider value={value}>
            {children}
        </RouterContext.Provider>
    );
};

// --- Custom Hook for Routing ---
export const useRouter = () => useContext(RouterContext);

// --- Auth Provider Component ---
export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const { navigate } = useRouter();

    const fetchUser = async (authToken) => {
        if (!authToken) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
            });
            const data = await response.json();
            if (data.success) {
                setUser(data.user);
            } else {
                console.warn("Token invalid, logging out.");
                logout(false);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            logout(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser(token);
    }, [token]);

    const login = (userData, redirect = true) => {
        localStorage.setItem('token', userData.token);
        setToken(userData.token);
        setUser(userData.user);
        if (redirect) navigate('/builder');
    };

    const logout = (redirect = true) => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        if (redirect) navigate('/login');
    };

    const value = useMemo(() => ({
        token, user, loading, login, logout, isAuthenticated: !!user,
    }), [token, user, loading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to access Auth Context easily
export const useAuth = () => useContext(AuthContext);
