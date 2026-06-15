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
import { useWallet } from '@/hooks/useWallet';
import { setActiveChatId } from '@/services/activeChat';
import type { StoredMessage } from '@/services/chatStorage';
import { buildChatId, clearDraft, getChatMeta, getDraft, saveChatMeta, saveDraft, editMessageLocally, deleteMessageLocally, markMessageAsDeletedLocally } from '@/services/chatStorage';
import { sendMessage as sendMsg, sendEditSignal, sendDeleteSignal, EDIT_DELETE_WINDOW_MS, sendMediaMessage, deleteLocalMediaFile } from '@/services/messageService';
import { getMillis, isUserOnline, getPresenceLabel } from '@/services/presenceService';
import { triggerMediumImpact, triggerHeavyImpact, triggerSuccessNotification, triggerSelection } from '@/services/hapticService';
import { initiateCall } from '@/services/callService';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  memo,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  TouchableOpacity,
  View,
  Modal,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

const getMessageTime = (msg: StoredMessage | null | undefined): number => {
  if (!msg) return Date.now();
  const t = msg.createdAt;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') return new Date(t).getTime();
  if (t && typeof t === 'object') {
    if ('toMillis' in t && typeof (t as any).toMillis === 'function') {
      return (t as any).toMillis();
    }
    if ('seconds' in t) {
      return (t as any).seconds * 1000;
    }
  }
  return Date.now();
};

/* ── Typing indicator dots ─────────────────────────── */
function TypingIndicator() {
  const styles = useStyles(getStyles);
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
  const styles = useStyles(getStyles);
  return (
    <View style={styles.dateDividerRow}>
      <Text style={styles.dateDividerText}>{label}</Text>
    </View>
  );
}

/* ── Status tick ───────────────────────────────────── */
function StatusTick({ status }: { status: StoredMessage['status'] }) {
  const { colors: C } = useTheme();
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

/* ── Audio player component inside bubble ────────────── */
const AudioPlayerBubbleInner = memo(function AudioPlayerBubbleInner({
  localUri,
  isMine,
  status,
}: {
  localUri: string;
  isMine: boolean;
  status: string;
}) {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  const { width: windowWidth } = useWindowDimensions();
  const audioWidth = Math.min(200, Math.max(162, windowWidth * 0.54));
  const audioSource = Platform.OS === 'android' && localUri.startsWith('file://')
    ? localUri.replace('file://', '')
    : localUri;

  const [fileSizeLabel, setFileSizeLabel] = useState<string>('...');

  useEffect(() => {
    if (Platform.OS === 'web') {
      setFileSizeLabel('Web');
      return;
    }
    try {
      const file = new File(localUri);
      if (!file.exists) {
        setFileSizeLabel('Missing');
      } else {
        setFileSizeLabel(`${(file.size / 1024).toFixed(1)}KB`);
      }
    } catch {
      setFileSizeLabel('Err');
    }
  }, [localUri]);

  const player = useAudioPlayer(audioSource);
  const playerStatus = useAudioPlayerStatus(player);

  const isPlaying = playerStatus.playing;
  const duration = playerStatus.duration; // in seconds
  const currentTime = playerStatus.currentTime; // in seconds

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        player.pause();
      } else {
        if (duration && currentTime >= duration) {
          await player.seekTo(0);
        }
        player.play();
      }
    } catch (err) {
      console.error('[AudioPlayerBubble] Playback error:', err);
    }
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <View style={[styles.audioBubble, { width: audioWidth }]}>
      <TouchableOpacity onPress={handlePlayPause} style={styles.audioPlayBtn} activeOpacity={0.85}>
        <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={20} color={C.onPrimaryFixed} />
      </TouchableOpacity>
      <View style={styles.audioTrackWrap}>
        <View style={styles.audioProgressBarBg}>
          <View style={[styles.audioProgressBar, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.audioTimeText}>
          {formatAudioTime(currentTime)} / {duration ? formatAudioTime(duration) : '0:00'} ({fileSizeLabel})
        </Text>
      </View>
    </View>
  );
});

const AudioPlayerBubble = memo(function AudioPlayerBubble({
  localUri,
  isMine,
  status,
}: {
  localUri?: string;
  isMine: boolean;
  status: string;
}) {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  const { width: windowWidth } = useWindowDimensions();
  const audioWidth = Math.min(200, Math.max(162, windowWidth * 0.54));
  if (!localUri) {
    return (
      <View style={[styles.audioBubble, { width: audioWidth }]}>
        <ActivityIndicator size="small" color={C.onSurfaceVariant} />
        <Text style={styles.mediaPlaceholderText}>Loading audio...</Text>
      </View>
    );
  }

  return <AudioPlayerBubbleInner localUri={localUri} isMine={isMine} status={status} />;
});

