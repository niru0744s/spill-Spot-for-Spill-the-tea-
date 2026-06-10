/**
 * app/chat/[id].tsx
 * ------------------
 * Real-time 1:1 chat screen — MMKV local-first + Firestore WebSocket.
 *
 * Navigation params (all strings):
 *   id          — OTHER user's Firebase UID (chatId derived from both UIDs)
 *   username    — other user's display name
 *   photoURL    — other user's avatar URL (or "null")
 *   isOnline    — "true" | "false"
 *
 * Architecture:
 *   - chatId = buildChatId(myUid, partnerUid)  (deterministic, sorted)
 *   - Messages read from MMKV on mount (instant, no network)
 *   - useRealtimeChat attaches Firestore onSnapshot → new messages push in
 *   - sendMessage writes to MMKV first (optimistic) then Firestore async
 *   - Typing indicator: ephemeral Firestore docs with 3s TTL
 *   - Offline: NetInfo detects, queues failed sends, retries on reconnect
 */

import { auth, db } from '@/config/firebase';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { setActiveChatId } from '@/services/activeChat';
import type { StoredMessage } from '@/services/chatStorage';
import { buildChatId, clearDraft, getChatMeta, getDraft, saveChatMeta, saveDraft } from '@/services/chatStorage';
import { sendMessage as sendMsg } from '@/services/messageService';
import { getMillis, isUserOnline, getPresenceLabel } from '@/services/presenceService';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/* ── Design tokens ─────────────────────────────────── */
const C = {
  background:              '#0f150e',
  surfaceContainer:        '#1b211a',
  surfaceContainerHigh:    '#262b24',
  surfaceContainerHighest: '#31362f',
  primaryContainer:        '#96f996',
  primaryFixed:            '#96f996',
  primaryFixedDim:         '#7adc7d',
  onPrimaryFixed:          '#002105',
  onPrimaryContainer:      '#037524',
  onSurface:               '#dfe4d9',
  onSurfaceVariant:        '#becab9',
  outlineVariant:          '#3f4a3d',
  errorColor:              '#ff6b6b',
  white:                   '#ffffff',
};

/* ── Typing indicator dots ─────────────────────────── */
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -6, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(560),
        ])
      );
    bounce(dot1, 0).start();
    bounce(dot2, 160).start();
    bounce(dot3, 320).start();
  }, []);

  return (
    <View style={styles.typingBubble}>
      {[dot1, dot2, dot3].map((anim, i) => (
        <Animated.View key={i} style={[styles.typingDot, { transform: [{ translateY: anim }] }]} />
      ))}
    </View>
  );
}

/* ── Date divider ──────────────────────────────────── */
function DateDivider({ label }: { label: string }) {
  return (
    <View style={styles.dateDividerRow}>
      <Text style={styles.dateDividerText}>{label}</Text>
    </View>
  );
}

/* ── Status tick ───────────────────────────────────── */
function StatusTick({ status }: { status: StoredMessage['status'] }) {
  if (status === 'SENDING') {
    return <ActivityIndicator size={10} color={C.onSurfaceVariant} style={{ marginLeft: 4 }} />;
  }
  if (status === 'FAILED') {
    return <MaterialIcons name="error-outline" size={12} color={C.errorColor} style={{ marginLeft: 4 }} />;
  }
  const isRead = status === 'READ';
  const isDelivered = status === 'DELIVERED' || isRead;
  return (
    <MaterialIcons
      name={isDelivered ? 'done-all' : 'done'}
      size={13}
      color={isRead ? C.primaryFixedDim : C.onSurfaceVariant}
      style={{ marginLeft: 3 }}
    />
  );
}

/* ── Message bubble ─────────────────────────────────── */
function MessageBubble({
  item,
  prevItem,
}: {
  item: StoredMessage;
  prevItem?: StoredMessage;
}) {
  const isGrouped = prevItem &&
    prevItem.isMine === item.isMine &&
    item.createdAt - prevItem.createdAt < 60_000; // within 1 minute

  const timeLabel = new Date(item.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[
      styles.bubbleRow,
      item.isMine ? styles.bubbleRowOut : styles.bubbleRowIn,
      isGrouped ? styles.bubbleGrouped : styles.bubbleFirst,
    ]}>
      <View style={[
        styles.bubble,
        item.isMine ? styles.bubbleOut : styles.bubbleIn,
        item.isMine ? styles.bubbleOutCorner : styles.bubbleInCorner,
      ]}>
        <Text style={[styles.bubbleText, item.isMine ? styles.bubbleTextOut : styles.bubbleTextIn]}>
          {item.content}
        </Text>
      </View>

      {/* Outgoing: time + tick */}
      {item.isMine && (
        <View style={styles.metaRow}>
          <Text style={styles.metaTime}>{timeLabel}</Text>
          <StatusTick status={item.status} />
        </View>
      )}
      {/* Incoming: time only on last in group */}
      {!item.isMine && !isGrouped && (
        <Text style={styles.metaTimeIn}>{timeLabel}</Text>
      )}
    </View>
  );
}

