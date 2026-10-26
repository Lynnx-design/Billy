"use client";

import { useState } from "react";

/** WhatsApp, SMS, Instagram (copy + open) and copy link. */
export function ShareButtons({ url, message, phone }: { url: string; message: string; phone?: string | null }) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const waNumber = phone ? phone.replace(/^\+/, "") : "";

  async function copy(text: string, what: "link" | "message") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  async function nativeShare() {
    if (navigator.share) {
      await navigator.share({ text: message }).catch(() => {});
    } else {
      copy(message, "message");
    }
  }

  return (
    <div className="space-y-3">
      <a
        className="btn w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]"
        href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
      >
        <span aria-hidden>💬</span> Send on WhatsApp
      </a>
      <div className="grid grid-cols-3 gap-2">
        <a className="btn-secondary px-2" href={`sms:${phone ?? ""}?&body=${encodeURIComponent(message)}`}>
          SMS
        </a>
        <button
          type="button"
          className="btn-secondary px-2"
          onClick={async () => {
            await copy(message, "message");
            window.open("https://instagram.com/direct/inbox/", "_blank", "noreferrer");
          }}
        >
          Instagram
        </button>
        <button type="button" className="btn-secondary px-2" onClick={nativeShare}>
          More
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-1.5 pl-4">
        <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{url}</span>
        <button type="button" className="btn-primary px-4 py-2" onClick={() => copy(url, "link")}>
          {copied === "link" ? "Copied!" : "Copy link"}
        </button>
      </div>
      {copied === "message" && <p className="text-center text-sm text-brand-700">Message copied. Paste it in the chat.</p>}
    </div>
  );
}
