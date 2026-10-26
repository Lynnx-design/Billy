import type { MeDto } from "@billy/shared";
import type { User } from "../db/schema";
import { mediaUrl } from "./bills";

export function toMeDto(user: User): MeDto {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    username: user.username,
    bio: user.bio,
    avatarUrl: user.avatarMediaId ? mediaUrl(user.avatarMediaId) : null,
    role: user.role,
    bank:
      user.bankName && user.accountName && user.accountNumber
        ? { bankName: user.bankName, accountName: user.accountName, accountNumberLast4: user.accountNumber.slice(-4) }
        : null,
    payoutsReady: !!user.subaccountCode,
    createdAt: user.createdAt.toISOString(),
  };
}

// Usernames that would clash with pages on the web app.
export const RESERVED_USERNAMES = new Set([
  "admin", "api", "app", "b", "bills", "billy", "dashboard", "help", "login", "logout", "me",
  "new", "notifications", "onboarding", "pay", "privacy", "settings", "signup", "support",
  "terms", "test-checkout", "u", "www",
]);
