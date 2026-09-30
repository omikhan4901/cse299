import Link from "next/link";
import LegalPage, { Contact } from "@/components/LegalPage";
import { SITE_NAME, SELLER_NAME } from "@/lib/config";

export const metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses and protects your personal data and resume content.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro={`Your resume is personal. This policy explains what ${SITE_NAME} stores, why, who else sees it and how you stay in control.`}>
      <section>
        <h2>Who is responsible</h2>
        <p>{SITE_NAME} is run by {SELLER_NAME} in Bangladesh, who decides how your personal data is used (the &ldquo;data controller&rdquo;, or &ldquo;data fiduciary&rdquo; under Bangladesh&apos;s Personal Data Protection Act). For anything about your data, <Contact />.</p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Account details:</b> your name, email address and a securely hashed password (we never see or store the password itself).</li>
          <li><b>Resume content:</b> everything you enter in the builder, including contact details, work history, references and an optional photo. If you add biodata details to a resume (such as parents&apos; names and addresses), they are kept in that resume only, are never shown on share links and are never sent to the AI. We never ask for national ID numbers.</li>
          <li><b>Career Profile:</b> if you set one up, the career details you keep in it (the same kind of content as a resume). We don&apos;t ask for or keep sensitive identity details such as national ID numbers.</li>
          <li><b>Job applications:</b> if you track applications, the job details you save (such as the job post, deadlines and notes), the contacts you add, and a copy of the resume you sent. Links you ask us to read are fetched by our server once to fill in the job details. We email you reminders about your own deadlines and interviews, and a weekly digest, unless you turn them off in your account settings or with the link in any of those emails.</li>
          <li><b>Usage records:</b> for each AI request, which feature it was, how many credits it used and how much text went in and out (not the text itself), to apply fair-use limits and keep costs in check. When you download a PDF, which template it used, to apply the <Link href="/refunds">Refund Policy</Link>.</li>
          <li><b>Payments:</b> if you buy a plan, Paddle (our reseller and merchant of record) takes the payment. We never see or store your card details. Paddle tells us your plan, what was charged and refunded, and your billing country, and we keep those records for accounting even after an account is deleted (without the link to the account).</li>
          <li><b>Upgrade steps:</b> when a paid feature is shown to you as locked, or you open the checkout, we note that it happened and from which feature, to understand which features are worth paying for. Only the step is recorded, not your content. These records are deleted with your account, or after about 13 months.</li>
          <li><b>Technical data:</b> our hosting providers keep standard server logs (such as IP address and browser type) for security and troubleshooting.</li>
          <li><b>Feedback you send:</b> your message, the page you were on, a screenshot if you add one, and your email so we can reply. We use it only to improve ResumeX and to answer you.</li>
          <li><b>Error reports:</b> when something breaks, the site sends us the error and the page address (without anything after the &ldquo;?&rdquo;). Emails and long numbers are removed before we store it.</li>
          <li><b>How you found us:</b> when you sign up we note whether you used a campaign code, the tag of the link you arrived by (for example &ldquo;ref=fb-post&rdquo;), and a scrambled code for your network (not your IP address) so we can spot mass sign-ups.</li>
        </ul>
        <p className="mt-3">You can use the builder without an account. In that case your draft stays in your own browser and is never sent to us unless you save it or use an AI feature.</p>
        <p className="mt-3"><b>Private sessions</b> go further: nothing is saved on our servers or in your browser, and the resume disappears when you close the tab. You can download your PDF, or save a file to your own device and open it again later. The PDF and the ATS check are created entirely in your browser.</p>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To provide the service: save your resumes, generate PDFs, run the ATS check and show public pages you choose to share.</li>
          <li>To keep accounts secure, prevent abuse and enforce limits.</li>
          <li>To send essential emails, such as password reset links. We don&apos;t send marketing emails without your consent.</li>
        </ul>
        <p className="mt-3">We don&apos;t sell your data, show ads or use advertising trackers.</p>
      </section>

      <section>
        <h2>Why we&apos;re allowed to use it</h2>
        <ul>
          <li><b>To provide what you signed up for:</b> your account, resumes, Career Profile, applications, reminders and any plan you buy.</li>
          <li><b>Your consent:</b> you agree to this policy when you create an account, and you choose when to use AI features, share a resume publicly or send feedback. You can withdraw consent at any time by stopping that use, turning emails off or deleting your account.</li>
          <li><b>Legitimate interests:</b> keeping {SITE_NAME} secure and fair (limits, abuse checks, error reports) and understanding how people find us.</li>
          <li><b>The law:</b> keeping payment records for accounting and tax.</li>
        </ul>
      </section>

      <section>
        <h2>AI features</h2>
        <p>When you use an AI feature (the assistant, rewrites, cover letters, importing a resume, or help with a specific job), the relevant resume content, and for job help the job description you saved, is sent to Google&apos;s Gemini models (through the Gemini API or Google Cloud&apos;s Vertex AI) to generate the answer and is handled under Google&apos;s terms for those services. We send only what the feature needs and never your password or photo. The ATS check itself runs in your browser and does not use AI.</p>
        <h2>The ATS checker</h2>
        <p>When you upload a PDF to the <Link href="/ats-checker">ATS checker</Link>, it&apos;s sent over an encrypted connection to our API, which extracts its text and returns it to your browser, where the checks run. The file is held in memory only while it&apos;s read. It isn&apos;t saved, logged or used for anything else, and no AI is involved. We count checks per network address to keep the free checker fair, and those counts expire within the hour.</p>
      </section>

      <section>
        <h2>Public resumes</h2>
        <p>Resumes are private by default. If you turn on sharing, anyone with the link can view and download that resume, and search engines may index the page. Turn sharing off at any time to remove access.</p>
      </section>

      <section id="cookies" className="scroll-mt-24">
        <h2>Cookies and local storage</h2>
        <p>We don&apos;t use advertising or analytics cookies, or any tracker that follows you across sites, so there&apos;s no cookie banner to click. {SITE_NAME} keeps only a few things in your browser&apos;s local storage, each needed for the site to work as you asked:</p>
        <ul>
          <li><b>Your sign-in</b>, until you log out.</li>
          <li><b>An unsaved draft</b> of the resume you&apos;re working on without an account, until you save it or clear it (never in a private session).</li>
          <li><b>An invite code or the tag of the link you came from</b>, for 30 days, sent once when you sign up.</li>
          <li><b>Small display choices</b>, such as list or board view, and whether you&apos;ve seen a welcome message.</li>
        </ul>
        <p className="mt-3">When you open the checkout, Paddle&apos;s payment form may set its own cookies needed for the payment and to prevent fraud, under <a className="text-brand hover:underline" href="https://www.paddle.com/legal/privacy" target="_blank" rel="noreferrer">Paddle&apos;s privacy policy</a>. Our fonts are served from our own site. Clearing your browser data removes everything above.</p>
      </section>

      <section>
        <h2>Who processes your data</h2>
        <p>We rely on these providers to run {SITE_NAME}. They process data only to provide their service to us:</p>
        <ul>
          <li><b>Vercel</b>: hosts the website.</li>
          <li><b>Google Cloud</b>: runs our servers, and Google&apos;s Gemini models for AI features.</li>
          <li><b>MongoDB Atlas</b>: our database.</li>
          <li><b>Paddle</b>: payments, as merchant of record.</li>
          <li><b>Our email provider</b>: account emails and reminders.</li>
        </ul>
        <p className="mt-3"><b>Where your data is stored:</b> these providers&apos; servers are outside Bangladesh (for example in India, Singapore, the EU or the United States). We use established providers with strong security and contractual safeguards, and send them only what&apos;s needed. By creating an account you agree to your data being processed there.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li><b>Your account, resumes, Career Profile and applications:</b> until you delete them. Deleting removes them from our database straight away.</li>
          <li><b>Feedback:</b> two years, or until you delete your account.</li>
          <li><b>Error reports:</b> 90 days after the error last happened.</li>
          <li><b>AI usage records:</b> 180 days. <b>PDF download records:</b> 12 months. <b>Upgrade steps:</b> about 13 months.</li>
          <li><b>Limit counters:</b> from an hour to a few days. <b>Server logs</b> at our hosting providers: about 30 days.</li>
          <li><b>Payment records:</b> as long as accounting and tax law requires, without the link to your account once it&apos;s deleted.</li>
          <li><b>Backups:</b> we keep about a month of weekly backups, so deleted data is gone from them within about five weeks.</li>
        </ul>
      </section>

      <section>
        <h2>Your rights and choices</h2>
        <ul>
          <li><b>Access and portability:</b> download all your data from <Link className="text-brand hover:underline" href="/account">Account settings</Link>.</li>
          <li><b>Correction:</b> edit your resumes, Career Profile and name at any time.</li>
          <li><b>Deletion:</b> delete individual resumes, or your whole account (with your Career Profile) from Account settings.</li>
          <li><b>Withdrawing consent:</b> stop using a feature, turn emails off in Account settings or with the link in any email, or delete your account.</li>
          <li>Under Bangladesh&apos;s Personal Data Protection Act, the GDPR in the EU/UK and similar laws, you may have further rights, such as asking what we hold about you or objecting to how it&apos;s used.</li>
        </ul>
        <p className="mt-3">To use any of these rights, <Contact /> from the address on your account. We&apos;ll reply within 30 days. If you&apos;re not happy with our answer, you can complain to the data protection authority where you live.</p>
      </section>

      <section>
        <h2>Security</h2>
        <p>Passwords are hashed with bcrypt, connections are encrypted in transit, every part of the service is rate-limited, and changing your password signs out every other device. You can turn on two-factor authentication with an authenticator app; admin accounts must use it, and admin actions are recorded in an audit log. Two-factor secrets are encrypted at rest. No system is perfectly secure, so please use a strong, unique password. If a breach is likely to put you at risk, we&apos;ll tell you and the authorities as the law requires.</p>
      </section>

      <section>
        <h2>Children</h2>
        <p>You must be 18 or older to create an account, and we don&apos;t knowingly collect data from anyone younger. If you think someone under 18 has an account, <Contact /> and we&apos;ll delete it. Anyone can use the builder without an account; then the resume stays in your own browser.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>We&apos;ll update this page when our practices change and note the date at the top. For privacy questions or requests, <Contact />.</p>
      </section>
    </LegalPage>
  );
}
