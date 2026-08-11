import type { ApiMessage, ChatSession, Message } from "../types/chat";

export const STORAGE_KEY = "mesta-ai-chat-history-tailwind-final-v7";
export const DEFAULT_CHAT_TITLE = "Ny chat";
export const MAX_TEXTAREA_HEIGHT = 180;

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function nowIso() {
  return new Date().toISOString();
}

export function createChat(title = DEFAULT_CHAT_TITLE): ChatSession {
  const now = nowIso();
  return {
    id: uid(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function generateChatTitle(question: string) {
  const text = question.replace(/\s+/g, " ").trim();
  if (!text) return DEFAULT_CHAT_TITLE;
  return text.length > 44 ? `${text.slice(0, 44).trim()}…` : text;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getBucketLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "I dag";
  if (isSameDay(date, yesterday)) return "I går";

  return date.toLocaleDateString("no-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function groupChats(chats: ChatSession[]) {
  const groups: Record<string, ChatSession[]> = {};

  chats.forEach((chat) => {
    const label = getBucketLabel(chat.updatedAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(chat);
  });

  return Object.entries(groups);
}

export function buildRequestHistory(messages: Message[]): ApiMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-6);
}
