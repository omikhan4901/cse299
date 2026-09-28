import Link from "next/link";
import LegalPage, { Contact } from "@/components/LegalPage";
import { SITE_NAME, SELLER_NAME } from "@/lib/config";

export const metadata = {
  title: "Refund Policy",
  description: `When you can get a refund for a ${SITE_NAME} plan, and how to ask for one.`,
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      intro={`We want you to be happy with ${SITE_NAME}. If a paid plan isn't right for you, here's when you can get your money back and how.`}
    >
      <section>
        <h2>Who handles payments</h2>
        <p>
          {SITE_NAME} is operated by {SELLER_NAME}. Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our
          orders, and refunds are issued by Paddle to the original payment method.
        </p>
      </section>

      <section>
        <h2>14-day refund on your first payment</h2>
        <p>
          If you&apos;re not satisfied, you can ask for a full refund within <b>14 days of your first payment</b> for a plan, monthly or yearly, as long as you&apos;ve
          used <b>less than 10% of the plan&apos;s AI credits</b> in that time. The limit is there because each AI credit costs us money to provide, and it stops
          the refund being used to get paid features for free.
        </p>
      </section>

      <section>
        <h2>Renewals and cancelling</h2>
        <ul>
          <li>You can cancel at any time from <Link className="text-brand hover:underline" href="/account">Account</Link> › Manage billing. You won&apos;t be charged again.</li>
          <li>You keep your paid plan until the end of the period you&apos;ve paid for, then move to the Free plan. Your resumes are never deleted.</li>
          <li>Renewal payments aren&apos;t refunded, so please cancel before your renewal date if you no longer need the plan. Your account page shows the date.</li>
          <li>Switching between plans is prorated automatically: you pay, or are credited, the difference for the rest of the billing period.</li>
        </ul>
      </section>

      <section>
        <h2>Always refunded</h2>
        <ul>
          <li>Being charged twice for the same thing.</li>
          <li>Being charged after you cancelled.</li>
          <li>A fault on our side that stopped you using the paid features you paid for.</li>
        </ul>
      </section>

      <section>
        <h2>How to ask</h2>
        <p>
          Reply to the receipt Paddle emailed you, or <Contact /> with the email address you paid with. We&apos;ll reply within 2 business days. Approved refunds
          usually reach your account within 5 to 10 business days, depending on your bank.
        </p>
        <p>When a refund is issued, the paid plan ends straight away. Your account and resumes stay, on the Free plan.</p>
      </section>

      <section>
        <h2>Your legal rights</h2>
        <p>
          This policy doesn&apos;t limit any rights you have under the consumer protection laws of your country, or under{" "}
          <a className="text-brand hover:underline" href="https://www.paddle.com/legal/buyer-terms" target="_blank" rel="noopener noreferrer">Paddle&apos;s buyer terms</a>.
        </p>
      </section>
    </LegalPage>
  );
}
