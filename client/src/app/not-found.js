import Link from "next/link";
import Navbar from "@/components/Navbar";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="container-x flex min-h-[70vh] flex-col items-center justify-center text-center">
        <p className="font-display text-7xl font-extrabold text-brand-100">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">We couldn&apos;t find that page</h1>
        <p className="mt-2 max-w-md text-slate-500">If you followed a shared resume link, its owner may have made it private.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">Go home</Link>
          <Link href="/builder" className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-ink">Build a resume</Link>
        </div>
      </main>
    </>
  );
}
