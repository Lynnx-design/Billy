"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BankAccountForm, ProfileForm } from "@/components/AccountForms";
import { Logo, PageLoader } from "@/components/ui";
import { useRequireUser } from "@/lib/auth";

export default function OnboardingPage() {
  const { me, loading } = useRequireUser({ allowIncompleteProfile: true });
  const router = useRouter();
  const [step, setStep] = useState<"profile" | "bank">("profile");

  useEffect(() => {
    if (me?.name && me.username && step === "profile") setStep(me.payoutsReady ? "profile" : "bank");
    // Only on first load: decide where to start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading || !me) return <PageLoader />;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
      <Logo />
      <ol className="mt-8 flex gap-2" aria-label="Progress">
        {["profile", "bank"].map((s) => (
          <li key={s} className={`h-1.5 flex-1 rounded-full ${s === step || step === "bank" ? "bg-brand-500" : "bg-brand-100"}`} />
        ))}
      </ol>

      {step === "profile" ? (
        <div className="card mt-6">
          <h1 className="text-xl font-bold">Set up your profile</h1>
          <p className="mb-5 mt-1 text-sm text-gray-600">This is what he sees when you send a bill.</p>
          <ProfileForm submitLabel="Continue" onDone={(u) => (u.payoutsReady ? router.replace("/dashboard") : setStep("bank"))} />
        </div>
      ) : (
        <div className="card mt-6">
          <h1 className="text-xl font-bold">Where should your money go?</h1>
          <p className="mb-5 mt-1 text-sm text-gray-600">
            Payments go straight to this account. Billy never holds your money.
          </p>
          <BankAccountForm submitLabel="Save and finish" onDone={() => router.replace("/bills/new")} />
          <button className="btn-ghost mt-3 w-full" onClick={() => router.replace("/dashboard")}>
            I'll do this later
          </button>
        </div>
      )}
    </div>
  );
}
