import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { sendTelegramReply } from "@/services/telegram/send";
import { isTelegramConfigured, isValidChatId, isValidLinkCode, isValidUsername, TELEGRAM_HELP } from "@/lib/telegram";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number | string; username?: string; type?: string };
  };
};

function authorized(request: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("x-telegram-secret") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Telegram webhook. Only /start <code> does anything: it proves the student controls this chat and
// then stores the chat id against their account. Telegram must always get a 200 back, or it retries.
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!isTelegramConfigured()) return Response.json({ error: "Telegram is not set up." }, { status: 503 });

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ ok: true }); // not our problem; do not make Telegram retry
  }

  const chat = update.message?.chat;
  const text = (update.message?.text ?? "").trim();
  const chatId = chat?.id === undefined ? null : String(chat.id);

  try {
    if (!chat) return Response.json({ ok: true });
    if (!chatId || !isValidChatId(chatId)) return Response.json({ ok: true });
    if (chat.type && chat.type !== "private") {
      // Only a private chat is linked: a group would mean everyone in it sees the student's reminders.
      await sendTelegramReply(chatId, "Please link me in a private chat with your own account.");
      return Response.json({ ok: true });
    }

    const command = text.split(/\s+/)[0]?.toLowerCase() ?? "";
    const argument = text.split(/\s+/)[1] ?? "";
    if (command !== "/start" && command !== "/link") return Response.json({ ok: true });
    if (!isValidLinkCode(argument)) {
      await sendTelegramReply(chatId, TELEGRAM_HELP);
      return Response.json({ ok: true });
    }

    const db = getDb();
    const codeHash = createHash("sha256").update(argument.trim().toUpperCase()).digest("hex");
    const record = await db.telegramLinkCode.findUnique({ where: { codeHash }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
    if (!record) {
      await sendTelegramReply(chatId, "That code was not recognised. Make a new one in e-GURO Companion.");
      return Response.json({ ok: true });
    }
    if (record.usedAt || record.expiresAt < new Date()) {
      await db.telegramLinkCode.deleteMany({ where: { id: record.id, userId: record.userId } });
      await sendTelegramReply(chatId, "That code has expired. Make a new one in e-GURO Companion.");
      return Response.json({ ok: true });
    }

    const username = isValidUsername(chat.username) ? chat.username!.trim() || null : null;
    await db.telegramLink.upsert({
      where: { userId: record.userId },
      update: { chatId, chatUsername: username, linkedAt: new Date() },
      create: { userId: record.userId, chatId, chatUsername: username },
    });
    // Single use: the code is burned the moment it works.
    await db.telegramLinkCode.deleteMany({ where: { id: record.id, userId: record.userId } });

    await sendTelegramReply(chatId, "Linked. Your e-GURO Companion reminders will arrive here.\n\nUnlink any time in Settings.");
    return Response.json({ ok: true });
  } catch (error) {
    // scrub() inside logError removes the chat id and anything else sensitive.
    await logError("telegram-hook", error, { code: "TELEGRAM_HOOK" });
    return Response.json({ ok: true });
  }
}