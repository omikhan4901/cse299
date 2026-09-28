import Link from "next/link";
import LegalPage, { Contact } from "@/components/LegalPage";
import { SITE_NAME } from "@/lib/config";

export const metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses and protects your personal data and resume content.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro={`Your resume is personal. This policy explains what ${SITE_NAME} stores, why, who else sees it and how you stay in control.`}>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Account details:</b> your name, email address and a securely hashed password (we never see or store the password itself).</li>
          <li><b>Resume content:</b> everything you enter in the builder, including contact details, work history, references and an optional photo.</li>
          <li><b>Usage counters:</b> how many AI requests your account makes each day, so we can apply fair-use limits. These are deleted after a few days.</li>
          <li><b>Technical data:</b> our hosting providers keep standard server logs (such as IP address and browser type) for security and troubleshooting.</li>
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
        <h2>AI features</h2>
        <p>When you use an AI feature (the assistant, rewrites, cover letters or importing a resume), the relevant resume content is sent to Google&apos;s Gemini API to generate the answer and is handled under Google&apos;s API terms. We send only what the feature needs and never your password or photo. The ATS check itself runs in your browser and does not use AI.</p>
        <h2>The ATS checker</h2>
        <p>When you upload a PDF to the <Link href="/ats-checker">ATS checker</Link>, it&apos;s sent over an encrypted connection to our API, which extracts its text and returns it to your browser, where the checks run. The file is held in memory only while it&apos;s read. It isn&apos;t saved, logged or used for anything else, and no AI is involved. We count checks per network address to keep the free checker fair, and those counts expire within the hour.</p>
      </section>

      <section>
        <h2>Public resumes</h2>
        <p>Resumes are private by default. If you turn on sharing, anyone with the link can view and download that resume, and search engines may index the page. Turn sharing off at any time to remove access.</p>
      </section>

      <section>
        <h2>Cookies and local storage</h2>
        <p>We don&apos;t use tracking cookies. Your browser&apos;s local storage keeps you signed in and holds unsaved drafts; clearing your browser data removes them.</p>
      </section>

      <section>
        <h2>Who processes your data</h2>
        <p>We rely on trusted providers to run {SITE_NAME}: cloud hosting for the website and API, a managed database, Google (Gemini) for AI features and an email provider for account emails. They process data only to provide their service to us.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>We keep your account and resumes until you delete them. Deleted resumes and accounts are removed from our database immediately; backups are overwritten on a rolling basis.</p>
      </section>

      <section>
        <h2>Your rights and choices</h2>
        <ul>
          <li><b>Access and portability:</b> download all your data from <Link className="text-brand hover:underline" href="/account">Account settings</Link>.</li>
          <li><b>Correction:</b> edit your resumes and name at any time.</li>
          <li><b>Deletion:</b> delete individual resumes, or your whole account from Account settings.</li>
          <li>Depending on where you live (for example the EU/UK under the GDPR), you may have further rights, such as objecting to processing or complaining to a data protection authority.</li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>Passwords are hashed with bcrypt, connections are encrypted in transit, every part of the service is rate-limited, and changing your password signs out every other device. You can turn on two-factor authentication with an authenticator app; admin accounts must use it, and admin actions are recorded in an audit log. Two-factor secrets are encrypted at rest. No system is perfectly secure, so please use a strong, unique password.</p>
      </section>

      <section>
        <h2>Children</h2>
        <p>{SITE_NAME} is not intended for children under 16, and we don&apos;t knowingly collect their data.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>We&apos;ll update this page when our practices change and note the date at the top. For privacy questions or requests, <Contact />.</p>
      </section>
    </LegalPage>
  );
}
