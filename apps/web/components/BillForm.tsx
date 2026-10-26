"use client";

import {
  BILL_TEMPLATES,
  estimatePayoutKobo,
  formatNaira,
  getTemplate,
  RELATIONSHIPS,
  TEMPLATE_GROUPS,
  type BillDetailDto,
  type CreateBillInput,
} from "@billy/shared";
import { useRef, useState } from "react";
import { apiUrl, errorMessage } from "@/lib/api";
import { parseNairaInput } from "@/lib/format";
import { uploadImage } from "@/lib/images";
import { ErrorText, Spinner } from "./ui";

interface ItemRow {
  name: string;
  amount: string;
}

export interface BillFormValues extends CreateBillInput {}

const nairaText = (kobo: number) => (kobo / 100).toString();

export function BillForm({
  initial,
  submitLabel,
  onSubmit,
  allowDraft,
  payoutsReady,
}: {
  initial?: BillDetailDto;
  submitLabel: string;
  onSubmit: (values: BillFormValues) => Promise<void>;
  allowDraft?: boolean;
  payoutsReady: boolean;
}) {
  const [step, setStep] = useState<"pick" | "form">(initial ? "form" : "pick");
  const [category, setCategory] = useState(initial?.category ?? "custom");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [relationship, setRelationship] = useState(initial?.relationship ?? "partner");
  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(initial?.recipientPhone ? "0" + initial.recipientPhone.slice(4) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [useItems, setUseItems] = useState((initial?.items.length ?? 0) > 0);
  const [amount, setAmount] = useState(initial && !initial.items.length ? nairaText(initial.totalKobo) : "");
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items.length ? initial.items.map((i) => ({ name: i.name, amount: nairaText(i.amountKobo) })) : [{ name: "", amount: "" }],
  );
  const [allowPartial, setAllowPartial] = useState(initial?.allowPartial ?? true);
  const [visibility, setVisibility] = useState<"private" | "public">(initial?.visibility ?? "private");
  const [expiresInDays, setExpiresInDays] = useState(14);
  // When editing, only move the expiry date if she changes it.
  const [expiryTouched, setExpiryTouched] = useState(!initial);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>(
    initial?.photoMediaIds.map((id, i) => ({ id, url: initial.photoUrls[i] })) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<"submit" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const itemKobo = items.map((i) => parseNairaInput(i.amount) ?? 0);
  const totalKobo = useItems ? itemKobo.reduce((a, b) => a + b, 0) : parseNairaInput(amount) ?? 0;

  function pickTemplate(id: string) {
    const t = getTemplate(id);
    setCategory(t.id);
    if (t.title) setTitle(t.title);
    setStep("form");
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, 4 - photos.length)) {
        const uploaded = await uploadImage(file);
        setPhotos((p) => [...p, uploaded]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(draft: boolean) {
    setError(null);
    const cleanItems = items
      .map((i, idx) => ({ name: i.name.trim(), amountKobo: itemKobo[idx] }))
      .filter((i) => i.name || i.amountKobo);
    if (!title.trim()) return setError("Give your bill a title");
    if (useItems) {
      if (!cleanItems.length) return setError("Add at least one item");
      if (cleanItems.some((i) => !i.name || !i.amountKobo)) return setError("Each item needs a name and a price");
    } else if (!totalKobo) {
      return setError("Enter how much you need");
    }
    if (totalKobo < 10_000) return setError("The smallest bill is ₦100");

    setBusy(draft ? "draft" : "submit");
    try {
      await onSubmit({
        title: title.trim(),
        category,
        relationship,
        recipientName: recipientName.trim() || null,
        recipientPhone: recipientPhone.trim() || null,
        note: note.trim() || null,
        ...(useItems ? { items: cleanItems } : { amountKobo: totalKobo, items: [] }),
        allowPartial,
        visibility,
        ...(expiryTouched ? { expiresInDays } : {}),
        photoMediaIds: photos.map((p) => p.id),
        draft,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (step === "pick") {
    return (
      <div className="space-y-6">
        <p className="text-gray-600">What do you need? Pick one to start, you can change everything after.</p>
        {TEMPLATE_GROUPS.map((group) => (
          <section key={group.id}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{group.label}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BILL_TEMPLATES.filter((t) => t.group === group.id).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t.id)}
                  className="flex items-center gap-2 rounded-2xl border border-brand-100 bg-white px-3 py-3 text-left text-sm font-medium shadow-sm transition hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="text-xl" aria-hidden>
                    {t.emoji}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const template = getTemplate(category);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      {!initial && (
        <button type="button" onClick={() => setStep("pick")} className="chip border-brand-200 bg-brand-50 text-brand-700">
          <span aria-hidden>{template.emoji}</span> {template.label} · change
        </button>
      )}

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="title">
            What's it for?
          </label>
          <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Knotless braids" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label mb-0">How much?</span>
            <button type="button" className="text-sm font-medium text-brand-700" onClick={() => setUseItems(!useItems)}>
              {useItems ? "Use one amount" : "List items instead"}
            </button>
          </div>
          {useItems ? (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    aria-label={`Item ${idx + 1} name`}
                    className="input flex-1"
                    placeholder="Item"
                    value={item.name}
                    maxLength={80}
                    onChange={(e) => setItems(items.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)))}
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₦</span>
                    <input
                      aria-label={`Item ${idx + 1} price`}
                      className="input pl-7"
                      inputMode="decimal"
                      placeholder="0"
                      value={item.amount}
                      onChange={(e) => setItems(items.map((it, i) => (i === idx ? { ...it, amount: e.target.value } : it)))}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove item"
                    className="px-2 text-gray-400 hover:text-red-500 disabled:opacity-30"
                    disabled={items.length === 1}
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {items.length < 20 && (
                <button type="button" className="text-sm font-medium text-brand-700" onClick={() => setItems([...items, { name: "", amount: "" }])}>
                  + Add item
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">₦</span>
              <input
                aria-label="Amount in naira"
                className="input pl-9 text-2xl font-bold"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}
          {totalKobo > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              Total <strong className="text-gray-900">{formatNaira(totalKobo)}</strong> · you'll receive about{" "}
              <strong className="text-gray-900">{formatNaira(estimatePayoutKobo(totalKobo))}</strong> after the Paystack fee.
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="note">
            Add a note <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea id="note" className="input min-h-20" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Anything he should know" />
        </div>

        <div>
          <span className="label">
            Photos <span className="font-normal text-gray-400">(optional, up to 4)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={apiUrl(p.url)} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-gray-900 text-xs text-white"
                  onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < 4 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid h-20 w-20 place-items-center rounded-2xl border-2 border-dashed border-brand-200 text-2xl text-brand-400 hover:bg-brand-50"
                aria-label="Add photo"
              >
                {uploading ? <Spinner /> : "+"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <span className="label">Who are you sending it to?</span>
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIPS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRelationship(r.id)}
                className={`chip ${relationship === r.id ? "border-brand-500 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}
                aria-pressed={relationship === r.id}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="rname">
              His name <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input id="rname" className="input" value={recipientName} maxLength={60} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Tunde" />
          </div>
          <div>
            <label className="label" htmlFor="rphone">
              His phone <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input id="rphone" className="input" inputMode="tel" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="0803 123 4567" />
          </div>
        </div>
      </div>

      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
          More options <span className="text-gray-400 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-4 space-y-4">
          <Toggle checked={allowPartial} onChange={setAllowPartial} label="He can pay part of it" hint="He can pay some now and the rest later." />
          <Toggle
            checked={visibility === "public"}
            onChange={(v) => setVisibility(v ? "public" : "private")}
            label="Show on my Billy page"
            hint="Anyone with your page link can see and pay it. Otherwise only people with this bill's link can."
          />
          <div>
            <label className="label" htmlFor="expiry">
              {initial ? "Extend the link to" : "Link expires after"}
            </label>
            <select id="expiry" className="input" value={expiresInDays} onChange={(e) => {
                setExpiresInDays(Number(e.target.value));
                setExpiryTouched(true);
              }}>
              {[1, 3, 7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? "1 day" : `${d} days`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      {!payoutsReady && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add your bank account in <a className="font-semibold underline" href="/settings">settings</a> so the money can reach you. You can save this bill as a draft for now.
        </p>
      )}
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {allowDraft && (
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => submit(true)}>
            {busy === "draft" ? <Spinner /> : "Save draft"}
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={!!busy || uploading || (!payoutsReady && !initial)}>
          {busy === "submit" ? <Spinner className="border-white/40 border-t-white" /> : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-gray-500">{hint}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-gray-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}
