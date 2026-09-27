"use client";

import { useState } from "react";
import { Modal, Form, Input, Button, Alert, Segmented } from "antd";
import { Mail, Lock, User } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import Logo from "./Logo";

export default function AuthModal() {
  const { authModal, setAuthModal } = useAuth();
  const mode = authModal || "login";
  return (
    <Modal open={!!authModal} onCancel={() => setAuthModal(null)} footer={null} centered width={420} destroyOnHidden>
      <AuthForm key={mode} mode={mode} onModeChange={setAuthModal} />
    </Modal>
  );
}

function AuthForm({ mode, onModeChange }) {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isRegister = mode === "register";

  const submit = async (values) => {
    setLoading(true);
    setError(null);
    try {
      const payload = isRegister ? { name: values.name, email: values.email, password: values.password } : { email: values.email, password: values.password };
      const data = await api(`/auth/${isRegister ? "register" : "login"}`, { method: "POST", body: payload });
      login(data, mode);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center pt-2 pb-4 text-center">
        <Logo />
        <h2 className="mt-4 text-xl font-semibold text-ink">{isRegister ? "Create your free account" : "Welcome back"}</h2>
        <p className="mt-1 text-sm text-slate-500">{isRegister ? "Save resumes, share links and download PDFs." : "Log in to keep working on your resumes."}</p>
      </div>
      <Segmented
        block
        value={mode}
        onChange={onModeChange}
        options={[
          { label: "Log in", value: "login" },
          { label: "Sign up", value: "register" },
        ]}
        className="mb-5"
      />
      {error ? <Alert type="error" showIcon title={error} className="mb-4" /> : null}
      <Form layout="vertical" onFinish={submit} requiredMark={false}>
        {isRegister ? (
          <Form.Item name="name" rules={[{ required: true, message: "Please enter your name" }]}>
            <Input size="large" prefix={<User size={16} className="text-slate-400" />} placeholder="Full name" autoComplete="name" />
          </Form.Item>
        ) : null}
        <Form.Item name="email" rules={[{ required: true, type: "email", message: "Please enter a valid email" }]}>
          <Input size="large" prefix={<Mail size={16} className="text-slate-400" />} placeholder="Email" autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, min: isRegister ? 6 : 1, message: isRegister ? "At least 6 characters" : "Please enter your password" }]}>
          <Input.Password size="large" prefix={<Lock size={16} className="text-slate-400" />} placeholder="Password" autoComplete={isRegister ? "new-password" : "current-password"} />
        </Form.Item>
        {isRegister ? (
          <Form.Item
            name="confirm"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator: (_, value) => (!value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("Passwords do not match"))),
              }),
            ]}
          >
            <Input.Password size="large" prefix={<Lock size={16} className="text-slate-400" />} placeholder="Confirm password" autoComplete="new-password" />
          </Form.Item>
        ) : null}
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          {isRegister ? "Create account" : "Log in"}
        </Button>
      </Form>
      <p className="mt-4 text-center text-xs text-slate-400">The first request can take up to a minute while our free server wakes up.</p>
    </>
  );
}
