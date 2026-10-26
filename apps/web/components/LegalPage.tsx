import type { ReactNode } from "react";
import { Logo } from "./ui";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Logo size="sm" />
      <article className="card mt-6 space-y-4 text-gray-700 [&_h2]:mt-4 [&_h2]:font-semibold [&_h2]:text-gray-900">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Draft for review. Have a lawyer check this before launch.</p>
        {children}
      </article>
    </div>
  );
}
