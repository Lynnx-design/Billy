import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>Billy lets you create bills and payment requests and share them by link. By using Billy you agree to these terms.</p>
      <h2>Using Billy</h2>
      <p>You must be 18 or older and use your own phone number. You are responsible for the bills you send. Don't use Billy to scam, harass or pressure anyone, or to pretend to be someone else.</p>
      <h2>Payments</h2>
      <p>Payments are processed by Paystack and settle directly to the bank account you add. Billy does not hold your money. The Paystack fee is taken from the amount you receive. Payments are voluntary: the person you bill can pay, pay part, or decline.</p>
      <h2>Safety</h2>
      <p>People can decline your bills, stop you from sending them bills, and report you. We may suspend accounts that break these rules.</p>
      <h2>Your account</h2>
      <p>You can download your data or delete your account at any time in Settings.</p>
    </LegalPage>
  );
}
