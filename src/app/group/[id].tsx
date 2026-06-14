import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { auth, db } from '@/config/firebase';
import { useGroupChat } from '@/hooks/useGroupChat';
import { clearUnread, type StoredMessage } from '@/services/chatStorage';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

const { width } = Dimensions.get('window');

/* ── Date Divider ──────────────────────────────────── */
function DateDivider({ label }: { label: string }) {
  const styles = useStyles(getStyles);
  return (
    <View style={styles.dateDividerRow}>
      <Text style={styles.dateDividerText}>{label}</Text>
    </View>
  );
}

/* ── Group Message Bubble ───────────────────────────── */
function GroupMessageBubble({
  item,
  prevItem,
}: {
  item: StoredMessage;
  prevItem?: StoredMessage;
}) {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  const isGrouped =
    prevItem &&
    prevItem.senderUid === item.senderUid &&
    item.createdAt - prevItem.createdAt < 60_000; // within 1 minute

  const timeLabel = new Date(item.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (item.isMine) {
    return (
      <View style={[styles.bubbleRow, styles.bubbleRowOut, isGrouped ? styles.bubbleGrouped : styles.bubbleFirst]}>
        <View style={[styles.bubble, styles.bubbleOut, styles.bubbleOutCorner]}>
          <Text style={styles.bubbleTextOut}>{item.content}</Text>
        </View>
        {!isGrouped && (
          <View style={styles.metaRow}>
            <Text style={styles.metaTime}>{timeLabel}</Text>
            {item.status === 'SENDING' ? (
              <ActivityIndicator size={10} color={C.onSurfaceVariant} style={{ marginLeft: 4 }} />
            ) : item.status === 'FAILED' ? (
              <MaterialIcons name="error-outline" size={12} color={C.errorColor} style={{ marginLeft: 4 }} />
            ) : (
              <MaterialIcons name="done" size={12} color={C.primaryFixedDim} style={{ marginLeft: 4 }} />
            )}
          </View>
        )}
      </View>
    );
  }

  // Incoming message: Render sender avatar and display name
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowIn, isGrouped ? styles.bubbleGrouped : styles.bubbleFirst]}>
      {/* Sender Avatar (Only on first message in group) */}
      {!isGrouped ? (
        <View style={styles.bubbleAvatar}>
          {item.senderPhoto ? (
            <Image source={{ uri: item.senderPhoto }} style={styles.bubbleAvatarImg} />
          ) : (
            <Text style={styles.bubbleAvatarText}>
              {item.senderName?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.avatarSpacer} />
      )}

      <View style={{ flexShrink: 1 }}>
        {/* Sender Name */}
        {!isGrouped && (
          <Text style={styles.senderNameLabel}>{item.senderName ?? 'Tea Friend'}</Text>
        )}
        <View style={[styles.bubble, styles.bubbleIn, styles.bubbleInCorner]}>
          <Text style={styles.bubbleTextIn}>{item.content}</Text>
        </View>
        {!isGrouped && <Text style={styles.metaTimeIn}>{timeLabel}</Text>}
      </View>
    </View>
  );
}

