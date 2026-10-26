"use client";

import { formatNaira } from "@billy/shared";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorText, PageLoader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

/**
 * Stand-in for the Paystack checkout while no Paystack key is set (local development).
 * No real money moves. With a real key, people go to Paystack's own page instead.
 */
export default function TestCheckoutPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TestCheckout />
    </Suspense>
  );
}

function TestCheckout() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? "";
  const amount = Number(params.get("amount") ?? 0);
  const callback = params.get("callback") ?? "/";
  const [channel, setChannel] = useState("bank_transfer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(outcome: "success" | "failed") {
    setBusy(true);
    try {
      await api("/dev/test-checkout/complete", { body: { reference, outcome, channel }, auth: false });
      window.location.href = callback;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-sm px-4 py-10">
      <div className="card space-y-4">
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">TEST CHECKOUT · no real money. Add a Paystack key to use real payments.</p>
        <div className="text-center">
          <p className="text-sm text-gray-500">Amount</p>
          <p className="text-3xl font-extrabold">{formatNaira(amount)}</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Pay with</legend>
          {[
            ["bank_transfer", "🏦 Bank transfer"],
            ["card", "💳 Card"],
            ["ussd", "📱 USSD"],
          ].map(([id, label]) => (
            <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${channel === id ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}>
              <input type="radio" name="channel" className="accent-brand-600" checked={channel === id} onChange={() => setChannel(id)} />
              {label}
            </label>
          ))}
        </fieldset>
        <ErrorText>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={busy} onClick={() => finish("success")}>
          {busy ? <Spinner className="border-white/40 border-t-white" /> : "Simulate successful payment"}
        </button>
        <button className="btn-ghost w-full" disabled={busy} onClick={() => finish("failed")}>
          Simulate failed payment
        </button>
      </div>
    </div>
  );
}
