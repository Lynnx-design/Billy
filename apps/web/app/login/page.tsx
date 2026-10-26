"use client";

import { formatNigerianPhone, normalizeNigerianPhone, type MeDto } from "@billy/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorText, Logo, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { me, loading, login } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!loading && me) router.replace(me.username ? "/dashboard" : "/onboarding");
  }, [loading, me, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function requestCode() {
    setError(null);
    const normalized = normalizeNigerianPhone(phone);
    if (!normalized) return setError("Enter a valid Nigerian phone number, like 0803 123 4567");
    setBusy(true);
    try {
      const res = await api<{ isNewUser: boolean }>("/auth/otp/request", { body: { phone: normalized }, auth: false });
      setIsNewUser(res.isNewUser);
      setStep("code");
      setResendIn(60);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    if (isNewUser && !acceptTerms) return setError("Please accept the terms and privacy policy to continue");
    setBusy(true);
    try {
      const res = await api<{ token: string; user: MeDto; isNew: boolean }>("/auth/otp/verify", {
        body: { phone: normalizeNigerianPhone(phone), code, acceptTerms },
        auth: false,
      });
      login(res.token, res.user);
      router.replace(res.isNew ? "/onboarding" : "/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <Logo size="lg" />
      <div className="card mt-10 w-full max-w-sm">
        {step === "phone" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              requestCode();
            }}
          >
            <div>
              <h1 className="text-xl font-bold">Welcome 👋🏾</h1>
              <p className="mt-1 text-sm text-gray-600">Enter your phone number. We'll text you a code to log in or sign up.</p>
            </div>
            <div>
              <label htmlFor="phone" className="label">
                Phone number
              </label>
              <input
                id="phone"
                className="input text-lg"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0803 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? <Spinner className="border-white/40 border-t-white" /> : "Send code"}
            </button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <div>
              <h1 className="text-xl font-bold">Enter your code</h1>
              <p className="mt-1 text-sm text-gray-600">
                We sent a 6-digit code to {formatNigerianPhone(normalizeNigerianPhone(phone) ?? "")}.{" "}
                <button type="button" className="font-medium text-brand-700" onClick={() => setStep("phone")}>
                  Change
                </button>
              </p>
            </div>
            <input
              aria-label="6-digit code"
              className="input text-center text-2xl font-bold tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            {isNewUser && (
              <label className="flex items-start gap-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  I agree to Billy's{" "}
                  <Link href="/terms" target="_blank" className="font-medium text-brand-700 underline">
                    terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="font-medium text-brand-700 underline">
                    privacy policy
                  </Link>
                  .
                </span>
              </label>
            )}
            {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Test version: no SMS is sent. Your code is <strong>123456</strong>.
              </p>
            )}
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
              {busy ? <Spinner className="border-white/40 border-t-white" /> : "Continue"}
            </button>
            <button type="button" className="btn-ghost w-full" disabled={resendIn > 0 || busy} onClick={requestCode}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
