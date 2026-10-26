"use client";

import type { BankDto, MeDto } from "@billy/shared";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/images";
import { Avatar, ErrorText, Spinner } from "./ui";

export function ProfileForm({ submitLabel, onDone }: { submitLabel: string; onDone?: (me: MeDto) => void }) {
  const { me, setMe } = useAuth();
  const [name, setName] = useState(me?.name ?? "");
  const [username, setUsername] = useState(me?.username ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [avatar, setAvatar] = useState<{ id: string | null; url: string | null }>({ id: null, url: me?.avatarUrl ?? null });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickAvatar(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadImage(file, 512);
      setAvatar({ id: up.id, url: up.url });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    setSaved(false);
    if (name.trim().length < 2) return setError("Enter your name");
    setBusy(true);
    try {
      const updated = await api<MeDto>("/me", {
        method: "PATCH",
        body: {
          name: name.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim(),
          ...(avatar.id ? { avatarMediaId: avatar.id } : {}),
        },
      });
      setMe(updated);
      setSaved(true);
      onDone?.(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative rounded-full" aria-label="Change profile photo">
          <Avatar name={name || "?"} url={avatar.url} size={72} />
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-sm text-white">
            {uploading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : "📷"}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickAvatar(e.target.files?.[0])} />
        <p className="text-sm text-gray-500">Add a photo so he knows the bill is really from you.</p>
      </div>
      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input id="name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ada Okafor" />
      </div>
      <div>
        <label className="label" htmlFor="username">
          Your Billy link
        </label>
        <div className="flex items-center rounded-2xl border border-gray-200 bg-white focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
          <span className="pl-4 text-gray-400">billy/</span>
          <input
            id="username"
            className="w-full rounded-2xl bg-transparent px-1 py-3 text-base focus:outline-none"
            value={username}
            maxLength={24}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
            placeholder="ada"
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bio">
          Short bio <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input id="bio" className="input" value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} placeholder="Lagos babe ✨" />
      </div>
      <ErrorText>{error}</ErrorText>
      <button className="btn-primary w-full sm:w-auto" disabled={busy || uploading}>
        {busy ? <Spinner className="border-white/40 border-t-white" /> : saved && !onDone ? "Saved ✓" : submitLabel}
      </button>
    </form>
  );
}

export function BankAccountForm({ submitLabel, onDone }: { submitLabel: string; onDone?: (me: MeDto) => void }) {
  const { me, setMe } = useAuth();
  const [banks, setBanks] = useState<BankDto[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!me?.bank);

  useEffect(() => {
    api<{ banks: BankDto[] }>("/banks")
      .then((r) => setBanks(r.banks.slice().sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Look up the account name as soon as both fields are filled.
  useEffect(() => {
    setAccountName(null);
    if (!bankCode || accountNumber.length !== 10) return;
    let cancelled = false;
    setChecking(true);
    setError(null);
    api<{ accountName: string }>("/me/bank-account/resolve", { body: { bankCode, accountNumber } })
      .then((r) => !cancelled && setAccountName(r.accountName))
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [bankCode, accountNumber]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<MeDto>("/me/bank-account", { method: "PUT", body: { bankCode, accountNumber } });
      setMe(updated);
      setEditing(false);
      onDone?.(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!editing && me?.bank) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-emerald-50 p-4">
        <div>
          <p className="font-semibold text-emerald-900">{me.bank.accountName}</p>
          <p className="text-sm text-emerald-800">
            {me.bank.bankName} · ••••{me.bank.accountNumberLast4}
          </p>
        </div>
        <button className="btn-secondary px-4 py-2" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div>
        <label className="label" htmlFor="bank">
          Bank
        </label>
        <select id="bank" className="input" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
          <option value="">Choose your bank</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="acct">
          Account number
        </label>
        <input
          id="acct"
          className="input text-lg tracking-wider"
          inputMode="numeric"
          maxLength={10}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
          placeholder="0123456789"
        />
      </div>
      {checking && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="h-4 w-4" /> Checking account…
        </p>
      )}
      {accountName && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ <strong>{accountName}</strong>
        </p>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={!accountName || busy}>
          {busy ? <Spinner className="border-white/40 border-t-white" /> : submitLabel}
        </button>
        {me?.bank && (
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
