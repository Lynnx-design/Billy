import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>This policy explains what Billy collects and why, in line with the Nigeria Data Protection Act.</p>
      <h2>What we collect</h2>
      <p>Your phone number, name, username, photo and bio; your payout bank details; the bills you create; and payment records. For people paying a bill, we store the name, optional email and optional message they enter.</p>
      <h2>How we use it</h2>
      <p>To run Billy: logging you in by SMS code, showing your bills, sending payments to your bank through Paystack, and sending you alerts. We don't sell your data.</p>
      <h2>Who we share it with</h2>
      <p>Paystack (payments), our SMS provider (login codes and alerts), and our hosting providers. The person you bill sees your name, photo and the bill, never your phone number or bank details.</p>
      <h2>Your rights</h2>
      <p>You can download your data or delete your account in Settings. Payment records may be kept as the law requires.</p>
    </LegalPage>
  );
}
