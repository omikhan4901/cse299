import React from 'react';
// ADDED Layout to the import list
import { ChevronRight, Loader2, Zap, LogIn, UserPlus, Home, Send, FileText, Upload, Plus, X, Download, User, Layout } from 'lucide-react';
import { useAuth, useRouter } from "../Context/context";

// --- Icons Map---
// ADDED Layout to the exported Icons object
export const Icons = { ChevronRight, Loader2, Zap, LogIn, UserPlus, Home, Send, FileText, Upload, Plus, X, Download, User, Layout };

// --- Basic UI Primitives ---

export const Button = ({ children, onClick, disabled = false, loading = false, variant = 'primary', className = '' }) => {
    const baseStyle = "px-4 py-2 font-semibold rounded-lg transition duration-150 flex items-center justify-center";
    let variantStyle = '';

    switch (variant) {
        case 'primary': variantStyle = 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'; break;
        case 'secondary': variantStyle = 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400'; break;
        case 'danger': variantStyle = 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'; break;
        case 'ai': variantStyle = 'bg-yellow-500 text-gray-800 hover:bg-yellow-600 focus:ring-yellow-400'; break;
        case 'link': variantStyle = 'text-indigo-600 hover:underline bg-transparent p-0'; break;
        default: variantStyle = 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500';
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`${baseStyle} ${variantStyle} focus:outline-none focus:ring-2 focus:ring-opacity-50 ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
            {loading && <Icons.Zap className="w-4 h-4 mr-2 animate-spin" />}
            {children}
        </button>
    );
};

export const Input = ({ label, type = 'text', name, value, onChange, placeholder, className = '', rows = 4 }) => (
    <div className={`mb-4 ${className}`}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        {type === 'textarea' ? (
            <textarea
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
        ) : (
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
        )}
    </div>
);

export const Card = ({ children, className = '' }) => (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
        {children}
    </div>
);

// --- Navbar and NavItem ---

export const NavItem = ({ icon: Icon, children, onClick, active = false }) => (
    <div
        className={`flex items-center space-x-2 p-2 rounded-lg transition duration-150 cursor-pointer 
            ${active ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        onClick={onClick}
    >
        {Icon && <Icon className="w-5 h-5" />}
        <span>{children}</span>
    </div>
);

export const Navbar = () => {
    const { navigate, path } = useRouter();
    const { user, logout } = useAuth();
    const isAuthenticated = !!user;

    return (
        <nav className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-lg z-50 fixed w-full top-0 print:hidden">
            <h1 className="text-2xl font-black text-indigo-700 dark:text-indigo-400 cursor-pointer transition-colors duration-150" onClick={() => navigate('/')}>
                AI Resume Builder
            </h1>
            <div className="flex items-center space-x-2 md:space-x-4">
                <NavItem icon={Icons.Home} onClick={() => navigate('/')} active={path === '/'}>Home</NavItem>
                {isAuthenticated ? (
                    <>
                        <NavItem icon={Icons.Zap} onClick={() => navigate('/builder')} active={path === '/builder'}>Builder</NavItem>
                        <Button variant="danger" onClick={logout} className="ml-2">Logout</Button>
                    </>
                ) : (
                    <>
                        <NavItem icon={Icons.LogIn} onClick={() => navigate('/login')} active={path === '/login'}>Login</NavItem>
                        <NavItem icon={Icons.UserPlus} onClick={() => navigate('/register')} active={path === '/register'}>Register</NavItem>
                    </>
                )}
            </div>
        </nav>
    );
};
