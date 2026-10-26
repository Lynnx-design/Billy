"use client";

import { BILL_STATUS_LABELS, formatNaira, type BillStatus } from "@billy/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ErrorText, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

interface Stats {
  users: { total: number; withPayouts: number; suspended: number };
  bills: { total: number; open: number; paid: number; declined: number; requestedKobo: number };
  payments: { successful: number; failed: number; volumeKobo: number };
  reports: { open: number };
}
interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  username: string | null;
  status: string;
  payoutsReady: boolean;
  billCount: number;
  reportCount: number;
  createdAt: string;
}
interface AdminBill {
  id: string;
  slug: string;
  title: string;
  status: BillStatus;
  totalKobo: number;
  paidKobo: number;
  senderName: string | null;
  createdAt: string;
}
interface AdminPayment {
  id: string;
  reference: string;
  status: string;
  amountKobo: number;
  channel: string | null;
  payerName: string;
  billTitle: string;
  createdAt: string;
}
interface AdminReport {
  id: string;
  reason: string;
  details: string | null;
  contact: string | null;
  status: string;
  createdAt: string;
  billSlug: string | null;
  billTitle: string | null;
  reportedUserId: string | null;
  reportedName: string | null;
  reportedStatus: string | null;
}

const TABS = ["reports", "users", "bills", "payments"] as const;

export default function AdminPage() {
  const { me } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("reports");
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<unknown[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me && me.role !== "admin") router.replace("/dashboard");
  }, [me, router]);

  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      setStats(await api<Stats>("/admin/stats"));
      const path = tab === "users" ? `/admin/users?q=${encodeURIComponent(q)}` : `/admin/${tab}`;
      const res = await api<Record<string, unknown[]>>(path);
      setRows(res[tab]);
    } catch (err) {
      setError(errorMessage(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (me?.role === "admin") load();
  }, [me, load]);

  async function post(path: string) {
    try {
      await api(path, { method: "POST" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (me?.role !== "admin") return <PageLoader />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Admin</h1>
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Users" value={stats.users.total} sub={`${stats.users.withPayouts} with payouts`} />
          <Stat label="Open bills" value={stats.bills.open} sub={`${stats.bills.total} total`} />
          <Stat label="Paid volume" value={formatNaira(stats.payments.volumeKobo)} sub={`${stats.payments.successful} payments`} />
          <Stat label="Open reports" value={stats.reports.open} sub={`${stats.users.suspended} suspended`} />
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`chip shrink-0 capitalize ${tab === t ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "users" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input className="input" placeholder="Search name, username or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      )}
      <ErrorText>{error}</ErrorText>
      {!rows && !error && <PageLoader />}
      {rows?.length === 0 && <p className="text-gray-500">Nothing here.</p>}
      <ul className="space-y-2">
        {tab === "reports" &&
          (rows as AdminReport[] | null)?.map((r) => (
            <li key={r.id} className="card text-sm">
              <div className="flex justify-between gap-2">
                <strong className="capitalize">{r.reason}</strong>
                <span className={r.status === "open" ? "text-amber-700" : "text-gray-400"}>{r.status}</span>
              </div>
              <p className="text-gray-600">
                {r.reportedName ?? "Unknown"} · bill "{r.billTitle}" ({r.billSlug}) · {formatDateTime(r.createdAt)}
              </p>
              {r.details && <p className="mt-1">"{r.details}"</p>}
              {r.contact && <p className="text-gray-500">Contact: {r.contact}</p>}
              <div className="mt-2 flex gap-2">
                {r.status === "open" && (
                  <button className="btn-secondary px-3 py-1.5" onClick={() => post(`/admin/reports/${r.id}/resolve`)}>
                    Mark resolved
                  </button>
                )}
                {r.reportedUserId && r.reportedStatus === "active" && (
                  <button className="btn-danger px-3 py-1.5" onClick={() => post(`/admin/users/${r.reportedUserId}/suspend`)}>
                    Suspend user
                  </button>
                )}
              </div>
            </li>
          ))}
        {tab === "users" &&
          (rows as AdminUser[] | null)?.map((u) => (
            <li key={u.id} className="card flex items-center justify-between gap-2 text-sm">
              <div>
                <strong>{u.name ?? "(no name)"}</strong> {u.username && <span className="text-gray-500">@{u.username}</span>}
                <p className="text-gray-500">
                  {u.phone} · {u.billCount} bills · {u.reportCount} reports · {u.payoutsReady ? "payouts ✓" : "no payouts"} · {u.status}
                </p>
              </div>
              {u.status === "active" && (
                <button className="btn-danger px-3 py-1.5" onClick={() => post(`/admin/users/${u.id}/suspend`)}>
                  Suspend
                </button>
              )}
              {u.status === "suspended" && (
                <button className="btn-secondary px-3 py-1.5" onClick={() => post(`/admin/users/${u.id}/unsuspend`)}>
                  Restore
                </button>
              )}
            </li>
          ))}
        {tab === "bills" &&
          (rows as AdminBill[] | null)?.map((b) => (
            <li key={b.id} className="card flex justify-between gap-2 text-sm">
              <div>
                <strong>{b.title}</strong>
                <p className="text-gray-500">
                  {b.senderName} · {b.slug} · {formatDateTime(b.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {formatNaira(b.paidKobo)} / {formatNaira(b.totalKobo)}
                </p>
                <p className="text-gray-500">{BILL_STATUS_LABELS[b.status]}</p>
              </div>
            </li>
          ))}
        {tab === "payments" &&
          (rows as AdminPayment[] | null)?.map((p) => (
            <li key={p.id} className="card flex justify-between gap-2 text-sm">
              <div>
                <strong>{p.payerName}</strong> → {p.billTitle}
                <p className="text-gray-500">
                  {p.reference} · {p.channel ?? "-"} · {formatDateTime(p.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatNaira(p.amountKobo)}</p>
                <p className={p.status === "success" ? "text-emerald-700" : p.status === "failed" ? "text-red-600" : "text-gray-500"}>{p.status}</p>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}
