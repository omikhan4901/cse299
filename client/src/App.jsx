import React from "react";
import { ConfigProvider } from "antd";
import Footer from "./Components/Footer/Footer";
// 1. Providers from context.jsx
import { BrowserRouter, AuthProvider } from "./Context/context";

// 2. Hooks from context-definitions.jsx
import { useAuth, useRouter } from "./Context/context-definitions";

import ResumeBuilder from "./Components/MainBuilder/MainBuilder";
import HomePage from "./Homepage";
import Navbar from "./Components/Navigation/Navbar";
import AboutPage from "./Components/About/AboutPage";
import AuthModal from "./Components/Authentication/AuthModal";
import ProfilePage from "./Components/Profile/Profile";
import PublicResumeViewer from "./Components/Public/PublicResumeViewer";
// 3. NEW IMPORT: The dedicated component for printing
import PrintLayout from "./Components/Print/PrintLayout";

// --- Main App Component ---

const App = () => {
  const { path } = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const renderRoute = () => {
    if (loading)
      return (
        <div className="min-h-screen flex items-center justify-center text-xl text-indigo-600">
          Loading...
        </div>
      );

    // 2. ADD THIS CHECK BEFORE THE SWITCH
    // This handles dynamic routes like /view/12345
    if (path.startsWith("/view/")) {
      return <PublicResumeViewer />;
    }

    switch (path) {
      case "/":
        return <HomePage />;
      case "/about":
        return <AboutPage />;
      case "/builder":
        return isAuthenticated ? <ResumeBuilder /> : <HomePage />;
      case "/profile":
        return isAuthenticated ? <ProfilePage /> : <HomePage />;
      case "/print":
        return <PrintLayout />;
      default:
        return (
          <div className="min-h-screen flex items-center justify-center text-xl text-red-600">
            404 | Page Not Found
          </div>    
        );
    }
  };

  const isPrintRoute = path === "/print";

  return (
    // 2. WRAP IN FLEX CONTAINER FOR STICKY FOOTER
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {!isPrintRoute && <Navbar />}

      {/* 3. MAIN CONTENT GROWS TO FILL SPACE */}
      <main style={{ flex: 1 }}>{renderRoute()}</main>

      {/* 4. FOOTER (Hidden on Print Page) */}
      {!isPrintRoute && <Footer />}
    </div>
  );
};

const AppWrapper = () => (
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: "#007B7B",
        fontFamily: "Inter, sans-serif",
        borderRadius: 8,
      },
    }}
  >
    <BrowserRouter>
      <AuthProvider>
        <App />
        <AuthModal />
      </AuthProvider>
    </BrowserRouter>
  </ConfigProvider>
);

export default AppWrapper;
