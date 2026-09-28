const PROD_API = "https://cse299-1.onrender.com/api";
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? PROD_API : "http://localhost:5000/api")).origin;
  } catch {
    return "";
  }
})();

// Content Security Policy: only our own scripts, and the page may only talk to
// itself and the API. Blocks injected scripts from sending data anywhere else.
// (Inline scripts are needed by Next.js hydration; no eval in production.)
const csp = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the PDF engine run WebAssembly; it does not allow JavaScript eval.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}${process.env.NODE_ENV === "production" ? "" : " ws: http://localhost:*"}`.trim(),
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Routes from the old Vite app, kept so bookmarks keep working.
      { source: "/profile", destination: "/dashboard", permanent: true },
      { source: "/print", destination: "/builder", permanent: false },
    ];
  },
};

export default nextConfig;
