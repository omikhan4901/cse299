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
          <li>You must be at least 18 years old to create an account. Anyone can use the builder without an account.</li>
          <li>You can delete your account at any time from <Link className="text-brand hover:underline" href="/account">Account settings</Link>.</li>
        </ul>
      </section>

      <section>
        <h2>Your content</h2>
        <p>You own your resumes and everything you put in them. You give us permission to store, process and display that content only as needed to run the service — for example to generate your PDF, or to show a resume you&apos;ve chosen to share publicly. Only add information about other people (such as referees) with their permission.</p>
      </section>

      <section>
        <h2>Our service and templates</h2>
        <p>{SITE_NAME}, its design, templates and code belong to us. You can use, send, print and share the resumes you make with them as you like. Please don&apos;t copy, resell or redistribute the templates or the service itself.</p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don&apos;t use {SITE_NAME} for anything unlawful, misleading or harmful, including impersonating someone or creating fraudulent documents.</li>
          <li>Don&apos;t try to break, overload, scrape or get around the limits and security of the service.</li>
          <li>Fair-use limits apply, such as AI credits, the size of what you send to the AI, and the number of resumes and tracked applications on your plan.</li>
        </ul>
      </section>

      <section>
        <h2>Reporting content</h2>
        <p>If a shared resume uses your work or your personal details without permission, <Contact /> with the link. We&apos;ll look into it and remove it where appropriate.</p>
      </section>

      <section>
        <h2>Suspending or closing accounts</h2>
        <p>You can stop using {SITE_NAME} and delete your account at any time. We may suspend or close an account that breaks these terms or the law, or to protect other people or the service. Where it&apos;s reasonable, we&apos;ll tell you first and give you a chance to download your data. If we ever shut {SITE_NAME} down, we&apos;ll give at least 30 days&apos; notice so you can download your resumes.</p>
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
        <p>{SITE_NAME} is provided &quot;as is&quot;. We work to keep it available and your data safe, but we can&apos;t promise it will always be available or free of errors, so keep a downloaded copy of resumes that matter to you. To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, lost opportunities or data loss, and our total liability is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits rights you have under consumer protection law.</p>
        <p className="mt-3">If you break these terms or the law while using {SITE_NAME} and someone makes a claim against us because of it, you&apos;re responsible for that claim, to the extent the law allows.</p>
      </section>

      <section>
        <h2>Other services</h2>
        <p>Some parts of {SITE_NAME} rely on other companies, such as Paddle for payments and Google for AI features. Their own terms apply to what they provide.</p>
      </section>

      <section>
        <h2>Disputes and governing law</h2>
        <p>If something goes wrong, please <Contact /> first so we can try to put it right. These terms are governed by the laws of Bangladesh, and the courts of Dhaka will hear any dispute. If you&apos;re a consumer living elsewhere, you also keep the protection of the laws where you live and can bring a claim there.</p>
      </section>

      <section>
        <h2>General</h2>
        <p>These terms, the <Link className="text-brand hover:underline" href="/privacy">Privacy Policy</Link> and the <Link className="text-brand hover:underline" href="/refunds">Refund Policy</Link> are the whole agreement between you and us. If a part of them can&apos;t be enforced, the rest still applies. If we don&apos;t enforce a right straight away, we haven&apos;t given it up.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>We may update these terms and will note the date at the top. Significant changes will be announced in the app before they take effect; if you keep using {SITE_NAME} after that, the new terms apply, and if you don&apos;t agree you can delete your account. Questions? <Contact />.</p>
      </section>
    </LegalPage>
  );
}
