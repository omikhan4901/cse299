import { getCampaign } from "@/lib/billing";
import JoinCampaign from "@/components/billing/JoinCampaign";
import { BuilderLink } from "@/components/BuilderLauncher";

export const metadata = { title: "Join ResumeX", robots: { index: false, follow: false } };

export default async function JoinPage({ params }) {
  const { code } = await params;
  const { campaign, error } = await getCampaign(code);
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-brand-50/70 to-white px-4 py-16">
      {campaign && !campaign.problem ? (
        <JoinCampaign campaign={campaign} />
      ) : (
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold text-ink">This invite can&apos;t be used</h1>
          <p className="mt-2 text-slate-600">{campaign?.problem || error}</p>
          <BuilderLink className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white">Try the builder anyway</BuilderLink>
        </div>
      )}
    </div>
  );
}
