import Navbar from "@/components/Navbar";

export const metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar compact />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
