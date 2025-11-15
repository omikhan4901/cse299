import React from 'react';
import { ConfigProvider } from 'antd';

// 1. FIX: Import Provider components from 'context.jsx'
import { BrowserRouter, AuthProvider } from "./Context/context";

// 2. FIX: Import hooks from 'context-definitions.jsx'
import { useAuth, useRouter } from "./Context/context-definitions";

import ResumeBuilder from "./Components/MainBuilder/MainBuilder";
import HomePage from "./Homepage";
import Navbar from "./Components/Navigation/Navbar";
import AboutPage from "./Components/About/AboutPage";
import AuthModal from "./Components/Authentication/AuthModal";

// --- Main App Component ---

const App = () => {
    const { path } = useRouter();
    const { isAuthenticated, loading } = useAuth();

    const renderRoute = () => {
        if (loading) {
            return <div className="min-h-screen flex items-center justify-center text-xl text-indigo-600 dark:text-indigo-400">Loading authentication state...</div>;
        }

        switch (path) {
            case '/':
                return <HomePage />;
            case '/about':
                return <AboutPage />;
            // Routes '/login' and '/register' are removed (handled by modal)
            case '/builder':
                // If not auth'd, show homepage. The Navbar's 'Get Started'
                // button will open the auth modal.
                return isAuthenticated ? <ResumeBuilder /> : <HomePage />;
            default:
                return <div className="min-h-screen flex items-center justify-center text-xl text-red-600">404 | Page Not Found</div>;
        }
    };

    return (
        <>
            <Navbar />
            <main>{renderRoute()}</main>
        </>
    );
};


// Root component wrapper for contexts
const AppWrapper = () => (
    <ConfigProvider
        theme={{
            token: {
                colorPrimary: '#007B7B',
                fontFamily: 'Inter, sans-serif',
                borderRadius: 8,
            },
        }}
    >
        {/* AuthProvider must be INSIDE BrowserRouter */}
        <BrowserRouter>
            <AuthProvider>
                <App />
                {/* The AuthModal is rendered here, outside 'App',
                    so it's controlled by the context. */}
                <AuthModal />
            </AuthProvider>
        </BrowserRouter>
    </ConfigProvider>
);

export default AppWrapper;