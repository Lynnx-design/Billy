import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(webUrl),
  title: { default: "Billy: send a bill, get paid", template: "%s · Billy" },
  description: "Create a bill, share the link on WhatsApp, and get paid by bank transfer, card or USSD.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#db2777",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
