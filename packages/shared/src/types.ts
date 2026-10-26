// Shapes returned by the API. Web, mobile and WhatsApp clients all read these.

export type BillStatus = "draft" | "open" | "part_paid" | "paid" | "declined" | "expired" | "cancelled";

export const PAYABLE_STATUSES: BillStatus[] = ["open", "part_paid"];

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  draft: "Draft",
  open: "Waiting",
  part_paid: "Part paid",
  paid: "Paid",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export type BillEventType =
  | "created"
  | "published"
  | "edited"
  | "opened"
  | "payment_started"
  | "part_paid"
  | "paid"
  | "declined"
  | "blocked"
  | "expired"
  | "cancelled";

export interface MeDto {
  id: string;
  phone: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  bank: { bankName: string; accountName: string; accountNumberLast4: string } | null;
  payoutsReady: boolean;
  createdAt: string;
}

export interface BillItemDto {
  id: string;
  name: string;
  amountKobo: number;
}

export interface BillEventDto {
  id: string;
  type: BillEventType;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaymentDto {
  id: string;
  reference: string;
  amountKobo: number;
  status: "pending" | "success" | "failed";
  channel: string | null;
  payerName: string;
  message: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface BillDto {
  id: string;
  slug: string;
  title: string;
  category: string;
  relationship: string;
  note: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  totalKobo: number;
  paidKobo: number;
  allowPartial: boolean;
  visibility: "private" | "public";
  status: BillStatus;
  items: BillItemDto[];
  photoUrls: string[];
  photoMediaIds: string[];
  expiresAt: string;
  openedAt: string | null;
  viewCount: number;
  declineReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillDetailDto extends BillDto {
  events: BillEventDto[];
  payments: PaymentDto[];
  shareUrl: string;
  shareMessage: string;
}

/** What the man sees on the payment page. Never includes her phone or bank details. */
export interface PublicBillDto {
  slug: string;
  title: string;
  category: string;
  note: string | null;
  recipientName: string | null;
  totalKobo: number;
  paidKobo: number;
  remainingKobo: number;
  allowPartial: boolean;
  status: BillStatus;
  items: BillItemDto[];
  photoUrls: string[];
  expiresAt: string;
  payable: boolean;
  /** Why the bill cannot be paid, when payable is false. */
  notPayableReason: string | null;
  sender: { name: string; username: string | null; avatarUrl: string | null };
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  billId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface BankDto {
  code: string;
  name: string;
}

export interface ApiError {
  error: string;
  message: string;
  issues?: { path: string; message: string }[];
}
