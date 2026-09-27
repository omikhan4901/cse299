import Link from "next/link";
import LegalPage, { Contact } from "@/components/LegalPage";
import { SITE_NAME } from "@/lib/config";

export const metadata = {
  title: "Terms of Service",
  description: `The terms that apply when you use ${SITE_NAME}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" intro={`These terms apply when you use ${SITE_NAME}. By creating an account or using the builder, you agree to them.`}>
      <section>
        <h2>The service</h2>
        <p>{SITE_NAME} helps you write, design, check and share resumes. We may improve, change or discontinue features over time, and we&apos;ll try to give reasonable notice of major changes.</p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give accurate details and keep your password secure. You&apos;re responsible for activity on your account.</li>
          <li>You must be at least 16 years old to create an account.</li>
          <li>You can delete your account at any time from <Link className="text-brand hover:underline" href="/account">Account settings</Link>.</li>
        </ul>
      </section>

      <section>
        <h2>Your content</h2>
        <p>You own your resumes and everything you put in them. You give us permission to store, process and display that content only as needed to run the service — for example to generate your PDF, or to show a resume you&apos;ve chosen to share publicly. Only add information about other people (such as referees) with their permission.</p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don&apos;t use {SITE_NAME} for anything unlawful, misleading or harmful, including impersonating someone or creating fraudulent documents.</li>
          <li>Don&apos;t try to break, overload, scrape or get around the limits and security of the service.</li>
          <li>Fair-use limits apply, such as a daily number of AI requests per account.</li>
        </ul>
        <p className="mt-3">We may suspend accounts that break these rules.</p>
      </section>

      <section>
        <h2>AI suggestions and ATS scores</h2>
        <p>AI-generated text can be inaccurate. Review everything before you use it, and never include claims that aren&apos;t true. The ATS check estimates how well applicant tracking systems can read your resume based on common parsing behaviour and hiring guidelines. Employers configure their systems differently, so no score guarantees an interview or a job.</p>
      </section>

      <section>
        <h2>Paid plans</h2>
        <p>Some features may require a paid plan. The price, what&apos;s included, the billing period and the refund terms will be shown clearly before you pay, and form part of these terms.</p>
      </section>

      <section>
        <h2>Disclaimers and liability</h2>
        <p>{SITE_NAME} is provided &quot;as is&quot;. To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, lost opportunities or data loss, and our total liability is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits rights you have under consumer protection law.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>We may update these terms and will note the date at the top; significant changes will be announced in the app. Questions? <Contact />.</p>
      </section>
    </LegalPage>
  );
}
