"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Logo } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Bills", icon: "🧾" },
  { href: "/bills/new", label: "New bill", icon: "➕" },
  { href: "/notifications", label: "Alerts", icon: "🔔" },
  { href: "/settings", label: "Me", icon: "👤" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!me) return;
    api<{ unread: number }>("/me/notifications")
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, [me, pathname]);

  const isActive = (href: string) => href === "/dashboard" ? pathname === href || (pathname.startsWith("/bills/") && pathname !== "/bills/new") : pathname === href;

  return (
    <div className="min-h-screen pb-24 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo size="sm" href="/dashboard" />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-full px-3 py-2 text-sm font-medium ${
                  isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {item.label}
                {item.href === "/notifications" && unread > 0 && <Dot count={unread} />}
              </Link>
            ))}
            {me?.role === "admin" && (
              <Link href="/admin" className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-2">
            {me?.username && (
              <Link href={`/${me.username}`} className="hidden text-sm text-gray-500 hover:text-brand-700 md:block">
                billy/{me.username}
              </Link>
            )}
            <Link href="/settings" className="rounded-full" aria-label="Your profile">
              <Avatar name={me?.name} url={me?.avatarUrl} size={34} />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive(item.href) ? "text-brand-700" : "text-gray-500"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              {item.label}
              {item.href === "/notifications" && unread > 0 && <Dot count={unread} />}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Dot({ count }: { count: number }) {
  return (
    <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}
