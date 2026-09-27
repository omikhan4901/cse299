import ResetPasswordForm from "@/components/account/ResetPasswordForm";

export const metadata = { title: "Reset your password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-brand-50/70 to-white px-4 py-16">
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </div>
  );
}
