import React, { useState, useEffect } from 'react';
import { useAuth, useRouter } from "../../Context/context";
import { Input, Button, Card } from "../random";
import { API_BASE_URL } from "../../Config/constraints";

const AuthPage = ({ type }) => {
    const { navigate } = useRouter();
    const { login, isAuthenticated } = useAuth();
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const isRegister = type === 'register';

    useEffect(() => {
        if (isAuthenticated) navigate('/builder');
    }, [isAuthenticated, navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const endpoint = isRegister ? 'register' : 'login';
            const payload = isRegister ? formData : { email: formData.email, password: formData.password };

            const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                login(data);
            } else {
                setError(data.error || 'Authentication failed. Please check credentials/server.');
            }
        } catch (err) {
            setError('Network error. Check if the backend is running on port 5000.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-4 pt-16">
            <Card className="w-full max-w-md dark:bg-gray-700">
                <h2 className="text-3xl font-bold text-center mb-6 text-indigo-700 dark:text-indigo-400">
                    {isRegister ? 'Create Account' : 'Welcome Back'}
                </h2>
                <form onSubmit={handleSubmit}>
                    {isRegister && (
                        <Input label="Name" name="name" value={formData.name} onChange={handleChange} placeholder="Your Name" />
                    )}
                    <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" />
                    <Input label="Password" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" />

                    {error && (
                        <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-300" role="alert">
                            {error}
                        </div>
                    )}

                    <Button type="submit" loading={loading} className="w-full mt-2">
                        {isRegister ? 'Register' : 'Login'}
                    </Button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                    <Button variant="link" onClick={() => navigate(isRegister ? '/login' : '/register')}>
                        {isRegister ? 'Login' : 'Register'} here
                    </Button>
                </p>
            </Card>
        </div>
    );
};

export default AuthPage;
