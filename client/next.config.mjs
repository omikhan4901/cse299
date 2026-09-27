/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Routes from the old Vite app, kept so bookmarks keep working.
      { source: "/profile", destination: "/dashboard", permanent: true },
      { source: "/print", destination: "/builder", permanent: false },
    ];
  },
};

export default nextConfig;
