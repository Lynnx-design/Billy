import { formatNaira } from "@billy/shared";
import { ImageResponse } from "next/og";
import { fetchPublicBill } from "@/lib/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A bill on Billy";

// The preview card WhatsApp and Instagram show when the link is pasted.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bill = await fetchPublicBill(slug);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #ec4899 0%, #db2777 50%, #9d174d 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 44, fontWeight: 800 }}>
          <div style={{ display: "flex", width: 64, height: 64, borderRadius: 18, background: "white", color: "#db2777", alignItems: "center", justifyContent: "center" }}>
            B
          </div>
          billy
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 36, opacity: 0.85 }}>{bill ? `${bill.sender.name} sent you a bill` : "A bill for you"}</div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>{bill?.title ?? "Billy"}</div>
          {bill && <div style={{ fontSize: 96, fontWeight: 800 }}>{formatNaira(bill.remainingKobo).replace("₦", "N")}</div>}
        </div>
        <div style={{ fontSize: 30, opacity: 0.85 }}>Pay with bank transfer, card or USSD</div>
      </div>
    ),
    size,
  );
}
