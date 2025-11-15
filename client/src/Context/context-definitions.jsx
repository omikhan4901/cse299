import { createContext, useContext } from 'react';

/**
 * This file ONLY defines the contexts and their related hooks.
 * This separation solves the Vite HMR (Fast Refresh) incompatibility error
 * by not mixing component exports with hook/context exports.
 */

// 1. Context Definitions
export const AuthContext = createContext(null);
export const RouterContext = createContext(null);

// 2. Custom Hooks
export const useAuth = () => useContext(AuthContext);
export const useRouter = () => useContext(RouterContext);