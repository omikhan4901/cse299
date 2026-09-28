"use client";

import { ConfigProvider, App } from "antd";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "./AuthProvider";
import AuthModal from "./AuthModal";
import { BillingProvider } from "./BillingProvider";

const theme = {
  token: {
    colorPrimary: "#007B7B",
    colorLink: "#007B7B",
    colorTextBase: "#0f1f2a",
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    borderRadius: 10,
  },
  components: {
    Button: { primaryShadow: "0 6px 16px -6px rgba(0,123,123,.5)", fontWeight: 500 },
  },
};

export default function Providers({ children }) {
  return (
    <MotionConfig reducedMotion="user">
    <ConfigProvider theme={theme}>
      <App>
        <AuthProvider>
          <BillingProvider>
            {children}
            <AuthModal />
          </BillingProvider>
        </AuthProvider>
      </App>
    </ConfigProvider>
    </MotionConfig>
  );
}
