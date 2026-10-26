"use client";

import type { BillDetailDto } from "@billy/shared";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BillForm } from "@/components/BillForm";
import { ErrorText, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function EditBillPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useAuth();
  const [bill, setBill] = useState<BillDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<BillDetailDto>(`/bills/${id}`)
      .then(setBill)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!bill) return <PageLoader />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit bill</h1>
      <BillForm
        initial={bill}
        submitLabel="Save changes"
        payoutsReady={!!me?.payoutsReady}
        onSubmit={async ({ draft: _draft, ...values }) => {
          await api<BillDetailDto>(`/bills/${id}`, { method: "PATCH", body: values });
          router.push(`/bills/${id}`);
        }}
      />
    </div>
  );
}
