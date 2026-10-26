"use client";

import { formatNaira, getTemplate, MIN_PAYMENT_KOBO, normalizeNigerianPhone, type PublicBillDto } from "@billy/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, ErrorText, Logo, PageLoader, ProgressBar, Spinner } from "@/components/ui";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { daysLeft, parseNairaInput } from "@/lib/format";

type Sheet = null | "decline" | "report" | "block";

export function PayClient({ slug }: { slug: string }) {
  const [bill, setBill] = useState<PublicBillDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api<PublicBillDto>(`/pay/${slug}`)
      .then(setBill)
      .catch((err) => setLoadError(errorMessage(err)));
  }, [slug]);

  if (loadError) {
    return (
      <Shell>
        <div className="card text-center">
          <p className="text-4xl">🤷🏾‍♀️</p>
          <h1 className="mt-2 text-xl font-bold">{loadError}</h1>
          <p className="mt-1 text-gray-600">Check the link and try again.</p>
        </div>
      </Shell>
    );
  }
  if (!bill) return <PageLoader />;

  const t = getTemplate(bill.category);
  const payKobo = partial ? parseNairaInput(amount) ?? 0 : bill.remainingKobo;
  const minKobo = Math.min(MIN_PAYMENT_KOBO, bill.remainingKobo);

  async function pay() {
    setError(null);
    if (name.trim().length < 2) return setError("Enter your name so she knows who paid");
    if (partial && (payKobo < minKobo || payKobo > bill!.remainingKobo)) {
      return setError(`Enter an amount between ${formatNaira(minKobo)} and ${formatNaira(bill!.remainingKobo)}`);
    }
    setBusy(true);
    try {
      const res = await api<{ authorizationUrl: string }>(`/pay/${slug}/initialize`, {
        body: { amountKobo: payKobo, payerName: name.trim(), payerEmail: email.trim(), message: message.trim() || undefined },
        auth: false,
      });
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="card text-center">
          <p className="text-4xl">✅</p>
          <h1 className="mt-2 text-xl font-bold">{done}</h1>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="card">
        <div className="flex items-center gap-3">
          <Avatar name={bill.sender.name} url={bill.sender.avatarUrl} size={52} />
          <div>
            <p className="font-semibold">{bill.sender.name}</p>
            <p className="text-sm text-gray-500">sent {bill.recipientName ? `${bill.recipientName} ` : "you "}a bill</p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-3xl" aria-hidden>
            {t.emoji}
          </p>
          <h1 className="mt-1 text-xl font-bold">{bill.title}</h1>
          <p className="mt-2 text-4xl font-extrabold text-brand-700">{formatNaira(bill.remainingKobo)}</p>
          {bill.paidKobo > 0 && (
            <div className="mx-auto mt-3 max-w-xs space-y-1">
              <ProgressBar value={bill.paidKobo} total={bill.totalKobo} />
              <p className="text-sm text-gray-500">
                {formatNaira(bill.paidKobo)} of {formatNaira(bill.totalKobo)} already paid
              </p>
            </div>
          )}
        </div>

        {bill.note && <p className="mt-5 whitespace-pre-line rounded-2xl bg-brand-50 p-4 text-gray-800">{bill.note}</p>}

        {bill.items.length > 0 && (
          <ul className="mt-5 divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
            {bill.items.map((i) => (
              <li key={i.id} className="flex justify-between py-2.5 text-sm">
                <span>{i.name}</span>
                <span className="font-semibold">{formatNaira(i.amountKobo)}</span>
              </li>
            ))}
          </ul>
        )}

        {bill.photoUrls.length > 0 && (
          <div className="mt-5 flex gap-2 overflow-x-auto">
            {bill.photoUrls.map((url) => (
              <a key={url} href={apiUrl(url)} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={apiUrl(url)} alt="" className="h-28 w-28 rounded-2xl object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      {bill.payable ? (
        <form
          className="card mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            pay();
          }}
        >
          {bill.allowPartial && bill.remainingKobo > minKobo && (
            <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1" role="radiogroup" aria-label="How much to pay">
              {[false, true].map((p) => (
                <button
                  key={String(p)}
                  type="button"
                  role="radio"
                  aria-checked={partial === p}
                  onClick={() => setPartial(p)}
                  className={`rounded-full py-2 text-sm font-semibold transition ${partial === p ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"}`}
                >
                  {p ? "Pay part" : "Pay all"}
                </button>
              ))}
            </div>
          )}
          {partial && (
            <div>
              <label className="label" htmlFor="amount">
                How much?
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">₦</span>
                <input
                  id="amount"
                  className="input pl-9 text-xl font-bold"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          <div>
            <label className="label" htmlFor="pname">
              Your name
            </label>
            <input id="pname" className="input" autoComplete="name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="So she knows it's you" />
          </div>
          <div>
            <label className="label" htmlFor="pemail">
              Email for receipt <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input id="pemail" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label" htmlFor="pmsg">
              Message to {bill.sender.name.split(" ")[0]} <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input id="pmsg" className="input" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} placeholder="Enjoy ❤️" />
          </div>
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary w-full py-4 text-base" disabled={busy || payKobo <= 0}>
            {busy ? <Spinner className="border-white/40 border-t-white" /> : `Pay ${payKobo > 0 ? formatNaira(payKobo) : ""}`}
          </button>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-2.5 py-1">🏦 Bank transfer</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1">💳 Card</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1">📱 USSD</span>
          </div>
          <p className="text-center text-xs text-gray-400">
            🔒 Secured by Paystack · goes straight to {bill.sender.name.split(" ")[0]}'s bank · {daysLeft(bill.expiresAt)}
          </p>
        </form>
      ) : (
        <div className="card mt-4 text-center">
          <p className="font-semibold">{bill.notPayableReason}</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
        {bill.payable && (
          <button className="font-medium text-gray-600 underline" onClick={() => setSheet("decline")}>
            Decline this bill
          </button>
        )}
        <button className="text-gray-400 underline" onClick={() => setSheet("block")}>
          Stop bills from {bill.sender.name.split(" ")[0]}
        </button>
        <button className="text-gray-400 underline" onClick={() => setSheet("report")}>
          Report
        </button>
      </div>

      {sheet && (
        <ActionSheet
          kind={sheet}
          slug={slug}
          senderName={bill.sender.name}
          onClose={() => setSheet(null)}
          onDone={(msg) => {
            setSheet(null);
            setDone(msg);
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="mb-5 flex justify-center">
        <Logo size="sm" />
      </div>
      {children}
      <p className="mt-10 text-center text-xs text-gray-400">
        Want to send your own bills?{" "}
        <Link href="/" className="font-medium text-brand-600">
          Try Billy
        </Link>
      </p>
    </div>
  );
}

function ActionSheet({
  kind,
  slug,
  senderName,
  onClose,
  onDone,
}: {
  kind: Exclude<Sheet, null>;
  slug: string;
  senderName: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [reason, setReason] = useState("scam");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = senderName.split(" ")[0];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (kind === "decline") {
        await api(`/pay/${slug}/decline`, { body: { reason: text.trim() || undefined }, auth: false });
        onDone(`Okay, we've let ${first} know.`);
      } else if (kind === "block") {
        if (phone && !normalizeNigerianPhone(phone)) throw new Error("Enter a valid Nigerian phone number");
        await api(`/pay/${slug}/block`, { body: phone ? { phone } : {}, auth: false });
        onDone(`Done. ${first} can't send bills to your number any more.`);
      } else {
        await api(`/pay/${slug}/report`, { body: { reason, details: text.trim() || undefined }, auth: false });
        onDone("Thanks for telling us. Our team will look into it.");
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const titles = { decline: "Decline this bill?", block: `Stop bills from ${first}?`, report: "Report this bill" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{titles[kind]}</h2>
        <div className="mt-4 space-y-3">
          {kind === "decline" && (
            <>
              <p className="text-sm text-gray-600">{first} will see that you declined. You can add a short reason.</p>
              <input className="input" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="e.g. Not this month, sorry" />
            </>
          )}
          {kind === "block" && (
            <>
              <p className="text-sm text-gray-600">This declines the bill. {first} won't be able to send new bills to your number.</p>
              <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone number (if she didn't add it)" />
            </>
          )}
          {kind === "report" && (
            <>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="scam">It looks like a scam</option>
                <option value="impersonation">Someone is pretending to be someone else</option>
                <option value="harassment">Harassment</option>
                <option value="spam">Spam</option>
                <option value="other">Something else</option>
              </select>
              <textarea className="input min-h-20" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Tell us what happened (optional)" />
            </>
          )}
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={onClose}>
              Back
            </button>
            <button className={kind === "report" ? "btn-primary flex-1" : "btn-danger flex-1"} disabled={busy} onClick={submit}>
              {busy ? <Spinner /> : kind === "decline" ? "Decline" : kind === "block" ? "Stop bills" : "Send report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
