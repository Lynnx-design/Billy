"use client";

import { formatNaira, type PublicBillDto } from "@billy/shared";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ErrorText, Logo, PageLoader, ProgressBar, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { CHANNEL_LABELS, formatDateTime } from "@/lib/format";

interface VerifyResult {
  payment: { reference: string; status: "pending" | "success" | "failed"; amountKobo: number; channel: string | null; payerName: string; paidAt: string | null };
  bill: PublicBillDto;
}

export default function DonePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Receipt />
    </Suspense>
  );
}

function Receipt() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  // Paystack adds both ?reference= and ?trxref= to the callback.
  const reference = search.get("reference") ?? search.get("trxref") ?? "";
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!reference) return setError("Missing payment reference");
    let stop = false;
    api<VerifyResult>(`/pay/${slug}/verify?reference=${encodeURIComponent(reference)}`, { auth: false })
      .then((r) => {
        if (stop) return;
        setResult(r);
        // Bank transfers can take a minute to confirm. Keep checking for a few minutes.
        if (r.payment.status === "pending" && tries < 40) setTimeout(() => setTries((n) => n + 1), 5000);
      })
      .catch((err) => !stop && setError(errorMessage(err)));
    return () => {
      stop = true;
    };
  }, [slug, reference, tries]);

  const p = result?.payment;

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="mb-5 flex justify-center">
        <Logo size="sm" />
      </div>
      <ErrorText>{error}</ErrorText>
      {!result && !error && <PageLoader />}
      {p && result && (
        <div className="card text-center">
          {p.status === "success" && (
            <>
              <p className="text-5xl">🎉</p>
              <h1 className="mt-3 text-2xl font-bold">Payment successful</h1>
              <p className="mt-1 text-gray-600">{result.bill.sender.name} has been notified. Thank you!</p>
            </>
          )}
          {p.status === "pending" && (
            <>
              <Spinner className="h-10 w-10" />
              <h1 className="mt-3 text-2xl font-bold">Confirming your payment…</h1>
              <p className="mt-1 text-gray-600">Bank transfers can take a minute. You can keep this page open.</p>
            </>
          )}
          {p.status === "failed" && (
            <>
              <p className="text-5xl">😕</p>
              <h1 className="mt-3 text-2xl font-bold">Payment didn't go through</h1>
              <p className="mt-1 text-gray-600">You were not charged. Try again or use another method.</p>
              <Link href={`/b/${slug}`} className="btn-primary mt-4">
                Try again
              </Link>
            </>
          )}

          <dl className="mt-6 space-y-2 rounded-2xl bg-gray-50 p-4 text-left text-sm">
            <Row label="Amount" value={formatNaira(p.amountKobo)} />
            <Row label="For" value={`${result.bill.title} (${result.bill.sender.name})`} />
            <Row label="Paid by" value={p.payerName} />
            {p.channel && <Row label="Method" value={CHANNEL_LABELS[p.channel] ?? p.channel} />}
            {p.paidAt && <Row label="Date" value={formatDateTime(p.paidAt)} />}
            <Row label="Reference" value={p.reference} />
          </dl>

          {p.status === "success" && result.bill.remainingKobo > 0 && result.bill.payable && (
            <div className="mt-5 space-y-2">
              <ProgressBar value={result.bill.paidKobo} total={result.bill.totalKobo} />
              <p className="text-sm text-gray-600">{formatNaira(result.bill.remainingKobo)} left on this bill.</p>
              <Link href={`/b/${slug}`} className="btn-secondary">
                Pay more
              </Link>
            </div>
          )}
          {p.status === "success" && (
            <button className="btn-ghost mt-4" onClick={() => window.print()}>
              Save receipt
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="break-all text-right font-medium">{value}</dd>
    </div>
  );
}
