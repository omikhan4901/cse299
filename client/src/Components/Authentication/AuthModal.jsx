import React, { useState, useEffect } from 'react';
import { useAuth } from "../../Context/context-definitions"; // Corrected import
import { Modal, Form, Input, Button, Alert, Tabs, Typography, Divider } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { API_BASE_URL } from "../../Config/constraints";

const { Title } = Typography;

const AuthModal = () => {
    // 1. Get modal state and actions from Auth context
    const { authModalOpen, setAuthModalOpen, login } = useAuth();
    
    // 2. THE FIX: Create TWO separate form instances
    const [loginFormInstance] = Form.useForm();
    const [registerFormInstance] = Form.useForm();
    
    // State for loading and API errors
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const activeKey = authModalOpen;

    // 3. Reset *both* forms when the modal opens or tab changes
    useEffect(() => {
        if (authModalOpen) {
            loginFormInstance.resetFields();
            registerFormInstance.resetFields();
            setError(null);
        }
    }, [authModalOpen, loginFormInstance, registerFormInstance]);

    // Handler to close the modal
    const handleClose = () => {
        setAuthModalOpen(null);
    };

    // 4. Create a generic handler to call the API
    const handleAuth = async (endpoint, payload) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (data.success) {
                login(data); // This comes from context, closes modal, redirects
            } else {
                setError(data.error || 'Authentication failed.');
            }
        } catch (err) {
            setError('Network error. Could not connect to server.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // 5. Create two separate onFinish handlers
    const onLoginFinish = (values) => {
        handleAuth('login', { email: values.email, password: values.password });
    };

    const onRegisterFinish = (values) => {
        handleAuth('register', { name: values.name, email: values.email, password: values.password });
    };

    // --- Login Tab Form ---
    const loginForm = (
        <Form 
            form={loginFormInstance} // Use login form instance
            onFinish={onLoginFinish} // Use login finish handler
            layout="vertical" 
            name="loginForm"
        >
            <Form.Item
                name="email"
                rules={[{ required: true, type: 'email', message: 'Please input a valid email!' }]}
            >
                <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
            </Form.Item>
            <Form.Item
                name="password"
                rules={[{ required: true, message: 'Please input your password!' }]}
            >
                <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>
            <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block size="large">
                    Log in
                </Button>
            </Form.Item>
        </Form>
    );

    // --- Register Tab Form ---
    const registerForm = (
        <Form 
            form={registerFormInstance} // Use register form instance
            onFinish={onRegisterFinish} // Use register finish handler
            layout="vertical" 
            name="registerForm"
        >
            <Form.Item
                name="name"
                rules={[{ required: true, message: 'Please input your name!' }]}
            >
                <Input prefix={<UserOutlined />} placeholder="Name" size="large" />
            </Form.Item>
            <Form.Item
                name="email"
                rules={[{ required: true, type: 'email', message: 'Please input a valid email!' }]}
            >
                <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
            </Form.Item>
            <Form.Item
                name="password"
                rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters!' }]}
            >
                <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>
            <Form.Item
                name="confirm"
                dependencies={['password']}
                rules={[
                    { required: true, message: 'Please confirm your password!' },
                    ({ getFieldValue }) => ({
                        validator(_, value) {
                            if (!value || getFieldValue('password') === value) {
                                return Promise.resolve();
                            }
                            return Promise.reject(new Error('The two passwords do not match!'));
                        },
                    }),
                ]}
            >
                <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" size="large" />
            </Form.Item>
            <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block size="large">
                    Create Account
                </Button>
            </Form.Item>
        </Form>
    );

    // --- Tab definitions ---
    const tabItems = [
        {
            label: `Login`,
            key: 'login',
            children: loginForm,
        },
        {
            label: `Sign Up`,
            key: 'register',
            children: registerForm,
        },
    ];

    return (
        <Modal
            open={!!authModalOpen}
            onCancel={handleClose}
            footer={null} 
            destroyOnHidden={true} 
            centered
        >
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <Title level={3} style={{ color: '#007B7B', margin: 0 }}>ResumeX</Title>
                <Divider style={{ margin: '16px 0' }} />
            </div>

            {error && (
                <Alert message={error} type="error" showIcon closable style={{ marginBottom: 24 }} />
            )}
            
            <Tabs
                activeKey={activeKey}
                onChange={(key) => setAuthModalOpen(key)}
                items={tabItems}
                centered
                size="large"
                // This prop is still good. It fixes the "duplicate ID" console warnings.
                // The separate form instances fix the "login not working" bug.
                // We need both.
                destroyinactivetab="true"
            />
        </Modal>
    );
};

export default AuthModal;