export default function GroupChatRoomScreen() {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();

  const currentUid = auth.currentUser?.uid ?? '';
  const { messages, sendGroupMessage, isOnline } = useGroupChat(groupId);

  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);

  const flatListRef = useRef<FlatList>(null);

  // Listen to Group Metadata and Roster in real-time
  useEffect(() => {
    if (!groupId) return;

    // Clear unread badge locally for this group chat
    clearUnread(groupId);

    const groupRef = doc(db, 'chats', groupId);
    const unsub = onSnapshot(groupRef, (snap) => {
      if (snap.exists()) {
        setGroupDetails(snap.data());
      }
      setIsDetailsLoading(false);
    }, (err) => {
      console.error('[GroupChatRoom] Error listening to details:', err);
      setIsDetailsLoading(false);
    });

    return () => unsub();
  }, [groupId]);

  // Check current participant's status using members map
  const activeParticipants = React.useMemo(() => {
    if (!groupDetails?.members) return [];
    return Object.keys(groupDetails.members).map((uid) => ({
      user: {
        id: uid,
        username: groupDetails.members[uid].displayName ?? 'Unknown',
        name: groupDetails.members[uid].name ?? 'Unknown',
        profilePictureUrl: groupDetails.members[uid].photoURL ?? null,
      },
      isAdmin: !!groupDetails.members[uid].isAdmin,
      status: groupDetails.members[uid].status ?? 'ACTIVE',
    }));
  }, [groupDetails]);

  const currentParticipant = activeParticipants.find(
    (p: any) => p.user.id === currentUid
  );
  const isRemoved = currentParticipant?.status === 'REMOVED';
  const isAdmin = !!currentParticipant?.isAdmin;
  const memberCount = activeParticipants.filter((p: any) => p.status === 'ACTIVE').length;

  // Send action
  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    setIsSending(true);
    const success = await sendGroupMessage(inputText.trim());
    if (success) {
      setInputText('');
    }
    setIsSending(false);
  };

  // Delete chat history for removed users
  const handleDeleteChat = async () => {
    const performDelete = async () => {
      try {
        // Delete their inbox document in Firestore
        const inboxRef = doc(db, 'users', currentUid, 'inbox', groupId);
        await deleteDoc(inboxRef);
        // Go back to community
        router.replace('/(tabs)/community');
      } catch (err) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to delete chat. Please try again.');
        } else {
          Alert.alert('Error', 'Failed to delete chat. Please try again.');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm(
        'Delete Chat? 🫖\nAre you sure you want to delete this group from your inbox? Your chat history will be cleared.'
      );
      if (confirmDelete) {
        await performDelete();
      }
    } else {
      Alert.alert(
        'Delete Chat? 🫖',
        'Are you sure you want to delete this group from your inbox? Your chat history will be cleared.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const handleHeaderPress = () => {
    router.push(`/group/settings/${groupId}`);
  };

  // Date categorization helper
  const renderItem = ({ item, index }: { item: StoredMessage; index: number }) => {
    const prevItem = index > 0 ? messages[index - 1] : undefined;
    const showDivider =
      !prevItem ||
      new Date(item.createdAt).toDateString() !== new Date(prevItem.createdAt).toDateString();

    const dateLabel = new Date(item.createdAt).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    return (
      <View>
        {showDivider && <DateDivider label={dateLabel} />}
        <GroupMessageBubble item={item} prevItem={prevItem} />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/community');
            }
          }}
        >
          <MaterialIcons name="arrow-back-ios" size={20} color={C.onSurface} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerTitleContainer} onPress={handleHeaderPress} activeOpacity={0.8}>
          <View style={styles.avatar}>
            {groupDetails?.groupImageUrl ? (
              <Image source={{ uri: groupDetails.groupImageUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {groupDetails?.groupName?.charAt(0)?.toUpperCase() ?? 'G'}
                </Text>
              </View>
            )}
          </View>
          <View>
            <Text style={styles.groupName} numberOfLines={1}>
              {groupDetails?.groupName ?? 'Loading...'}
            </Text>
            <Text style={styles.memberCount}>
              {isDetailsLoading ? '...' : `${memberCount} member${memberCount === 1 ? '' : 's'}`}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsBtn} onPress={handleHeaderPress}>
          <MaterialIcons name="info-outline" size={24} color={C.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Network offline warning banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="cloud-off" size={14} color={C.background} />
          <Text style={styles.offlineText}>No internet connection. Messages will queue.</Text>
        </View>
      )}

      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Input / Removed Banner Area */}
      {isRemoved ? (
        <View style={[styles.removedBanner, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <MaterialIcons name="warning" size={20} color={C.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.removedTitle}>You're no longer in this group</Text>
            <Text style={styles.removedSubtitle}>
              You can read previous messages, or delete the group chat history.
            </Text>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteChat}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            placeholder="Spill the tea..."
            placeholderTextColor="rgba(190,202,185,0.4)"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={C.background} />
            ) : (
              <MaterialIcons name="send" size={18} color={C.background} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function getStyles(C: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: C.outlineVariant,
    backgroundColor: C.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 10,
    paddingRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: C.surfaceContainerHigh,
  },
  avatarImg: {
    width: 40,
    height: 40,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.secondary,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onSurface,
  },
  memberCount: {
    fontSize: 11,
    color: C.onSurfaceVariant,
    fontWeight: '600',
    marginTop: 1,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBanner: {
    flexDirection: 'row',
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDark ? '#002105' : '#ffffff',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },

  /* ── Message Bubble Styles ───────────────────────────────── */
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 4,
    position: 'relative',
    maxWidth: '85%',
  },
  bubbleRowOut: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  bubbleRowIn: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    gap: 10,
  },
  bubbleFirst: {
    marginTop: 12,
  },
  bubbleGrouped: {
    marginTop: 2,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOut: {
    backgroundColor: C.primary,
  },
  bubbleIn: {
    backgroundColor: C.surfaceContainerHigh,
  },
  bubbleOutCorner: {
    borderTopRightRadius: 4,
  },
  bubbleInCorner: {
    borderTopLeftRadius: 4,
  },
  bubbleTextOut: {
    fontSize: 15,
    fontWeight: '500',
    color: isDark ? '#002105' : '#ffffff',
    lineHeight: 20,
  },
  bubbleTextIn: {
    fontSize: 15,
    fontWeight: '500',
    color: C.onSurface,
    lineHeight: 20,
  },
  bubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bubbleAvatarImg: {
    width: 32,
    height: 32,
  },
  bubbleAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: C.secondary,
  },
  avatarSpacer: {
    width: 32,
  },
  senderNameLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.secondary,
    marginBottom: 4,
    marginLeft: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginRight: 6,
    marginTop: 2,
  },
  metaTime: {
    fontSize: 10,
    color: C.onSurfaceVariant,
    fontWeight: '600',
  },
  metaTimeIn: {
    fontSize: 10,
    color: C.onSurfaceVariant,
    fontWeight: '600',
    marginLeft: 6,
    marginTop: 2,
  },
  dateDividerRow: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    backgroundColor: C.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    letterSpacing: 0.5,
  },

  /* ── Input & Banner Styles ───────────────────────────────── */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: C.background,
    borderTopWidth: 1,
    borderColor: C.outlineVariant,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: C.surfaceContainer,
    borderRadius: 22,
    color: C.onSurface,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontWeight: '500',
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: C.surfaceContainerHigh,
    opacity: 0.5,
  },
  removedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainer,
    borderTopWidth: 1,
    borderColor: C.outlineVariant,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  removedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.secondary,
  },
  removedSubtitle: {
    fontSize: 11,
    color: C.onSurfaceVariant,
    lineHeight: 15,
    marginTop: 2,
  },
  deleteBtn: {
    backgroundColor: isDark ? 'rgba(255,107,107,0.15)' : 'rgba(211,47,47,0.15)',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,107,107,0.3)' : 'rgba(211,47,47,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: C.errorColor,
  },
});
}