/* ── Offline banner ─────────────────────────────────── */
function OfflineBanner() {
  return (
    <View style={styles.offlineBanner}>
      <MaterialIcons name="wifi-off" size={14} color={C.onSurfaceVariant} />
      <Text style={styles.offlineBannerText}>No connection — messages will retry automatically</Text>
    </View>
  );
}

/* ── Premium Skeleton Loader ────────────────────────── */
function ChatSkeleton() {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.skeletonContainer}>
      <Animated.View style={[styles.skeletonRow, styles.skeletonRowIn, { opacity: shimmerAnim }]}>
        <View style={[styles.skeletonBubble, styles.skeletonBubbleIn, { width: 120 }]} />
      </Animated.View>

      <Animated.View style={[styles.skeletonRow, styles.skeletonRowOut, { opacity: shimmerAnim }]}>
        <View style={[styles.skeletonBubble, styles.skeletonBubbleOut, { width: 180 }]} />
      </Animated.View>

      <Animated.View style={[styles.skeletonRow, styles.skeletonRowIn, { opacity: shimmerAnim }]}>
        <View style={[styles.skeletonBubble, styles.skeletonBubbleIn, { width: 90 }]} />
      </Animated.View>

      <Animated.View style={[styles.skeletonRow, styles.skeletonRowOut, { opacity: shimmerAnim }]}>
        <View style={[styles.skeletonBubble, styles.skeletonBubbleOut, { width: 140 }]} />
      </Animated.View>
    </View>
  );
}

