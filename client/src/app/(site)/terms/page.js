import Link from "next/link";
import LegalPage, { Contact } from "@/components/LegalPage";
import { SITE_NAME, SELLER_NAME } from "@/lib/config";

export const metadata = {
  title: "Terms of Service",
  description: `The terms that apply when you use ${SITE_NAME}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" intro={`These terms apply when you use ${SITE_NAME}. By creating an account or using the builder, you agree to them.`}>
      <section>
        <h2>Who we are</h2>
        <p>{SITE_NAME} is operated by {SELLER_NAME}. In these terms, &quot;we&quot; and &quot;us&quot; means {SELLER_NAME}, trading as {SITE_NAME}.</p>
      </section>

      <section>
        <h2>The service</h2>
        <p>{SITE_NAME} helps you write, design, check and share resumes. We may improve, change or discontinue features over time, and we&apos;ll try to give reasonable notice of major changes.</p>
      </section>

      <section>
        <h2>Early access</h2>
        <p>{SITE_NAME} is in early access (beta). Features, limits and plans may change as we learn what works. To keep the service affordable and reliable, AI features can pause for everyone when the monthly AI budget is reached, and the site can go into short maintenance where you can view your work but not save. We&apos;ll say so on the site when either happens.</p>
      </section>

      <section>
        <h2>Campaign and invite access</h2>
        <p>Some people join through a campaign or invite code (for example from a university) that gives a plan or extra credits for a set time. When it ends, the account moves to the Free plan and nothing you made is deleted: your resumes stay in your account, and your Career Profile and applications are kept, ready if you upgrade. Codes are for the people they were given to; one account per person.</p>
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
          <li>Fair-use limits apply, such as AI credits, the size of what you send to the AI, and the number of resumes and tracked applications on your plan.</li>
        </ul>
        <p className="mt-3">We may suspend accounts that break these rules.</p>
      </section>

      <section>
        <h2>AI suggestions and ATS scores</h2>
        <p>AI-generated text can be inaccurate. Review everything before you use it, and never include claims that aren&apos;t true. The ATS check estimates how well applicant tracking systems can read your resume based on common parsing behaviour and hiring guidelines. Employers configure their systems differently, so no score guarantees an interview or a job.</p>
      </section>

      <section>
        <h2>Paid plans</h2>
        <p>Some features need a paid plan. The price, what&apos;s included and the billing period are shown before you pay.</p>
        <ul>
          <li>Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.</li>
          <li>Plans renew automatically each month or year until you cancel. You can cancel any time from Account › Manage billing and keep the plan until the end of the period you&apos;ve paid for.</li>
          <li>Refunds follow our <Link className="text-brand hover:underline" href="/refunds">Refund Policy</Link>, which forms part of these terms.</li>
        </ul>
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
