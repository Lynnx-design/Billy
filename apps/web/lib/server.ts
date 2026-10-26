import type { PublicBillDto } from "@billy/shared";

const SERVER_API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** Server-side fetch for link previews. Uses track=0 so WhatsApp's preview robot isn't counted as a view. */
export async function fetchPublicBill(slug: string): Promise<PublicBillDto | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/pay/${encodeURIComponent(slug)}?track=0`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as PublicBillDto) : null;
  } catch {
    return null;
  }
}

export interface PublicProfile {
  name: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  payoutsReady: boolean;
  bills: { slug: string; title: string; category: string; totalKobo: number; paidKobo: number; photoUrls: string[]; expiresAt: string }[];
}

export async function fetchProfile(username: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/users/${encodeURIComponent(username)}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as PublicProfile) : null;
  } catch {
    return null;
  }
}
