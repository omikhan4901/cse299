import React from 'react';
import { BrowserRouter, AuthProvider, useAuth, useRouter } from "./Context/context";
import { Navbar, Button, Icons } from "./Components/random";
import AuthPage from "./Components/Authentication/Authentication";
import ResumeBuilder from "./Components/MainBuilder/MainBuilder";

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
                return (
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4 pt-16 text-center bg-gray-100 dark:bg-gray-900">
                        <Icons.Zap className="w-20 h-20 text-indigo-600 dark:text-indigo-400 mb-4" />
                        <h2 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-4">Build Your Best Resume, Powered by AI</h2>
                        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mb-8">
                            Sign up to use our structured editor, live preview, and Gemini AI for refinement, chat-based editing, and parsing old resumes.
                        </p>
                        <Button onClick={() => isAuthenticated ? navigate('/builder') : navigate('/register')} className="py-3 px-8 text-lg">
                            {isAuthenticated ? 'Go to Builder' : 'Get Started'}
                        </Button>
                    </div>
                );
            case '/login':
                return <AuthPage type="login" />;
            case '/register':
                return <AuthPage type="register" />;
            case '/builder':
                // Client-side protection before server-side API calls
                return isAuthenticated ? <ResumeBuilder /> : <AuthPage type="login" />;
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
    <BrowserRouter>
        <AuthProvider>
            <App />
        </AuthProvider>
    </BrowserRouter>
);

export default AppWrapper;
