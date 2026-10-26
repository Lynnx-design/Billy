"use client";

import { formatNaira, getRelationship, getTemplate, type BillDetailDto } from "@billy/shared";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ShareButtons } from "@/components/ShareButtons";
import { Timeline } from "@/components/Timeline";
import { ErrorText, PageLoader, ProgressBar, Spinner, StatusBadge } from "@/components/ui";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { CHANNEL_LABELS, daysLeft, formatDate, formatDateTime } from "@/lib/format";

export default function BillPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <BillDetail />
    </Suspense>
  );
}

function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const justCreated = useSearchParams().get("share") === "1";
  const router = useRouter();
  const [bill, setBill] = useState<BillDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<BillDetailDto>(`/bills/${id}`)
      .then(setBill)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => {
    load();
    // Keep the status fresh while she waits for him to pay.
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function action(name: string, path: string, method = "POST", confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(name);
    setError(null);
    try {
      const res = await api<BillDetailDto | { ok: true }>(path, { method });
      if (name === "delete") return router.replace("/dashboard");
      if (name === "duplicate" && "id" in res) return router.push(`/bills/${res.id}/edit`);
      if ("id" in res) setBill(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!bill) return error ? <ErrorText>{error}</ErrorText> : <PageLoader />;

  const t = getTemplate(bill.category);
  const active = bill.status === "open" || bill.status === "part_paid";
  const editable = (bill.status === "draft" || bill.status === "open") && bill.paidKobo === 0;
  const successful = bill.payments.filter((p) => p.status === "success");

  return (
    <div className="space-y-5">
      <Link href="/dashboard" className="text-sm font-medium text-brand-700">
        ← All bills
      </Link>

      {justCreated && active && (
        <div className="rounded-3xl bg-brand-600 p-5 text-white">
          <p className="text-lg font-bold">Your bill is ready 🎉</p>
          <p className="text-brand-100">Send the link to {bill.recipientName ?? "him"}. You'll get an alert when he opens it and when he pays.</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl" aria-hidden>
            {t.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-bold">{bill.title}</h1>
              <StatusBadge status={bill.status} />
            </div>
            <p className="text-sm text-gray-500">
              {bill.recipientName ? `To ${bill.recipientName} · ` : ""}
              {getRelationship(bill.relationship).label}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-3xl font-extrabold">{formatNaira(bill.totalKobo)}</p>
          {bill.paidKobo > 0 && (
            <div className="mt-3 space-y-1.5">
              <ProgressBar value={bill.paidKobo} total={bill.totalKobo} />
              <p className="text-sm text-gray-600">
                <strong>{formatNaira(bill.paidKobo)}</strong> paid
                {bill.status !== "paid" && <> · {formatNaira(bill.totalKobo - bill.paidKobo)} left</>}
              </p>
            </div>
          )}
          <p className="mt-3 text-sm text-gray-500">
            {active && <>⏰ {daysLeft(bill.expiresAt)} · </>}
            {bill.openedAt ? `👀 Opened ${bill.viewCount} ${bill.viewCount === 1 ? "time" : "times"}` : bill.status === "draft" ? "Draft, not shared yet" : "Not opened yet"}
            {" · "}
            {bill.allowPartial ? "Part payments on" : "Full payment only"}
            {bill.visibility === "public" ? " · On your page" : ""}
          </p>
          {bill.declineReason && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">He said: "{bill.declineReason}"</p>}
        </div>
      </div>

      {active && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Send it</h2>
          <ShareButtons url={bill.shareUrl} message={bill.shareMessage} phone={bill.recipientPhone} />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-brand-700">See the message</summary>
            <p className="mt-2 whitespace-pre-line rounded-2xl bg-gray-50 p-4 text-gray-700">{bill.shareMessage}</p>
          </details>
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap gap-2">
        {bill.status === "draft" && (
          <button className="btn-primary" disabled={!!busy} onClick={() => action("publish", `/bills/${id}/publish`)}>
            {busy === "publish" ? <Spinner className="border-white/40 border-t-white" /> : "Make link live"}
          </button>
        )}
        {editable && (
          <Link href={`/bills/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
        )}
        <button className="btn-secondary" disabled={!!busy} onClick={() => action("duplicate", `/bills/${id}/duplicate`)}>
          {busy === "duplicate" ? <Spinner /> : "Send again"}
        </button>
        {active && (
          <button className="btn-danger" disabled={!!busy} onClick={() => action("cancel", `/bills/${id}/cancel`, "POST", "Cancel this bill? The link will stop working.")}>
            Cancel bill
          </button>
        )}
        {bill.status === "draft" && (
          <button className="btn-danger" disabled={!!busy} onClick={() => action("delete", `/bills/${id}`, "DELETE", "Delete this draft?")}>
            Delete draft
          </button>
        )}
      </div>

      {(bill.items.length > 0 || bill.note || bill.photoUrls.length > 0) && (
        <div className="card space-y-4">
          {bill.items.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {bill.items.map((item) => (
                <li key={item.id} className="flex justify-between py-2 text-sm">
                  <span>{item.name}</span>
                  <span className="font-semibold">{formatNaira(item.amountKobo)}</span>
                </li>
              ))}
            </ul>
          )}
          {bill.note && <p className="whitespace-pre-line text-gray-700">{bill.note}</p>}
          {bill.photoUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bill.photoUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={apiUrl(url)} alt="" className="h-24 w-24 rounded-2xl object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {successful.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Payments</h2>
          <ul className="divide-y divide-gray-100">
            {successful.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex justify-between">
                  <span className="font-medium">{p.payerName}</span>
                  <span className="font-bold text-emerald-700">+{formatNaira(p.amountKobo)}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {p.paidAt ? formatDateTime(p.paidAt) : ""} · {CHANNEL_LABELS[p.channel ?? ""] ?? p.channel ?? "Paystack"}
                </p>
                {p.message && <p className="mt-1 text-sm text-gray-700">"{p.message}"</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 font-semibold">Timeline</h2>
        <Timeline events={bill.events} />
        <p className="mt-4 text-xs text-gray-400">Created {formatDate(bill.createdAt)}</p>
      </div>
    </div>
  );
}
