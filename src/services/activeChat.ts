/**
 * services/activeChat.ts
 * -----------------------
 * Module-level singleton tracking the currently open chatId.
 * Used by the global message listener to decide whether to
 * increment unread count (skip if user is already in that chat).
 */

let _activeChatId: string | null = null;

export function setActiveChatId(id: string | null): void {
  _activeChatId = id;
}

export function getActiveChatId(): string | null {
  return _activeChatId;
}
