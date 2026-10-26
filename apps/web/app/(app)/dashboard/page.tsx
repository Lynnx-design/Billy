"use client";

import { formatNaira, getTemplate, type BillDto } from "@billy/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ErrorText, PageLoader, ProgressBar, StatusBadge } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { daysLeft, timeAgo } from "@/lib/format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Waiting" },
  { id: "paid", label: "Paid" },
  { id: "draft", label: "Drafts" },
  { id: "declined", label: "Declined" },
  { id: "expired", label: "Expired" },
] as const;

interface Stats {
  receivedKobo: number;
  waitingKobo: number;
  activeCount: number;
  paidCount: number;
}

export default function DashboardPage() {
  const { me } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [data, setData] = useState<{ bills: BillDto[]; stats: Stats } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api<{ bills: BillDto[]; stats: Stats }>(`/bills?status=${filter}`)
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Hi {me?.name?.split(" ")[0]} 👋🏾</p>
          <h1 className="text-2xl font-bold">Your bills</h1>
        </div>
        <Link href="/bills/new" className="btn-primary">
          + New bill
        </Link>
      </div>

      {!me?.payoutsReady && (
        <Link href="/settings" className="block rounded-3xl bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Add your bank account</strong> so you can send bills and get paid. →
        </Link>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-soft">
            <p className="text-sm text-brand-100">Received</p>
            <p className="mt-1 text-2xl font-extrabold">{formatNaira(data.stats.receivedKobo)}</p>
            <p className="text-xs text-brand-100">{data.stats.paidCount} paid in full</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Waiting for</p>
            <p className="mt-1 text-2xl font-extrabold">{formatNaira(data.stats.waitingKobo)}</p>
            <p className="text-xs text-gray-500">{data.stats.activeCount} open bills</p>
          </div>
        </div>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`chip shrink-0 ${filter === f.id ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ErrorText>{error}</ErrorText>
      {!data && !error && <PageLoader />}
      {data && data.bills.length === 0 && (
        <EmptyState emoji="🧾" title={filter === "all" ? "No bills yet" : "Nothing here"}>
          {filter === "all" && (
            <>
              <p className="text-gray-600">Create your first bill and share it on WhatsApp.</p>
              <Link href="/bills/new" className="btn-primary mt-3">
                Create a bill
              </Link>
            </>
          )}
        </EmptyState>
      )}
      <ul className="space-y-3">
        {data?.bills.map((bill) => (
          <li key={bill.id}>
            <BillCard bill={bill} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BillCard({ bill }: { bill: BillDto }) {
  const t = getTemplate(bill.category);
  const active = bill.status === "open" || bill.status === "part_paid";
  return (
    <Link href={`/bills/${bill.id}`} className="card block transition hover:border-brand-300">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-xl" aria-hidden>
          {t.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold">{bill.title}</p>
            <StatusBadge status={bill.status} />
          </div>
          <p className="text-sm text-gray-500">
            {bill.recipientName ? `To ${bill.recipientName} · ` : ""}
            {active ? daysLeft(bill.expiresAt) : timeAgo(bill.updatedAt)}
            {bill.openedAt && active ? " · 👀 opened" : ""}
          </p>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-lg font-bold">{formatNaira(bill.totalKobo)}</span>
            {bill.paidKobo > 0 && bill.status !== "paid" && <span className="text-sm text-gray-500">{formatNaira(bill.paidKobo)} paid</span>}
          </div>
          {bill.status === "part_paid" && (
            <div className="mt-2">
              <ProgressBar value={bill.paidKobo} total={bill.totalKobo} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
