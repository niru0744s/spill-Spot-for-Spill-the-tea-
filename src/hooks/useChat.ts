/**
 * useChat.ts
 * ----------
 * Firebase Data Connect hook for all chat and message operations.
 *
 * Uses the auto-generated SDK from src/dataconnect-generated/
 * which was generated from:
 *   dataconnect/default_connector/queries.gql
 *   dataconnect/default_connector/mutations.gql
 *
 * Exposes:
 *
 *  State
 *    chats        — GetMyChatsData['chatParticipants'] | null
 *    messages     — GetChatMessagesData['messages'] | null
 *    isLoading    — True while any operation is in flight
 *    error        — Last error message | null
 *
 *  Chat Actions
 *    fetchMyChats()                        — Load signed-in user's inbox
 *    findOrCreateChat(otherUserId)         — Find existing or create new 1:1 chat
 *
 *  Message Actions
 *    fetchChatMessages(chatId)             — Load message history for a chat
 *    sendMessage(chatId, receiverId, content, type?) — Send a message
 *    clearMessages()                       — Reset message list on screen exit
 *
 *  User Actions
 *    fetchUserProfile(userId)              — Get any user's public profile
 *    updatePresence()                      — Mark current user as last-seen now
 */

import { useState, useCallback } from "react";

// Generated SDK — fully typed from your .gql files
import {
  getMyChats,
  findExistingChat,
  getChatMessages,
  getUserProfile,
  createChat,
  addChatParticipants,
  sendMessage as dcSendMessage,
  updateLastSeen,
  type GetMyChatsData,
  type GetChatMessagesData,
  type GetUserProfileData,
} from "@/dataconnect-generated";

import { useAuthStore } from "@/store/authStore";

// ---------------------------------------------------------------------------
// Types (exported so screens can type-annotate without importing generated SDK)
// ---------------------------------------------------------------------------

export type ChatListItem = GetMyChatsData["chatParticipants"][0];
export type MessageItem = GetChatMessagesData["messages"][0];
export type UserProfileData = NonNullable<GetUserProfileData["user"]>;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parseDCError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/** Returns current time as a Timestamp string (ISO 8601) */
function nowTimestamp(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// useChat hook
// ---------------------------------------------------------------------------

export function useChat() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);

  const [chats, setChats] = useState<ChatListItem[] | null>(null);
  const [messages, setMessages] = useState<MessageItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // fetchMyChats — GetMyChats query
  // -------------------------------------------------------------------------
  const fetchMyChats = useCallback(async (): Promise<ChatListItem[] | null> => {
    if (!firebaseUser) {
      setError("You must be signed in to view chats.");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getMyChats();
      const data = result.data.chatParticipants;
      setChats(data);
      return data;
    } catch (err) {
      setError(parseDCError(err));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUser]);

  // -------------------------------------------------------------------------
  // findOrCreateChat — FindExistingChat query + CreateChat + AddChatParticipants
  //
  // Checks if a 1:1 chat already exists between the current user and otherUserId.
  // If yes, returns the existing chat ID. If no, creates a new one atomically.
  //
  // @param otherUserId — UUID of the other user
  // @returns chat UUID string or null on error
  // -------------------------------------------------------------------------
  const findOrCreateChat = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!firebaseUser) {
        setError("You must be signed in.");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Step 1 — check if a chat already exists
        const existing = await findExistingChat({ otherUserId });
        const existingChats = existing.data.chatParticipants;

        if (existingChats.length > 0) {
          // Chat already exists — return its ID
          return existingChats[0].chat.id;
        }

        // Step 2 — create a new 1:1 chat row
        const now = nowTimestamp();
        const createResult = await createChat({ now });
        const newChatId = createResult.data.chat_insert.id;

        // Step 3 — add both participants atomically
        await addChatParticipants({
          chatId: newChatId,
          userAId: firebaseUser.uid,
          userBId: otherUserId,
          now,
        });

        return newChatId;
      } catch (err) {
        setError(parseDCError(err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [firebaseUser]
  );

  // -------------------------------------------------------------------------
  // fetchChatMessages — GetChatMessages query
  // -------------------------------------------------------------------------
  const fetchChatMessages = useCallback(
    async (chatId: string): Promise<MessageItem[] | null> => {
      if (!firebaseUser) {
        setError("You must be signed in.");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getChatMessages({ chatId });
        const data = result.data.messages;
        setMessages(data);
        return data;
      } catch (err) {
        setError(parseDCError(err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [firebaseUser]
  );

  // -------------------------------------------------------------------------
  // sendMessage — SendMessage mutation
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (
      chatId: string,
      receiverId: string,
      content: string,
      messageType: string = "TEXT"
    ): Promise<boolean> => {
      if (!firebaseUser) {
        setError("You must be signed in to send messages.");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        await dcSendMessage({
          chatId,
          senderId: firebaseUser.uid,
          receiverId,
          content,
          messageType,
          now: nowTimestamp(),
        });
        return true;
      } catch (err) {
        setError(parseDCError(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [firebaseUser]
  );

  // -------------------------------------------------------------------------
  // fetchUserProfile — GetUserProfile query
  // -------------------------------------------------------------------------
  const fetchUserProfile = useCallback(
    async (userId: string): Promise<UserProfileData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getUserProfile({ userId });
        return result.data.user ?? null;
      } catch (err) {
        setError(parseDCError(err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // updatePresence — UpdateLastSeen mutation
  // Call this when the app comes to foreground or user opens the app.
  // -------------------------------------------------------------------------
  const updatePresence = useCallback(async (): Promise<void> => {
    if (!firebaseUser) return;

    try {
      await updateLastSeen({
        userId: firebaseUser.uid,
        now: nowTimestamp(),
      });
    } catch {
      // Silently ignore — presence is best-effort
    }
  }, [firebaseUser]);

  // -------------------------------------------------------------------------
  // clearMessages — call when leaving a chat screen
  // -------------------------------------------------------------------------
  const clearMessages = useCallback(() => {
    setMessages(null);
    setError(null);
  }, []);

  return {
    // ── State ──────────────────────────────────────────────────────────────
    chats,
    messages,
    isLoading,
    error,

    // ── Chat Actions ───────────────────────────────────────────────────────
    fetchMyChats,
    findOrCreateChat,

    // ── Message Actions ────────────────────────────────────────────────────
    fetchChatMessages,
    sendMessage,
    clearMessages,

    // ── User Actions ───────────────────────────────────────────────────────
    fetchUserProfile,
    updatePresence,
  } as const;
}
