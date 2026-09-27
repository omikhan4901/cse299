import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Optional site-wide notice, e.g. NEXT_PUBLIC_ANNOUNCEMENT="Saving is paused for maintenance".
const announcement = process.env.NEXT_PUBLIC_ANNOUNCEMENT;

export default function SiteLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      {announcement ? <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">{announcement}</div> : null}
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