/* ── Message bubble ─────────────────────────────────── */
const MessageBubble = memo(function MessageBubble({
  item,
  prevItem,
  onLongPress,
  setLightboxUri,
  setLightboxVisible,
  setVideoPlayerUri,
  setVideoModalVisible,
  payRequest,
  declineRequest,
}: {
  item: StoredMessage;
  prevItem?: StoredMessage;
  onLongPress?: () => void;
  setLightboxUri: (uri: string | null) => void;
  setLightboxVisible: (visible: boolean) => void;
  setVideoPlayerUri: (uri: string | null) => void;
  setVideoModalVisible: (visible: boolean) => void;
  payRequest?: (requestId: string) => Promise<{ success: boolean; message: string }>;
  declineRequest?: (requestId: string) => Promise<{ success: boolean; message: string }>;
}) {
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const { width: windowWidth } = useWindowDimensions();
  const compactMediaWidth = Math.min(220, Math.max(168, windowWidth * 0.58));
  const compactVideoHeight = Math.round(compactMediaWidth * 0.64);
  const compactImageHeight = Math.round(compactMediaWidth * 0.72);
  const compactCardWidth = Math.min(220, Math.max(172, windowWidth * 0.6));
  const isGrouped = prevItem &&
    prevItem.isMine === item.isMine &&
    item.createdAt - prevItem.createdAt < 60_000; // within 1 minute

  const timeLabel = new Date(item.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleMediaPress = () => {
    if (item.type === 'IMAGE' && item.localUri) {
      setLightboxUri(item.localUri);
      setLightboxVisible(true);
    } else if (item.type === 'VIDEO' && item.localUri) {
      setVideoPlayerUri(item.localUri);
      setVideoModalVisible(true);
    } else if (item.type === 'FILE' && item.localUri) {
      Sharing.shareAsync(item.localUri).catch(err => console.error('[MessageBubble] Share failed:', err));
    }
  };

  const renderBubbleContent = () => {
    const isMine = item.isMine;

    if (item.type === 'DELETED') {
      return (
        <View style={styles.deletedBubble}>
          <MaterialIcons name="block" size={16} color={C.onSurfaceVariant} style={{ marginRight: 6 }} />
          <Text style={styles.deletedText}>
            {item.isMine ? 'You deleted this message' : 'This message was deleted'}
          </Text>
        </View>
      );
    }

    if (item.type === 'IMAGE') {
      return (
        <View style={[styles.imageBubbleWrap, { width: compactMediaWidth, height: compactImageHeight }]}>
          {item.localUri ? (
            <ExpoImage source={{ uri: item.localUri }} style={styles.imageBubble} contentFit="cover" />
          ) : (
            <View style={styles.mediaPlaceholder}>
              <ActivityIndicator size="small" color={C.primaryFixedDim} />
              <Text style={styles.mediaPlaceholderText}>Loading photo...</Text>
            </View>
          )}
          {item.status === 'SENDING' && (
            <View style={styles.uploadProgressOverlay}>
              <ActivityIndicator size="small" color={C.white} />
            </View>
          )}
        </View>
      );
    }

    if (item.type === 'VIDEO') {
      return (
        <View style={[styles.videoBubbleWrap, { width: compactMediaWidth, height: compactVideoHeight }]}>
          {item.localUri ? (
            <View style={{ position: 'relative', width: '100%', height: '100%' }}>
              <View style={styles.videoThumbnailPlaceholder}>
                <MaterialIcons name="videocam" size={28} color={C.onSurfaceVariant} />
                <Text style={styles.mediaPlaceholderText}>Tap to play video</Text>
              </View>
              <View style={styles.videoPlayOverlay}>
                <MaterialIcons name="play-circle-outline" size={44} color={C.white} />
              </View>
            </View>
          ) : (
            <View style={styles.mediaPlaceholder}>
              <ActivityIndicator size="small" color={C.primaryFixedDim} />
              <Text style={styles.mediaPlaceholderText}>Loading video...</Text>
            </View>
          )}
          {item.status === 'SENDING' && (
            <View style={styles.uploadProgressOverlay}>
              <ActivityIndicator size="small" color={C.white} />
            </View>
          )}
        </View>
      );
    }

    if (item.type === 'AUDIO') {
      return (
        <AudioPlayerBubble localUri={item.localUri} isMine={isMine} status={item.status} />
      );
    }

    if (item.type === 'FILE') {
      const sizeMB = item.fileSize ? (item.fileSize / (1024 * 1024)).toFixed(1) : '?';
      return (
        <View style={[styles.fileBubble, { width: compactCardWidth }]}>
          <View style={styles.fileIconBg}>
            <MaterialIcons name="insert-drive-file" size={20} color={C.onPrimaryFixed} />
          </View>
          <View style={styles.fileMeta}>
            <Text style={[styles.fileNameText, isMine ? { color: C.onPrimaryFixed } : { color: C.onSurface }]} numberOfLines={1}>
              {item.fileName || 'Document'}
            </Text>
            <Text style={styles.fileSizeText}>
              {sizeMB} MB • File
            </Text>
          </View>
          {(!item.localUri && item.status !== 'SENDING') ? (
            <ActivityIndicator size="small" color={C.primaryFixedDim} style={{ marginLeft: 8 }} />
          ) : item.status === 'SENDING' ? (
            <ActivityIndicator size="small" color={C.white} style={{ marginLeft: 8 }} />
          ) : (
            <MaterialIcons name="open-in-new" size={16} color={isMine ? C.onPrimaryFixed : C.onSurfaceVariant} style={{ marginLeft: 8 }} />
          )}
        </View>
      );
    }

    if (item.type === 'TRANSACTION') {
      let txData: { amount: number; type: string; reference: string; note?: string } | null = null;
      try {
        txData = JSON.parse(item.content);
      } catch (e) {}

      if (txData) {
        const isMine = item.isMine;
        const amountStr = `₹${(txData.amount / 100).toFixed(2)}`;
        return (
          <View style={[styles.transactionCard, { width: compactCardWidth, backgroundColor: isMine ? (isDark ? 'rgba(76,175,80,0.12)' : 'rgba(76,175,80,0.06)') : (isDark ? 'rgba(244,67,54,0.12)' : 'rgba(244,67,54,0.06)') }]}>
            <View style={styles.transactionHeader}>
              <MaterialIcons
                name={isMine ? 'arrow-upward' : 'arrow-downward'}
                size={18}
                color={isMine ? C.primary : C.errorColor}
              />
              <Text style={[styles.transactionTitle, { color: C.onSurface }]}>
                {isMine ? 'Sent Funds' : 'Received Funds'}
              </Text>
            </View>
            <Text style={[styles.transactionAmount, { color: isMine ? C.primary : C.errorColor }]}>
              {isMine ? `-${amountStr}` : `+${amountStr}`}
            </Text>
            {!!txData.note && (
              <Text style={[styles.transactionNote, { color: C.onSurfaceVariant }]}>
                "{txData.note}"
              </Text>
            )}
            <Text style={[styles.transactionRef, { color: C.onSurfaceVariant }]}>
              Ref: {txData.reference}
            </Text>
          </View>
        );
      }
    }

    if (item.type === 'PAYMENT_REQUEST') {
      let reqData: { requestId: string; amount: number; note: string; status: string } | null = null;
      try {
        reqData = JSON.parse(item.content);
      } catch (e) {}

      if (reqData) {
        const isMine = item.isMine;
        const amountStr = `₹${(reqData.amount / 100).toFixed(2)}`;
        
        // State and Effect inside bubble to sync the request status from Firestore
        const [reqStatus, setReqStatus] = useState<string>(reqData.status || 'PENDING');
        const [isProcessing, setIsProcessing] = useState(false);

        useEffect(() => {
          if (!reqData?.requestId) return;
          if (reqStatus === 'PAID' || reqStatus === 'DECLINED') {
            return; // Skip listener if status is already terminal
          }
          const docRef = doc(db, 'paymentRequests', reqData.requestId);
          const unsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
              const status = snap.data().status;
              if (status !== reqStatus) {
                setReqStatus(status);
                // Persist the updated status inside the message content locally in MMKV
                try {
                  const updatedContent = JSON.stringify({
                    ...reqData,
                    status: status,
                  });
                  editMessageLocally(item.chatId, item.id, updatedContent);
                } catch (err) {
                  console.warn('[MessageBubble] Failed to save updated request status locally:', err);
                }
              }
            }
          });
          return () => unsub();
        }, [reqData?.requestId, reqStatus, item.chatId, item.id]);

        const handlePay = async () => {
          if (!payRequest || !reqData?.requestId) return;
          setIsProcessing(true);
          try {
            const res = await payRequest(reqData.requestId);
            if (!res.success) {
              alert(res.message);
            }
          } catch (err: any) {
            alert(err.message || 'Payment failed.');
          } finally {
            setIsProcessing(false);
          }
        };

        const handleDecline = async () => {
          if (!declineRequest || !reqData?.requestId) return;
          setIsProcessing(true);
          try {
            const res = await declineRequest(reqData.requestId);
            if (!res.success) {
              alert(res.message);
            }
          } catch (err: any) {
            alert(err.message || 'Decline failed.');
          } finally {
            setIsProcessing(false);
          }
        };

        return (
          <View style={[styles.transactionCard, { width: compactCardWidth, backgroundColor: C.surfaceContainerHighest }]}>
            <View style={styles.transactionHeader}>
              <MaterialIcons name="payment" size={18} color={C.primary} />
              <Text style={[styles.transactionTitle, { color: C.onSurface }]}>
                Payment Request
              </Text>
            </View>
            <Text style={[styles.transactionAmount, { color: C.onSurface }]}>
              {amountStr}
            </Text>
            <Text style={[styles.transactionNote, { color: C.onSurfaceVariant }]}>
              "{reqData.note}"
            </Text>
            
            {reqStatus === 'PENDING' ? (
              isMine ? (
                <View style={styles.requestBadge}>
                  <Text style={[styles.requestBadgeText, { color: C.onSurfaceVariant }]}>
                    Requested • Pending
                  </Text>
                </View>
              ) : (
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.declineButton]}
                    onPress={handleDecline}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={C.onSurfaceVariant} />
                    ) : (
                      <Text style={styles.declineButtonText}>Decline</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.requestButton, styles.payButton]}
                    onPress={handlePay}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={C.white} />
                    ) : (
                      <Text style={styles.payButtonText}>Pay Now</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={[styles.requestBadge, { backgroundColor: reqStatus === 'PAID' ? (isDark ? 'rgba(76,175,80,0.15)' : 'rgba(76,175,80,0.08)') : 'rgba(0,0,0,0.05)' }]}>
                <Text style={[styles.requestBadgeText, { color: reqStatus === 'PAID' ? C.primary : C.onSurfaceVariant }]}>
                  {reqStatus === 'PAID' ? 'Paid ✓' : 'Declined ✗'}
                </Text>
              </View>
            )}
          </View>
        );
      }
    }

    return (
      <Text style={[styles.bubbleText, isMine ? styles.bubbleTextOut : styles.bubbleTextIn]}>
        {item.content}
      </Text>
    );
  };

  const isMedia = item.type !== 'TEXT' && item.type !== 'TRANSACTION' && item.type !== 'PAYMENT_REQUEST';

  return (
    <View style={[
      styles.bubbleRow,
      item.isMine ? styles.bubbleRowOut : styles.bubbleRowIn,
      isGrouped ? styles.bubbleGrouped : styles.bubbleFirst,
    ]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={isMedia && item.type !== 'DELETED' ? handleMediaPress : undefined}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={[
          styles.bubble,
          item.type === 'DELETED'
            ? { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)', paddingHorizontal: 12, paddingVertical: 8 }
            : isMedia
              ? { padding: 4 }
              : (item.isMine ? styles.bubbleOut : styles.bubbleIn),
          item.isMine ? styles.bubbleOutCorner : styles.bubbleInCorner,
        ]}
      >
        {renderBubbleContent()}
      </TouchableOpacity>

      {/* Outgoing: time + tick */}
      {item.isMine && (
        <View style={styles.metaRow}>
          <Text style={styles.metaTime}>{timeLabel}</Text>
          {item.type !== 'DELETED' && <StatusTick status={item.status} />}
        </View>
      )}
      {/* Incoming: time only on last in group */}
      {!item.isMine && !isGrouped && (
        <Text style={styles.metaTimeIn}>{timeLabel}</Text>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.content === nextProps.item.content &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.localUri === nextProps.item.localUri &&
    prevProps.prevItem?.id === nextProps.prevItem?.id &&
    prevProps.prevItem?.createdAt === nextProps.prevItem?.createdAt
  );
});

/* ── Offline banner ─────────────────────────────────── */
function OfflineBanner() {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  return (
    <View style={styles.offlineBanner}>
      <MaterialIcons name="wifi-off" size={14} color={C.onSurfaceVariant} />
      <Text style={styles.offlineBannerText}>No connection — messages will retry automatically</Text>
    </View>
  );
}



function VideoPlayerModal({ uri, visible, onClose }: { uri: string | null; visible: boolean; onClose: () => void }) {
  const player = useVideoPlayer(uri || '', (player) => {
    player.loop = true;
    if (uri) {
      player.play();
    }
  });

  if (!uri) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <VideoView player={player} style={{ width: '100%', height: '80%' }} nativeControls />
        <TouchableOpacity 
          style={{ position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }} 
          onPress={onClose}
        >
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/* ── Main Screen ────────────────────────────────────── */
export default function ChatRoomScreen() {
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isNarrowScreen = windowWidth < 360;
  const params  = useLocalSearchParams<{
    id: string;
    username: string;
    photoURL: string;
    isOnline: string;
  }>();

  const rawId = params.id as string;
  const partnerUid = rawId && rawId.includes('?') ? rawId.split('?')[0] : rawId;
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
    editLocalMessageState,
    deleteLocalMessageState,
    markLocalMessageAsDeletedState,
    markAsRead,
    notifyTyping,
    stopTyping,
  } = useRealtimeChat(chatId);

  const { sendMoney, requestMoney, payRequest, declineRequest } = useWallet();

  // Wallet specific modals and input states
  const [sendMoneyModalVisible, setSendMoneyModalVisible] = useState(false);
  const [requestMoneyModalVisible, setRequestMoneyModalVisible] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const [isSubmittingWallet, setIsSubmittingWallet] = useState(false);

  const handleSendMoneySubmit = async () => {
    const amount = parseFloat(walletAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    setIsSubmittingWallet(true);
    try {
      const res = await sendMoney(partnerUid, amount);
      if (res.success) {
        // Success! Now send a TRANSACTION message in the chat
        const msg = await sendMsg({
          chatId,
          senderUid: currentUid,
          content: JSON.stringify({
            amount: Math.round(amount * 100),
            type: 'SEND_FUNDS',
            reference: (res as any).reference || 'unknown',
            note: walletNote.trim(),
          }),
          type: 'TRANSACTION',
          partnerMeta: {
            partnerUid,
            partnerName: username,
            partnerPhoto: photoURL,
            partnerOnline: isOnline,
          },
        });
        appendLocalMessage(msg);
        setSendMoneyModalVisible(false);
        setWalletAmount('');
        setWalletNote('');
        alert(res.message);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to transfer funds.');
    } finally {
      setIsSubmittingWallet(false);
    }
  };

  const handleRequestMoneySubmit = async () => {
    const amount = parseFloat(walletAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    const noteText = walletNote.trim();
    if (!noteText) {
      alert('Please enter a description/note for the request.');
      return;
    }
    setIsSubmittingWallet(true);
    try {
      const res = await requestMoney(partnerUid, amount, noteText);
      if (res.success && res.request) {
        // Success! Now send a PAYMENT_REQUEST message in the chat
        const msg = await sendMsg({
          chatId,
          senderUid: currentUid,
          content: JSON.stringify({
            requestId: res.request.id,
            amount: Math.round(amount * 100),
            note: noteText,
            status: 'PENDING',
          }),
          type: 'PAYMENT_REQUEST',
          partnerMeta: {
            partnerUid,
            partnerName: username,
            partnerPhoto: photoURL,
            partnerOnline: isOnline,
          },
        });
        appendLocalMessage(msg);
        setRequestMoneyModalVisible(false);
        setWalletAmount('');
        setWalletNote('');
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to request money.');
    } finally {
      setIsSubmittingWallet(false);
    }
  };

  const [selectedMessage, setSelectedMessage] = useState<StoredMessage | null>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState('');

  // Media & Modal States
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoPlayerUri, setVideoPlayerUri] = useState<string | null>(null);

  // Audio Recording States
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const formatRecordingTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  // Attachment Picker & Sending Callbacks
  const handlePickMedia = async () => {
    setAttachmentModalVisible(false);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert('Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const localUri = asset.uri;
      const type: 'IMAGE' | 'VIDEO' = asset.type === 'video' ? 'VIDEO' : 'IMAGE';
      const fileName = asset.fileName || `${Date.now()}.${type === 'VIDEO' ? 'mp4' : 'jpg'}`;
      const mimeType = type === 'VIDEO' ? 'video/mp4' : 'image/jpeg';

      let fileSize = 0;
      if (Platform.OS === 'web') {
        fileSize = asset.fileSize || (asset as any).size || 0;
        if (!fileSize) {
          try {
            const res = await fetch(localUri);
            const blob = await res.blob();
            fileSize = blob.size;
          } catch (e) {
            console.warn('Failed to fetch media size on web:', e);
          }
        }
      } else {
        const file = new File(localUri);
        if (!file.exists) return;
        fileSize = file.size;
      }

      if (fileSize > 30 * 1024 * 1024) {
        alert('File size exceeds the 30MB limit.');
        return;
      }

      triggerMediumImpact();
      const msg = await sendMediaMessage({
        chatId,
        senderUid: currentUid,
        localUri,
        type,
        fileName,
        fileSize,
        mimeType,
        partnerMeta: {
          partnerUid,
          partnerName: username,
          partnerPhoto: photoURL,
          partnerOnline: isOnline,
        },
      });
      appendLocalMessage(msg);
    } catch (error) {
      console.error('Error picking media:', error);
      alert('Failed to send media.');
    }
  };

  const handleTakeCamera = async () => {
    setAttachmentModalVisible(false);
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        alert('Permission to access camera is required!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const localUri = asset.uri;
      const type: 'IMAGE' | 'VIDEO' = asset.type === 'video' ? 'VIDEO' : 'IMAGE';
      const fileName = asset.fileName || `${Date.now()}.${type === 'VIDEO' ? 'mp4' : 'jpg'}`;
      const mimeType = type === 'VIDEO' ? 'video/mp4' : 'image/jpeg';

      let fileSize = 0;
      if (Platform.OS === 'web') {
        fileSize = asset.fileSize || (asset as any).size || 0;
        if (!fileSize) {
          try {
            const res = await fetch(localUri);
            const blob = await res.blob();
            fileSize = blob.size;
          } catch (e) {
            console.warn('Failed to fetch camera capture size on web:', e);
          }
        }
      } else {
        const file = new File(localUri);
        if (!file.exists) return;
        fileSize = file.size;
      }

      if (fileSize > 30 * 1024 * 1024) {
        alert('File size exceeds the 30MB limit.');
        return;
      }

      triggerMediumImpact();
      const msg = await sendMediaMessage({
        chatId,
        senderUid: currentUid,
        localUri,
        type,
        fileName,
        fileSize,
        mimeType,
        partnerMeta: {
          partnerUid,
          partnerName: username,
          partnerPhoto: photoURL,
          partnerOnline: isOnline,
        },
      });
      appendLocalMessage(msg);
    } catch (error) {
      console.error('Error taking camera photo/video:', error);
      alert('Failed to capture media.');
    }
  };

  const handlePickDocument = async () => {
    setAttachmentModalVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const localUri = asset.uri;
      const fileName = asset.name;
      const fileSize = asset.size ?? 0;
      const mimeType = asset.mimeType ?? 'application/octet-stream';

      if (fileSize > 30 * 1024 * 1024) {
        alert('File size exceeds the 30MB limit.');
        return;
      }

      triggerMediumImpact();
      const msg = await sendMediaMessage({
        chatId,
        senderUid: currentUid,
        localUri,
        type: 'FILE',
        fileName,
        fileSize,
        mimeType,
        partnerMeta: {
          partnerUid,
          partnerName: username,
          partnerPhoto: photoURL,
          partnerOnline: isOnline,
        },
      });
      appendLocalMessage(msg);
    } catch (error) {
      console.error('Error picking document:', error);
      alert('Failed to send file.');
    }
  };

  const startRecording = async () => {
    setAttachmentModalVisible(false);
    try {
      const permissionResult = await requestRecordingPermissionsAsync();
      if (!permissionResult.granted) {
        alert('Permission to access microphone is required!');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setIsRecording(true);
      setRecordingDuration(0);
      triggerSelection();

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start audio recording.');
    }
  };

  const stopRecordingAndSend = async () => {
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    triggerSelection();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;

      let fileSize = 0;
      let fileName = `voice_${Date.now()}.m4a`;
      let mimeType = 'audio/x-m4a';

      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        fileSize = blob.size;
        mimeType = blob.type || 'audio/webm';
        
        let ext = 'webm';
        if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) {
          ext = 'm4a';
        } else if (mimeType.includes('ogg')) {
          ext = 'ogg';
        } else if (mimeType.includes('wav')) {
          ext = 'wav';
        }
        fileName = `voice_${Date.now()}.${ext}`;
      } else {
        const file = new File(uri);
        if (!file.exists) return;
        fileSize = file.size;
      }

      if (fileSize > 30 * 1024 * 1024) {
        alert('Recording size exceeds 30MB.');
        return;
      }

      const msg = await sendMediaMessage({
        chatId,
        senderUid: currentUid,
        localUri: uri,
        type: 'AUDIO',
        fileName,
        fileSize,
        mimeType,
        partnerMeta: {
          partnerUid,
          partnerName: username,
          partnerPhoto: photoURL,
          partnerOnline: isOnline,
        },
      });
      appendLocalMessage(msg);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to save voice recording.');
    }
  };

  const cancelRecording = async () => {
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    triggerSelection();
    try {
      await audioRecorder.stop();
    } catch {}
  };

  const handleMessageLongPress = useCallback((msg: StoredMessage) => {
    triggerHeavyImpact(); // Heavy pop for message options
    setSelectedMessage(msg);
    setOptionsModalVisible(true);
  }, []);

  const handleDeleteForMe = useCallback(() => {
    if (!selectedMessage) return;
    const msgId = selectedMessage.id;
    const msgType = selectedMessage.type;
    const localUri = selectedMessage.localUri;
    
    triggerSuccessNotification(); // Success vibration
    setOptionsModalVisible(false);
    setSelectedMessage(null);

    if (msgType === 'DELETED') {
      // Permanently remove already deleted message
      deleteMessageLocally(chatId, msgId);
      deleteLocalMessageState(msgId);
    } else {
      // 1. Mark as deleted locally in MMKV
      markMessageAsDeletedLocally(chatId, msgId);
      // 2. Mark as deleted in local state
      markLocalMessageAsDeletedState(msgId);
      // 3. Clean up local media files
      if (msgType !== 'TEXT') {
        deleteLocalMediaFile({ id: msgId, type: msgType, localUri } as any).catch(() => {});
      }
    }
  }, [selectedMessage, chatId, deleteLocalMessageState, markLocalMessageAsDeletedState]);

  const handleDeleteForEveryone = useCallback(async () => {
    if (!selectedMessage) return;
    const msgId = selectedMessage.id;
    triggerSuccessNotification(); // Success vibration
    setOptionsModalVisible(false);

    // Safety check: verify within window
    const isWithinWindow = Date.now() - getMessageTime(selectedMessage) < EDIT_DELETE_WINDOW_MS;
    if (!isWithinWindow || !selectedMessage.isMine) {
      // Fallback: just delete for me (by marking as deleted)
      markMessageAsDeletedLocally(chatId, msgId);
      markLocalMessageAsDeletedState(msgId);
      if (selectedMessage.type !== 'TEXT') {
        deleteLocalMediaFile(selectedMessage).catch(() => {});
      }
      setSelectedMessage(null);
      return;
    }

    const fileName = selectedMessage.fileName;
    const msgType = selectedMessage.type;
    const localUri = selectedMessage.localUri;
    setSelectedMessage(null);

    // 1. Mark as deleted locally in MMKV
    markMessageAsDeletedLocally(chatId, msgId);
    // 2. Mark as deleted in local state
    markLocalMessageAsDeletedState(msgId);
    // 3. Clean up local media files
    if (msgType !== 'TEXT') {
      deleteLocalMediaFile({ id: msgId, type: msgType, localUri } as any).catch(() => {});
    }
    // 4. Send delete signal to partner
    await sendDeleteSignal(chatId, msgId, partnerUid, fileName);
  }, [selectedMessage, chatId, partnerUid, markLocalMessageAsDeletedState]);

  const handleStartEdit = useCallback(() => {
    if (!selectedMessage) return;
    
    // Safety check: verify within window
    const isWithinWindow = Date.now() - getMessageTime(selectedMessage) < EDIT_DELETE_WINDOW_MS;
    if (!isWithinWindow || !selectedMessage.isMine) return;

    triggerSelection(); // Selection haptic
    setEditText(selectedMessage.content);
    setOptionsModalVisible(false);
    setEditModalVisible(true);
  }, [selectedMessage]);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedMessage) return;
    const msgId = selectedMessage.id;
    const newText = editText.trim();
    if (!newText) return;

    // Safety check: verify within window
    const isWithinWindow = Date.now() - getMessageTime(selectedMessage) < EDIT_DELETE_WINDOW_MS;
    if (!isWithinWindow || !selectedMessage.isMine) {
      setEditModalVisible(false);
      setSelectedMessage(null);
      setEditText('');
      return;
    }

    triggerSuccessNotification(); // Success vibration
    setEditModalVisible(false);
    setSelectedMessage(null);
    setEditText('');

    // 1. Edit locally in MMKV
    editMessageLocally(chatId, msgId, newText);
    // 2. Update local state
    editLocalMessageState(msgId, newText);
    // 3. Send edit signal to partner
    await sendEditSignal(chatId, msgId, newText, partnerUid);
  }, [selectedMessage, editText, chatId, partnerUid, editLocalMessageState]);

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
  useEffect(() => { markAsRead(); }, [chatId, markAsRead]);
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

    triggerMediumImpact(); // Slightly heavier kick feedback on message send
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
    return (
      <MessageBubble
        item={item}
        prevItem={prevItem}
        onLongPress={() => handleMessageLongPress(item)}
        setLightboxUri={setLightboxUri}
        setLightboxVisible={setLightboxVisible}
        setVideoPlayerUri={setVideoPlayerUri}
        setVideoModalVisible={setVideoModalVisible}
        payRequest={payRequest}
        declineRequest={declineRequest}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">{username}</Text>
            <Text
              style={[styles.headerStatus, isUserOnline(partnerLastSeen, partnerOnline) && styles.headerStatusOnline]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {presenceLabel}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.headerActions, isNarrowScreen && styles.headerActionsCompact]}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.7}
            onPress={() => initiateCall(partnerUid, username, partnerPhotoURL, 'voice')}
          >
            <MaterialIcons name="call" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.7}
            onPress={() => initiateCall(partnerUid, username, partnerPhotoURL, 'video')}
          >
            <MaterialIcons name="videocam" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <MaterialIcons name="info-outline" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages ─────────────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'android'}
        ListFooterComponent={<DateDivider label="TODAY" />}
        ListHeaderComponent={isOtherTyping ? <TypingIndicator /> : null}
        contentContainerStyle={[
          styles.messageList,
          { paddingVertical: 16 },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Input bar ────────────────────────────────── */}
      <View style={[styles.inputBar, isNarrowScreen && styles.inputBarCompact, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity style={[styles.inputIconBtn, isNarrowScreen && styles.inputIconBtnCompact]} activeOpacity={0.7} onPress={() => setAttachmentModalVisible(true)}>
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
            style={[styles.sendBtn, isNarrowScreen && styles.sendBtnCompact, inputText.trim().length > 0 && styles.sendBtnActive]}
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

      {/* ── Message Options Modal (Bottom Sheet style) ── */}
      <Modal
        visible={optionsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderLine} />
            <Text style={styles.modalTitle}>Message Options</Text>
            
            {selectedMessage && selectedMessage.isMine && selectedMessage.type === 'TEXT' && (Date.now() - getMessageTime(selectedMessage) < EDIT_DELETE_WINDOW_MS) && (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleStartEdit}
                activeOpacity={0.7}
              >
                <MaterialIcons name="edit" size={20} color={C.onSurface} />
                <Text style={styles.modalOptionText}>Edit Message</Text>
              </TouchableOpacity>
            )}

            {selectedMessage && selectedMessage.isMine && selectedMessage.type !== 'DELETED' && (Date.now() - getMessageTime(selectedMessage) < EDIT_DELETE_WINDOW_MS) && (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleDeleteForEveryone}
                activeOpacity={0.7}
              >
                <MaterialIcons name="delete-sweep" size={20} color={C.errorColor} />
                <Text style={[styles.modalOptionText, { color: C.errorColor }]}>
                  Delete for Everyone
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleDeleteForMe}
              activeOpacity={0.7}
            >
              <MaterialIcons name="delete" size={20} color={C.errorColor} />
              <Text style={[styles.modalOptionText, { color: C.errorColor }]}>
                {selectedMessage?.type === 'DELETED' ? 'Delete' : 'Delete for Me'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, styles.modalCancelOption]}
              onPress={() => setOptionsModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit Message Modal ── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditModalVisible(false);
          setSelectedMessage(null);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setEditModalVisible(false);
              setSelectedMessage(null);
            }}
          >
            <View 
              style={[styles.modalContent, styles.editModalContent]} 
              onStartShouldSetResponder={() => true}
              {...(Platform.OS === 'web' ? { onClick: (e: any) => e.stopPropagation() } : {})}
            >
              <Text style={styles.modalTitle}>Edit Message</Text>
              
              <View style={styles.editInputPill}>
                <TextInput
                  style={styles.editTextInput}
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  autoFocus
                  placeholder="Edit your message..."
                  placeholderTextColor="rgba(190,202,185,0.45)"
                />
              </View>

              <View style={styles.editActionsRow}>
                <TouchableOpacity
                  style={[styles.editBtn, styles.editCancelBtn]}
                  onPress={() => {
                    setEditModalVisible(false);
                    setSelectedMessage(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editBtn, styles.editSaveBtn, !editText.trim() && styles.editSaveBtnDisabled]}
                  onPress={handleSaveEdit}
                  disabled={!editText.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editSaveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Attachment Sheet Modal ── */}
      <Modal
        visible={attachmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachmentModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAttachmentModalVisible(false)}
        >
          <View style={[styles.attachmentModalContent, { paddingBottom: Math.max(insets.bottom + 20, 24) }]}>
            <View style={styles.attachmentModalHeader}>
              <Text style={styles.attachmentModalTitle}>Share Media</Text>
              <TouchableOpacity onPress={() => setAttachmentModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={C.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.attachmentOptionsGrid}>
              <TouchableOpacity style={styles.attachmentOptionBtn} onPress={handleTakeCamera} activeOpacity={0.75}>
                <View style={styles.attachmentOptionIconBg}>
                  <MaterialIcons name="photo-camera" size={26} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.attachmentOptionLabel} numberOfLines={1}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOptionBtn} onPress={handlePickMedia} activeOpacity={0.75}>
                <View style={styles.attachmentOptionIconBg}>
                  <MaterialIcons name="image" size={26} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.attachmentOptionLabel} numberOfLines={1}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOptionBtn} onPress={handlePickDocument} activeOpacity={0.75}>
                <View style={styles.attachmentOptionIconBg}>
                  <MaterialIcons name="insert-drive-file" size={26} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.attachmentOptionLabel} numberOfLines={1}>Document</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOptionBtn} onPress={startRecording} activeOpacity={0.75}>
                <View style={styles.attachmentOptionIconBg}>
                  <MaterialIcons name="mic" size={26} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.attachmentOptionLabel} numberOfLines={1}>Voice Note</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentOptionBtn}
                onPress={() => {
                  setAttachmentModalVisible(false);
                  setSendMoneyModalVisible(true);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.attachmentOptionIconBg}>
                  <MaterialIcons name="attach-money" size={26} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.attachmentOptionLabel} numberOfLines={1}>Send Money</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentOptionBtn}
                onPress={() => {
                  setAttachmentModalVisible(false);
                  setRequestMoneyModalVisible(true);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.attachmentOptionIconBg}>
                  <MaterialIcons name="payment" size={26} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.attachmentOptionLabel} numberOfLines={1}>Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Send Money Modal ── */}
      <Modal
        visible={sendMoneyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSendMoneyModalVisible(false);
          setWalletAmount('');
          setWalletNote('');
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setSendMoneyModalVisible(false);
              setWalletAmount('');
              setWalletNote('');
            }}
          >
            <View 
              style={[styles.modalContent, styles.editModalContent]} 
              onStartShouldSetResponder={() => true}
              {...(Platform.OS === 'web' ? { onClick: (e: any) => e.stopPropagation() } : {})}
            >
              <Text style={styles.modalTitle}>Send Money to {username}</Text>
              
              <View style={[styles.editInputPill, { minHeight: 48, marginBottom: 12 }]}>
                <TextInput
                  style={styles.editTextInput}
                  value={walletAmount}
                  onChangeText={setWalletAmount}
                  keyboardType="numeric"
                  autoFocus
                  placeholder="Amount in ₹ (e.g. 50)"
                  placeholderTextColor="rgba(190,202,185,0.45)"
                />
              </View>

              <View style={[styles.editInputPill, { minHeight: 48, marginBottom: 16 }]}>
                <TextInput
                  style={styles.editTextInput}
                  value={walletNote}
                  onChangeText={setWalletNote}
                  placeholder="Note (optional)"
                  placeholderTextColor="rgba(190,202,185,0.45)"
                />
              </View>

              <View style={styles.editActionsRow}>
                <TouchableOpacity
                  style={[styles.editBtn, styles.editCancelBtn]}
                  onPress={() => {
                    setSendMoneyModalVisible(false);
                    setWalletAmount('');
                    setWalletNote('');
                  }}
                  activeOpacity={0.7}
                  disabled={isSubmittingWallet}
                >
                  <Text style={styles.editCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editBtn, styles.editSaveBtn, (!walletAmount.trim() || isSubmittingWallet) && styles.editSaveBtnDisabled]}
                  onPress={handleSendMoneySubmit}
                  disabled={!walletAmount.trim() || isSubmittingWallet}
                  activeOpacity={0.7}
                >
                  {isSubmittingWallet ? (
                    <ActivityIndicator size="small" color={isDark ? C.primary : C.white} />
                  ) : (
                    <Text style={styles.editSaveBtnText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Request Money Modal ── */}
      <Modal
        visible={requestMoneyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRequestMoneyModalVisible(false);
          setWalletAmount('');
          setWalletNote('');
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setRequestMoneyModalVisible(false);
              setWalletAmount('');
              setWalletNote('');
            }}
          >
            <View 
              style={[styles.modalContent, styles.editModalContent]} 
              onStartShouldSetResponder={() => true}
              {...(Platform.OS === 'web' ? { onClick: (e: any) => e.stopPropagation() } : {})}
            >
              <Text style={styles.modalTitle}>Request Money from {username}</Text>
              
              <View style={[styles.editInputPill, { minHeight: 48, marginBottom: 12 }]}>
                <TextInput
                  style={styles.editTextInput}
                  value={walletAmount}
                  onChangeText={setWalletAmount}
                  keyboardType="numeric"
                  autoFocus
                  placeholder="Amount in ₹ (e.g. 50)"
                  placeholderTextColor="rgba(190,202,185,0.45)"
                />
              </View>

              <View style={[styles.editInputPill, { minHeight: 48, marginBottom: 16 }]}>
                <TextInput
                  style={styles.editTextInput}
                  value={walletNote}
                  onChangeText={setWalletNote}
                  placeholder="Description note (required)"
                  placeholderTextColor="rgba(190,202,185,0.45)"
                />
              </View>

              <View style={styles.editActionsRow}>
                <TouchableOpacity
                  style={[styles.editBtn, styles.editCancelBtn]}
                  onPress={() => {
                    setRequestMoneyModalVisible(false);
                    setWalletAmount('');
                    setWalletNote('');
                  }}
                  activeOpacity={0.7}
                  disabled={isSubmittingWallet}
                >
                  <Text style={styles.editCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editBtn, styles.editSaveBtn, (!walletAmount.trim() || !walletNote.trim() || isSubmittingWallet) && styles.editSaveBtnDisabled]}
                  onPress={handleRequestMoneySubmit}
                  disabled={!walletAmount.trim() || !walletNote.trim() || isSubmittingWallet}
                  activeOpacity={0.7}
                >
                  {isSubmittingWallet ? (
                    <ActivityIndicator size="small" color={isDark ? C.primary : C.white} />
                  ) : (
                    <Text style={styles.editSaveBtnText}>Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Image Lightbox Modal ── */}
      <Modal
        visible={lightboxVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          {lightboxUri && (
            <ExpoImage
              source={{ uri: lightboxUri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          )}
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setLightboxVisible(false)}
          >
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Video Player Modal ── */}
      <VideoPlayerModal
        uri={videoPlayerUri}
        visible={videoModalVisible}
        onClose={() => {
          setVideoModalVisible(false);
          setVideoPlayerUri(null);
        }}
      />

      {/* ── Voice Recording Floating Bar ── */}
      {isRecording && (
        <View style={[styles.recordingBar, { height: 74 + insets.bottom, paddingBottom: insets.bottom + 6 }]}>
          <View style={styles.recordingTimerWrap}>
            <View style={styles.recordingIndicatorDot} />
            <Text style={styles.recordingTimerText}>Recording... {formatRecordingTime(recordingDuration)}</Text>
          </View>
          <View style={styles.recordingActions}>
            <TouchableOpacity onPress={cancelRecording} style={styles.recordingCancelBtn} activeOpacity={0.7}>
              <Text style={styles.recordingCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={stopRecordingAndSend} style={styles.recordingSendBtn} activeOpacity={0.8}>
              <MaterialIcons name="mic-off" size={20} color={C.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

/* ── StyleSheet ──────────────────────────────────────── */
function getStyles(C: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
  container:               { flex: 1, backgroundColor: C.background },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: isDark ? 'rgba(255,107,107,0.12)' : 'rgba(211,47,47,0.12)',
    paddingHorizontal: 16, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,107,107,0.2)' : 'rgba(211,47,47,0.2)',
  },
  offlineBannerText:       { fontSize: 12, color: C.onSurfaceVariant, flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: isDark ? 'rgba(15,21,14,0.92)' : 'rgba(244,250,243,0.92)',
    borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 6, zIndex: 10,
  },
  headerIconBtn:           { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerProfile:           { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  headerAvatarWrap:        { position: 'relative', width: 40, height: 40 },
  headerAvatar:            { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.outlineVariant },
  headerAvatarFallback:    { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surfaceContainer, borderWidth: 2, borderColor: C.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  headerAvatarInitial:     { fontSize: 18, fontWeight: '800', color: C.primary },
  headerOnlineDot:         { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: C.primary, borderWidth: 2, borderColor: C.background },
  headerTextBlock:         { flex: 1, minWidth: 0 },
  headerName:              { fontSize: 17, fontWeight: '700', color: C.onSurface, letterSpacing: -0.3 },
  headerStatus:            { fontSize: 12, fontWeight: '500', color: C.onSurfaceVariant, marginTop: 1 },
  headerStatusOnline:      { color: C.primary },
  headerActions:           { flexDirection: 'row', gap: 2, flexShrink: 0 },
  headerActionsCompact:    { gap: 0 },

  messageList:             { paddingHorizontal: 16, paddingTop: 8 },

  dateDividerRow:          { alignItems: 'center', marginVertical: 16 },
  dateDividerText:         { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 1.5, backgroundColor: C.surfaceContainer, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 9999, overflow: 'hidden' },

  bubbleRow:               { maxWidth: '82%', marginBottom: 2 },
  bubbleRowIn:             { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubbleRowOut:            { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleFirst:             { marginTop: 6 },
  bubbleGrouped:           { marginTop: 2 },

  bubble:                  { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 20 },
  bubbleIn:                { backgroundColor: C.surfaceContainerHigh, borderWidth: 1, borderColor: C.cardBorder },
  bubbleOut:               { backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 6 },
  bubbleInCorner:          { borderBottomLeftRadius: 4 },
  bubbleOutCorner:         { borderBottomRightRadius: 4 },
  bubbleText:              { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  bubbleTextIn:            { color: C.onSurface },
  bubbleTextOut:           { color: isDark ? '#002105' : '#ffffff' },

  deletedBubble:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2 },
  deletedText:             { fontSize: 15, fontStyle: 'italic', color: C.onSurfaceVariant, fontWeight: '400' },

  metaRow:                 { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginRight: 4 },
  metaTime:                { fontSize: 10, fontWeight: '600', color: C.onSurfaceVariant, letterSpacing: 0.3 },
  metaTimeIn:              { fontSize: 10, fontWeight: '600', color: C.onSurfaceVariant, letterSpacing: 0.3, marginTop: 4, marginLeft: 4, marginBottom: 4 },

  typingBubble:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surfaceContainerHigh, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 20, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 14, alignSelf: 'flex-start', marginTop: 6, marginLeft: 16, marginBottom: 8, width: 68 },
  typingDot:               { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },

  inputBar:                { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 12, backgroundColor: isDark ? 'rgba(15,21,14,0.95)' : 'rgba(244,250,243,0.95)', borderTopWidth: 1, borderTopColor: C.outlineVariant, gap: 6 },
  inputBarCompact:         { paddingHorizontal: 6, gap: 4 },
  inputIconBtn:            { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  inputIconBtnCompact:     { width: 38 },
  inputPill:               { flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.surfaceContainerHighest, borderRadius: 24, borderWidth: 1.5, borderColor: C.outlineVariant, paddingHorizontal: 14, paddingVertical: 4, minHeight: 50 },
  textInput:               { flex: 1, fontSize: 16, fontWeight: '400', color: C.onSurface, paddingTop: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 10 : 8, maxHeight: 110 },
  emojiBtn:                { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  sendBtn:                 { width: 46, height: 46, borderRadius: 23, backgroundColor: C.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  sendBtnCompact:          { width: 42, height: 42, borderRadius: 21 },
  sendBtnActive:           { backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },

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
    borderColor: C.cardBorder,
  },
  skeletonBubbleOut: {
    backgroundColor: isDark ? 'rgba(150, 249, 150, 0.15)' : 'rgba(46, 168, 71, 0.15)',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(150, 249, 150, 0.25)' : 'rgba(46, 168, 71, 0.25)',
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(15,21,14,0.75)' : 'rgba(244,250,243,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.surfaceContainerHigh,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  modalHeaderLine: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.outlineVariant,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.onSurface,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.outlineVariant,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.onSurface,
  },
  modalCancelOption: {
    borderBottomWidth: 0,
    justifyContent: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onSurfaceVariant,
  },
  editModalContent: {
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 'auto',
    marginTop: 'auto',
    justifyContent: 'center',
  },
  editInputPill: {
    backgroundColor: C.surfaceContainerHighest,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 60,
    maxHeight: 120,
    marginBottom: 16,
  },
  editTextInput: {
    fontSize: 16,
    fontWeight: '400',
    color: C.onSurface,
    textAlignVertical: 'top',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  editBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelBtn: {
    backgroundColor: 'transparent',
  },
  editCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.onSurfaceVariant,
  },
  editSaveBtn: {
    backgroundColor: C.primary,
  },
  editSaveBtnDisabled: {
    opacity: 0.5,
  },
  editSaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: isDark ? '#002105' : '#ffffff',
  },
  
  /* ── Media bubbles ──────────────────────────────────── */
  imageBubbleWrap: {
    width: 220,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: C.surfaceContainerHigh,
  },
  imageBubble: {
    width: '100%',
    height: '100%',
  },
  videoBubbleWrap: {
    width: 220,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: C.surfaceContainerHigh,
  },
  videoThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mediaPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 20,
  },
  mediaPlaceholderText: {
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  uploadProgressOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: isDark ? 'rgba(150,249,150,0.08)' : 'rgba(46,168,71,0.08)',
    borderRadius: 12,
    maxWidth: 220,
  },
  fileIconBg: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
    minWidth: 0,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.onSurface,
  },
  fileSizeText: {
    fontSize: 11,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
    width: 200,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTrackWrap: {
    flex: 1,
    gap: 6,
  },
  audioProgressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: isDark ? 'rgba(150,249,150,0.15)' : 'rgba(46,168,71,0.15)',
    width: '100%',
    overflow: 'hidden',
  },
  audioProgressBar: {
    height: '100%',
    backgroundColor: C.primary,
  },
  audioTimeText: {
    fontSize: 10,
    color: C.onSurfaceVariant,
  },
  
  /* ── Attachment Sheet styles ────────────────────────── */
  attachmentModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)',
  },
  attachmentModalContent: {
    backgroundColor: C.surfaceContainer,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 20,
    borderTopWidth: 1,
    borderColor: C.cardBorder,
  },
  attachmentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attachmentModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.onSurface,
  },
  attachmentOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 18,
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  attachmentOptionBtn: {
    width: '29%',
    alignItems: 'center',
    gap: 8,
  },
  attachmentOptionIconBg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  attachmentOptionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.onSurface,
    textAlign: 'center',
    maxWidth: '100%',
  },
  
  /* ── Voice Recording overlay ────────────────────────── */
  recordingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: C.cardBorder,
  },
  recordingTimerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.errorColor,
  },
  recordingTimerText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.onSurface,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  recordingCancelText: {
    color: C.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '600',
  },
  recordingSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.errorColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  /* ── Transaction and Request Cards ─────────────────── */
  transactionCard: {
    padding: 12,
    borderRadius: 16,
    width: 220,
    gap: 6,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  transactionNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    opacity: 0.8,
  },
  transactionRef: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 2,
  },
  
  // Payment Request Specific Styles
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  requestButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButton: {
    backgroundColor: C.primary,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDark ? '#002105' : '#ffffff',
  },
  declineButton: {
    backgroundColor: C.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  declineButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
  },
  requestBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: C.surfaceContainerHighest,
  },
  requestBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
}
