// Telegram integration. Off unless TELEGRAM_BOT_TOKEN is set, so nothing breaks without it.
//
// Privacy choices that matter here:
//  - the chat id is only ever stored after the student proves they control the chat by sending the bot
//    a one-time code generated in the app (never a link anyone could guess);
//  - only the hash of that code is stored, it works once and expires in 15 minutes;
//  - the bot token and the webhook secret are read from the environment and never logged;
//  - nothing a student typed is ever echoed into an error: messages go through scrub().
import { config } from "@/lib/config";

export const LINK_CODE_TTL_MS = 15 * 60 * 1000;
export const LINK_CODE_ATTEMPTS = 5; // per student, per hour

export function telegramToken(): string | null {
  return (process.env.TELEGRAM_BOT_TOKEN ?? "").trim() || null;
}

// Shared secret Telegram sends back on the webhook. Separate from the bot token on purpose, so the
// bot token itself is never used as an inbound credential.
export function telegramWebhookSecret(): string | null {
  const value = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  return value.length >= 16 ? value : null;
}

export function isTelegramConfigured(): boolean {
  return Boolean(telegramToken() && telegramWebhookSecret());
}

// The codes are short enough to type in Telegram but wide enough not to be guessable.
export function isValidLinkCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9]{8}$/.test(value.trim().toUpperCase());
}

// Telegram chat ids are "-1001234567890" for channels/groups and "123456789" for people.
// Only digits and a leading minus: nothing else is ever passed into a URL.
export function isValidChatId(value: unknown): value is string {
  return typeof value === "string" && /^-?\d{5,20}$/.test(value.trim());
}

export function isValidUsername(value: unknown): value is string | null {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const name = value.trim();
  if (!name) return true;
  return /^[A-Za-z0-9_]{1,32}$/.test(name);
}

// How early a reminder goes out, in hours. 0 would mean "send only once it is already due".
export function telegramDueSoonHours(): number {
  const value = Number.parseInt(process.env.TELEGRAM_DUE_SOON_HOURS ?? "", 10);
  return Number.isNaN(value) ? 24 : Math.min(168, Math.max(1, value));
}

// Smallest gap between two reminders for the same student, so a long outage cannot flood their phone.
export function telegramReminderCooldownHours(): number {
  const value = Number.parseInt(process.env.TELEGRAM_REMINDER_COOLDOWN_HOURS ?? "", 10);
  return Number.isNaN(value) ? 12 : Math.min(168, Math.max(1, value));
}

// At most this many lines in one message.
export const TELEGRAM_MAX_LINES = 12;

export const TELEGRAM_HELP =
  "Open e-GURO Companion > Settings > Telegram, press \"Create link code\", then send me: /start YOURCODE";