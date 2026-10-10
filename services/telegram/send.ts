// Talking to Telegram's Bot API. Every call goes out through one small function so that
// "Telegram is off", "the student unlinked" and "Telegram is down" are all handled the same way:
// nothing is thrown, nothing is logged with a chat id in it.
import { getDb } from "@/lib/db";
import { logError } from "@/lib/log";
import { isValidChatId, telegramToken } from "@/lib/telegram";

const REQUEST_TIMEOUT_MS = 10_000;

export type TelegramResult = { ok: boolean; message: string };

// Sends one message. Returns ok:false instead of throwing when Telegram is not set up or refuses it.
export async function sendTelegramMessage(chatId: string, text: string): Promise<TelegramResult> {
  const token = telegramToken();
  if (!token) return { ok: false, message: "Telegram is not set up on this server." };
  if (!isValidChatId(chatId)) return { ok: false, message: "That chat id is not valid." };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      // The body can repeat the chat id, so only a scrubbed, truncated reason is kept.
      await logError("telegram", `sendMessage failed with status ${response.status}`, { code: "TELEGRAM_HTTP" });
      return { ok: false, message: `Telegram refused the message (status ${response.status}).` };
    }
    return { ok: true, message: "Sent." };
  } catch (error) {
    await logError("telegram", error, { code: "TELEGRAM_SEND" });
    return { ok: false, message: "Could not reach Telegram. It will try again next run." };
  }
}

// The bot's answer when a student sends /start with a code, or a plain /start.
export async function sendTelegramReply(chatId: string, text: string): Promise<TelegramResult> {
  return sendTelegramMessage(chatId, text.slice(0, 900));
}

// Removes stale link codes so the table cannot grow forever.
export async function pruneLinkCodes(): Promise<number> {
  try {
    // ownership: ok - a system prune of expired codes; it reads and removes no student data
    const result = await getDb().telegramLinkCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return result.count;
  } catch {
    return 0;
  }
}