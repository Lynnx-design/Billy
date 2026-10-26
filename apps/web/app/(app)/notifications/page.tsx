"use client";

import type { NotificationDto } from "@billy/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ErrorText, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: NotificationDto[] }>("/me/notifications")
      .then((r) => {
        setItems(r.items);
        // Mark as read once she has seen them.
        if (r.items.some((n) => !n.readAt)) api("/me/notifications/read", { method: "POST" }).catch(() => {});
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <ErrorText>{error}</ErrorText>
      {!items && !error && <PageLoader />}
      {items?.length === 0 && (
        <EmptyState emoji="🔔" title="No alerts yet">
          <p className="text-gray-600">You'll see here when he opens or pays your bill.</p>
        </EmptyState>
      )}
      <ul className="space-y-2">
        {items?.map((n) => {
          const body = (
            <div className={`card flex gap-3 ${n.readAt ? "" : "border-brand-300 bg-brand-50/50"}`}>
              {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="New" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-gray-600">{n.body}</p>
                <p className="mt-1 text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
              </div>
            </div>
          );
          return <li key={n.id}>{n.billId ? <Link href={`/bills/${n.billId}`}>{body}</Link> : body}</li>;
        })}
      </ul>
    </div>
  );
}