/* ── Main Screen ────────────────────────────────────── */
export default function ChatRoomScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{
    id: string;
    username: string;
    photoURL: string;
    isOnline: string;
  }>();

  const partnerUid  = params.id;
  const username    = params.username ?? 'Tea Friend';
  const photoURL    = params.photoURL && params.photoURL !== 'null' ? params.photoURL : null;
  const isOnline    = params.isOnline === 'true';
  const currentUid  = auth.currentUser?.uid ?? '';

  // Deterministic chat ID
  const chatId = buildChatId(currentUid, partnerUid);

  const [partnerOnline, setPartnerOnline] = useState(isOnline);
  const [partnerPhotoURL, setPartnerPhotoURL] = useState<string | null>(photoURL);
  const [partnerActiveChatId, setPartnerActiveChatId] = useState<string | null>(null);
  const [partnerLastSeen, setPartnerLastSeen] = useState<number>(() => {
    const meta = getChatMeta(chatId);
    return meta?.partnerLastSeen ?? Date.now();
  });
  const [presenceLabel, setPresenceLabel] = useState<string>('Offline');
  const [isLoading, setIsLoading] = useState(true);

  // Premium quick-load transition when entering a chat
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [chatId]);

  // Sync partner online status & photoURL in real-time & update local chat metadata cache
  useEffect(() => {
    if (!partnerUid) return;
    const partnerDocRef = doc(db, 'users', partnerUid);
    const unsub = onSnapshot(partnerDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const online = !!data.isOnline;
        const activeChat = data.activeChatId ?? null;
        const livePhoto = data.photoURL && data.photoURL !== 'null' ? data.photoURL : null;
        const lastSeenMs = data.lastSeen ? getMillis(data.lastSeen) : Date.now();
        
        setPartnerOnline(online);
        setPartnerPhotoURL(livePhoto);
        setPartnerActiveChatId(activeChat);
        setPartnerLastSeen(lastSeenMs);

        // Update local metadata cache reactively
        const existingMeta = getChatMeta(chatId);
        if (existingMeta) {
          saveChatMeta({
            ...existingMeta,
            partnerOnline: online,
            partnerPhoto: livePhoto,
            partnerLastSeen: lastSeenMs,
          });
        }
      }
    });
    return () => unsub();
  }, [partnerUid, chatId]);

  // Save partner metadata for chat list
  useEffect(() => {
    if (!currentUid || !partnerUid) return;
    const existing = getChatMeta(chatId);
    saveChatMeta({
      chatId,
      partnerUid,
      partnerName: username,
      partnerPhoto: partnerPhotoURL,
      partnerOnline: partnerOnline,
      lastMessage: existing?.lastMessage ?? '',
      lastMessageAt: existing?.lastMessageAt ?? Date.now(),
      isBackedUp: existing?.isBackedUp ?? false,
      partnerLastSeen: partnerLastSeen,
    });
  }, [chatId, partnerPhotoURL, partnerOnline, partnerLastSeen, currentUid, partnerUid, username]);

  const {
    messages,
    isOtherTyping,
    isOnline: networkOnline,
    appendLocalMessage,
    updateLocalStatus,
    markAsRead,
    notifyTyping,
    stopTyping,
  } = useRealtimeChat(chatId);

  // Dynamic presence label countdown logic
  useEffect(() => {
    const updateLabel = () => {
      if (isOtherTyping) {
        setPresenceLabel('typing...');
      } else {
        const label = getPresenceLabel(partnerLastSeen, partnerOnline, partnerActiveChatId, chatId);
        setPresenceLabel(label);
      }
    };

    updateLabel();

    const interval = setInterval(updateLabel, 30 * 1000); // refresh time-ago label every 30s
    return () => clearInterval(interval);
  }, [isOtherTyping, partnerLastSeen, partnerOnline, partnerActiveChatId, chatId]);

  // Tell the global listener and Firestore that this chat is actively open
  useEffect(() => {
    if (!currentUid) return;
    setActiveChatId(chatId);

    // Set activeChatId in Firestore
    const userDocRef = doc(db, 'users', currentUid);
    updateDoc(userDocRef, { activeChatId: chatId }).catch(() => {});

    return () => {
      setActiveChatId(null);
      updateDoc(userDocRef, { activeChatId: null }).catch(() => {});
    };
  }, [chatId, currentUid]);

  // Mark partner messages as READ whenever this screen is active
  useEffect(() => { markAsRead(); }, [chatId]);
  useFocusEffect(useCallback(() => { markAsRead(); }, [markAsRead]));

  const [inputText, setInputText]     = useState(() => getDraft(chatId));
  const [inputHeight, setInputHeight] = useState(44);
  const flatListRef = useRef<FlatList>(null);

  const isInitialLoadRef = useRef(true);
  const openedAtRef = useRef(Date.now());

  // Reset initial load flag & openedAt when chat room changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    openedAtRef.current = Date.now();
  }, [chatId]);

  // Remove manual scroll because we use `inverted` on the FlatList instead.

  // Persist draft on change
  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    saveDraft(chatId, text);
    if (text.trim()) notifyTyping();
    else stopTyping();
  }, [chatId, notifyTyping, stopTyping]);

  // Send message
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !currentUid) return;

    setInputText('');
    setInputHeight(44);
    clearDraft(chatId);
    stopTyping();

    const msg = await sendMsg({
      chatId,
      senderUid: currentUid,
      content: text,
      type: 'TEXT',
      partnerMeta: {
        partnerUid,
        partnerName: username,
        partnerPhoto: photoURL,
        partnerOnline: isOnline,
      },
    });

    appendLocalMessage(msg);
  }, [inputText, currentUid, chatId, partnerUid, username, photoURL, isOnline, appendLocalMessage, stopTyping]);

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  // Reverse messages for the inverted FlatList (newest at index 0)
  const reversedMessages = [...messages].reverse();

  const renderItem = ({ item, index }: { item: StoredMessage; index: number }) => {
    // In a reversed array, the chronological "previous" message is at index + 1
    const prevItem = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : undefined;
    return <MessageBubble item={item} prevItem={prevItem} />;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >

      {/* ── Offline banner ─────────────────────────────── */}
      {!networkOnline && <OfflineBanner />}

      {/* ── Header ───────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/chats')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color={C.onSurfaceVariant} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerProfile} activeOpacity={0.85}>
          <View style={styles.headerAvatarWrap}>
            {partnerPhotoURL ? (
              <Image source={{ uri: partnerPhotoURL }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.headerAvatarInitial}>{getInitial(username)}</Text>
              </View>
            )}
            {isUserOnline(partnerLastSeen, partnerOnline) && <View style={styles.headerOnlineDot} />}
          </View>
          <View>
            <Text style={styles.headerName}>{username}</Text>
            <Text style={[styles.headerStatus, isUserOnline(partnerLastSeen, partnerOnline) && styles.headerStatusOnline]}>
              {presenceLabel}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <MaterialIcons name="videocam" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <MaterialIcons name="info-outline" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages ─────────────────────────────────── */}
      {/* {isLoading ? (
        <ChatSkeleton />
      ) : ( */}
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListFooterComponent={<DateDivider label="TODAY" />}
          ListHeaderComponent={isOtherTyping ? <TypingIndicator /> : null}
          contentContainerStyle={[
            styles.messageList,
            { paddingVertical: 16 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      {/* )} */}

      {/* ── Input bar ────────────────────────────────── */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity style={styles.inputIconBtn} activeOpacity={0.7}>
            <MaterialIcons name="add-circle-outline" size={26} color={C.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={styles.inputPill}>
            <TextInput
              style={[styles.textInput, { height: Math.max(44, inputHeight) }]}
              placeholder="Spill the tea..."
              placeholderTextColor="rgba(190,202,185,0.45)"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              onContentSizeChange={(e) => {
                const h = e.nativeEvent.contentSize.height;
                setInputHeight(Math.min(h, 110));
              }}
              blurOnSubmit={false}
            />
            <TouchableOpacity style={styles.emojiBtn} activeOpacity={0.7}>
              <MaterialIcons name="mood" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, inputText.trim().length > 0 && styles.sendBtnActive]}
            onPress={handleSend}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="send"
              size={20}
              color={inputText.trim().length > 0 ? C.onPrimaryContainer : C.onSurfaceVariant}
            />
          </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}

/* ── StyleSheet ──────────────────────────────────────── */
const styles = StyleSheet.create({
  container:               { flex: 1, backgroundColor: C.background },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,107,107,0.12)',
    paddingHorizontal: 16, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,107,107,0.2)',
  },
  offlineBannerText:       { fontSize: 12, color: C.onSurfaceVariant, flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: 'rgba(15,21,14,0.92)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#96f996', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 6, zIndex: 10,
  },
  headerIconBtn:           { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerProfile:           { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  headerAvatarWrap:        { position: 'relative', width: 40, height: 40 },
  headerAvatar:            { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.surfaceContainerHighest },
  headerAvatarFallback:    { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(122,220,125,0.18)', borderWidth: 2, borderColor: 'rgba(122,220,125,0.35)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarInitial:     { fontSize: 18, fontWeight: '800', color: C.primaryFixedDim },
  headerOnlineDot:         { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: C.primaryFixed, borderWidth: 2, borderColor: C.background },
  headerName:              { fontSize: 17, fontWeight: '700', color: C.onSurface, letterSpacing: -0.3 },
  headerStatus:            { fontSize: 12, fontWeight: '500', color: C.onSurfaceVariant, marginTop: 1 },
  headerStatusOnline:      { color: C.primaryFixedDim },
  headerActions:           { flexDirection: 'row', gap: 2 },

  messageList:             { paddingHorizontal: 16, paddingTop: 8 },

  dateDividerRow:          { alignItems: 'center', marginVertical: 16 },
  dateDividerText:         { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 1.5, backgroundColor: 'rgba(27,33,26,0.7)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 9999, overflow: 'hidden' },

  bubbleRow:               { maxWidth: '82%', marginBottom: 2 },
  bubbleRowIn:             { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubbleRowOut:            { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleFirst:             { marginTop: 6 },
  bubbleGrouped:           { marginTop: 2 },

  bubble:                  { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 20 },
  bubbleIn:                { backgroundColor: C.surfaceContainerHigh, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bubbleOut:               { backgroundColor: C.primaryFixed, shadowColor: '#96f996', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 6 },
  bubbleInCorner:          { borderBottomLeftRadius: 4 },
  bubbleOutCorner:         { borderBottomRightRadius: 4 },
  bubbleText:              { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  bubbleTextIn:            { color: C.onSurface },
  bubbleTextOut:           { color: C.onPrimaryFixed },

  metaRow:                 { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginRight: 4 },
  metaTime:                { fontSize: 10, fontWeight: '600', color: C.onSurfaceVariant, letterSpacing: 0.3 },
  metaTimeIn:              { fontSize: 10, fontWeight: '600', color: C.onSurfaceVariant, letterSpacing: 0.3, marginTop: 4, marginLeft: 4, marginBottom: 4 },

  typingBubble:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surfaceContainerHigh, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 20, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 14, alignSelf: 'flex-start', marginTop: 6, marginLeft: 16, marginBottom: 8, width: 68 },
  typingDot:               { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryFixed },

  inputBar:                { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 12, backgroundColor: 'rgba(15,21,14,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 6 },
  inputIconBtn:            { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  inputPill:               { flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.surfaceContainerHighest, borderRadius: 24, borderWidth: 1.5, borderColor: C.outlineVariant, paddingHorizontal: 14, paddingVertical: 4, minHeight: 50 },
  textInput:               { flex: 1, fontSize: 16, fontWeight: '400', color: C.onSurface, paddingTop: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 10 : 8, maxHeight: 110 },
  emojiBtn:                { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  sendBtn:                 { width: 46, height: 46, borderRadius: 23, backgroundColor: C.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  sendBtnActive:           { backgroundColor: C.primaryContainer, shadowColor: '#96f996', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },

  // Skeleton Styling
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  skeletonRow: {
    maxWidth: '82%',
    marginBottom: 4,
  },
  skeletonRowIn: {
    alignSelf: 'flex-start',
  },
  skeletonRowOut: {
    alignSelf: 'flex-end',
  },
  skeletonBubble: {
    height: 44,
    borderRadius: 20,
  },
  skeletonBubbleIn: {
    backgroundColor: C.surfaceContainerHigh,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  skeletonBubbleOut: {
    backgroundColor: 'rgba(150, 249, 150, 0.15)',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(150, 249, 150, 0.25)',
  },
});
