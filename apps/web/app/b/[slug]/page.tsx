import { formatNaira } from "@billy/shared";
import type { Metadata } from "next";
import { fetchPublicBill } from "@/lib/server";
import { PayClient } from "./PayClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const bill = await fetchPublicBill(slug);
  if (!bill) return { title: "Bill not found" };
  const title = `${bill.sender.name} sent you a bill: ${bill.title}`;
  const description = `${formatNaira(bill.remainingKobo)} · Pay securely with bank transfer, card or USSD on Billy.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false },
  };
}

export default async function PayPage({ params }: Props) {
  const { slug } = await params;
  return <PayClient slug={slug} />;
}
