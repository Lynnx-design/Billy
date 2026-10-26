import { formatNaira, type BillEventDto } from "@billy/shared";
import { CHANNEL_LABELS, formatDateTime } from "@/lib/format";

function describe(e: BillEventDto): { icon: string; text: string } {
  const d = (e.data ?? {}) as { amountKobo?: number; payerName?: string; channel?: string; reason?: string };
  const via = d.channel ? ` by ${CHANNEL_LABELS[d.channel] ?? d.channel}` : "";
  switch (e.type) {
    case "created":
      return { icon: "✍🏾", text: "You created the bill" };
    case "published":
      return { icon: "🔗", text: "Link is live" };
    case "edited":
      return { icon: "✏️", text: "You edited the bill" };
    case "opened":
      return { icon: "👀", text: "He opened the link" };
    case "payment_started":
      return { icon: "⏳", text: `${d.payerName ?? "Someone"} started paying ${d.amountKobo ? formatNaira(d.amountKobo) : ""}` };
    case "part_paid":
      return { icon: "💸", text: `${d.payerName ?? "Someone"} paid ${formatNaira(d.amountKobo ?? 0)}${via}` };
    case "paid":
      return { icon: "🎉", text: `${d.payerName ?? "Someone"} paid ${formatNaira(d.amountKobo ?? 0)}${via}. Fully paid!` };
    case "declined":
      return { icon: "🙅🏾‍♂️", text: d.reason ? `Declined: "${d.reason}"` : "Declined" };
    case "blocked":
      return { icon: "⛔", text: "Declined and asked not to get more bills" };
    case "expired":
      return { icon: "⌛", text: "Link expired" };
    case "cancelled":
      return { icon: "🚫", text: "You cancelled the bill" };
    default:
      return { icon: "•", text: e.type };
  }
}

export function Timeline({ events }: { events: BillEventDto[] }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-brand-100 pl-6">
      {/* Started-but-unfinished payments add noise; the paid events tell the story. */}
      {events.filter((e) => e.type !== "payment_started").map((e) => {
        const { icon, text } = describe(e);
        return (
          <li key={e.id} className="relative">
            <span aria-hidden className="absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-brand-50 text-sm">
              {icon}
            </span>
            <p className="text-sm font-medium text-gray-900">{text}</p>
            <p className="text-xs text-gray-500">{formatDateTime(e.createdAt)}</p>
          </li>
        );
      })}
    </ol>
  );
}
