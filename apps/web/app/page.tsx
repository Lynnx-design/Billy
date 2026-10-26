import Link from "next/link";
import { Logo } from "@/components/ui";

const STEPS = [
  { emoji: "✍🏾", title: "Create a bill", text: "Hair, upkeep, rent, data, dinner date: pick a template or write your own." },
  { emoji: "💬", title: "Share the link", text: "Send it on WhatsApp, Instagram or SMS. We even write the message for you." },
  { emoji: "💸", title: "Get paid", text: "He pays by transfer, card or USSD. The money goes straight to your bank." },
];

const EXAMPLES = ["💇🏾‍♀️ Hair", "💅🏾 Nails", "🗓️ Upkeep", "📶 Data", "🍽️ Dinner date", "🏠 Rent", "🎂 Birthday", "🛍️ Shopping"];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/login" className="btn-secondary px-4 py-2">
          Log in
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:pt-16">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 px-6 py-14 text-white shadow-soft sm:px-12 sm:py-20">
          <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/10" />
          <p className="mb-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-medium">Made for Nigerian women 🇳🇬</p>
          <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">Send him the bill. Get paid. 💅🏾</h1>
          <p className="mt-5 max-w-lg text-lg text-brand-50">
            Make a bill in seconds, share one link, and he pays by bank transfer, card or USSD. No app for him to download.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn bg-white px-6 text-brand-700 hover:bg-brand-50">
              Create your first bill
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <span key={e} className="rounded-full bg-white/15 px-3 py-1.5 text-sm">
                {e}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="mb-6 text-2xl font-bold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-xl" aria-hidden>
                  {s.emoji}
                </span>
                <span className="text-sm font-semibold text-brand-600">Step {i + 1}</span>
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-gray-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="card grid gap-6 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">He pays the way he likes</h2>
            <p className="mt-2 text-gray-600">
              Payments are processed securely by Paystack. You see the moment he opens your link and the moment he pays.
            </p>
          </div>
          <ul className="grid gap-2">
            {[
              ["🏦", "Bank transfer", "From any bank app: OPay, Moniepoint, PalmPay, GTB and more"],
              ["💳", "Debit card", "Verve, Mastercard and Visa"],
              ["📱", "USSD", "Works on any phone, no data needed"],
            ].map(([icon, title, text]) => (
              <li key={title} className="flex items-start gap-3 rounded-2xl bg-brand-50/60 p-3">
                <span className="text-2xl" aria-hidden>
                  {icon}
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-gray-600">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-brand-100 py-8 text-center text-sm text-gray-500">
        <div className="flex justify-center gap-4">
          <Link href="/terms" className="hover:text-brand-700">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-brand-700">
            Privacy
          </Link>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} Billy</p>
      </footer>
    </div>
  );
}
