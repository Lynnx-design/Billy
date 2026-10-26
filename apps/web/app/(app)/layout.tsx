"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { PageLoader } from "@/components/ui";
import { useRequireUser } from "@/lib/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { me, loading } = useRequireUser();
  if (loading || !me || !me.name || !me.username) return <PageLoader />;
  return <AppShell>{children}</AppShell>;
}
