"use client";

import { formatNigerianPhone } from "@billy/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BankAccountForm, ProfileForm } from "@/components/AccountForms";
import { ErrorText } from "@/components/ui";
import { api, errorMessage, getToken, API_URL, WEB_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { me, logout } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/me/export`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error("Couldn't export your data");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "billy-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your Billy account? Your open bills will be cancelled. This can't be undone.")) return;
    try {
      await api("/me", { method: "DELETE" });
      logout();
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!me) return null;
  const pageUrl = `${WEB_URL}/${me.username}`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="card">
        <h2 className="mb-1 font-semibold">Your Billy page</h2>
        <p className="mb-3 text-sm text-gray-500">Bills you mark "Show on my Billy page" appear here.</p>
        <Link href={`/${me.username}`} className="font-medium text-brand-700 underline">
          {pageUrl.replace(/^https?:\/\//, "")}
        </Link>
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ProfileForm submitLabel="Save profile" />
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Payout account</h2>
        <p className="mb-4 text-sm text-gray-500">Payments settle straight to this account through Paystack.</p>
        <BankAccountForm submitLabel="Save bank account" />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Account</h2>
        <p className="text-sm text-gray-500">Logged in as {formatNigerianPhone(me.phone)}</p>
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              logout();
              router.replace("/");
            }}
          >
            Log out
          </button>
          <button className="btn-ghost" onClick={exportData}>
            Download my data
          </button>
          <button className="btn-danger" onClick={deleteAccount}>
            Delete account
          </button>
        </div>
        <p className="text-xs text-gray-400">
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </section>
    </div>
  );
}
