"use client";

import type { BillDetailDto } from "@billy/shared";
import { useRouter } from "next/navigation";
import { BillForm } from "@/components/BillForm";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function NewBillPage() {
  const router = useRouter();
  const { me } = useAuth();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New bill</h1>
      <BillForm
        submitLabel="Create bill and get link"
        allowDraft
        payoutsReady={!!me?.payoutsReady}
        onSubmit={async (values) => {
          const bill = await api<BillDetailDto>("/bills", { body: values });
          router.push(`/bills/${bill.id}${values.draft ? "" : "?share=1"}`);
        }}
      />
    </div>
  );
}
