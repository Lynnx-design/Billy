import { BILL_STATUS_LABELS, type BillStatus } from "@billy/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { apiUrl } from "@/lib/api";

export function Logo({ size = "md", href = "/" }: { size?: "sm" | "md" | "lg"; href?: string }) {
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" }[size];
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 font-extrabold tracking-tight text-brand-600 ${text}`}>
      <span aria-hidden className="grid h-[1.3em] w-[1.3em] place-items-center rounded-xl bg-brand-600 text-[0.7em] text-white">
        B
      </span>
      billy
    </Link>
  );
}

export function Avatar({ name, url, size = 40 }: { name?: string | null; url?: string | null; size?: number }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const src = apiUrl(url);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

const statusStyles: Record<BillStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  open: "bg-amber-50 text-amber-700",
  part_paid: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-600",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

export function StatusBadge({ status }: { status: BillStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      {BILL_STATUS_LABELS[status]}
    </span>
  );
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 ${className}`}
    />
  );
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </p>
  );
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}
