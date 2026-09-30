import { getPlans } from "@/lib/billing";
import PricingPlans from "@/components/billing/PricingPlans";
import { Reveal } from "@/components/motion";

export const metadata = {
  title: "Pricing",
  description: "Simple plans for every stage of your job search. Build, check and download your resume for free.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const config = await getPlans();
  return (
    <div className="bg-gradient-to-b from-brand-50/70 to-white">
      <div className="container-x py-14 md:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Simple, honest pricing</h1>
          <p className="mt-4 text-lg text-slate-600">
            Build, check and download your resume for free.{" "}
            {config?.v2?.enabled
              ? "Upgrade when you're job hunting: a Career Profile, every application tracked, a resume for each job, more templates and AI credits."
              : "Upgrade for more templates and AI credits when you're job hunting."}
          </p>
        </Reveal>
        {config ? (
          <PricingPlans config={config} />
        ) : (
          <p className="mt-16 text-center text-slate-500">Plans are loading slowly. Please refresh in a moment.</p>
        )}
      </div>
    </div>
  );
}
