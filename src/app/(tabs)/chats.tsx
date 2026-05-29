/**
 * (tabs)/chats.tsx
 * -----------------
 * Chat dashboard — "What's Brewin'" screen.
 * Pixel-perfect implementation of the Stitch dashboard design.
 *
 * Structure:
 *   - Fixed top bar: hamburger | "Tea" italic logo (matcha glow) | notifications bell
 *   - 3 animated orbital background orbs (matcha + peach)
 *   - "What's Brewin'" display headline
 *   - Stories/Status horizontal scroll: "My Tea" (user avatar + add) only — no contacts yet
 *   - Chat list: fetched from DB — empty state if no chats
 *   - Floating Action Button (compose, matcha green)
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';

const { width } = Dimensions.get('window');

/* ── Design tokens ─────────────────────────────────────────── */
const C = {
  background:         '#0f150e',
  surfaceContainer:   '#1b211a',
  surfaceContainerHigh: '#262b24',
  primaryContainer:   '#96f996',
  onPrimaryContainer: '#037524',
  primaryFixedDim:    '#7adc7d',
  secondary:          '#ffb59c',
  secondaryContainer: '#8e2c01',
  onSurface:          '#dfe4d9',
  onSurfaceVariant:   '#becab9',
  outlineVariant:     '#3f4a3d',
  white:              '#ffffff',
};

/* ── Orbital background orb ────────────────────────────────── */
function OrbBackground() {
  const orb1x = useRef(new Animated.Value(0)).current;
  const orb1y = useRef(new Animated.Value(0)).current;
  const orb2x = useRef(new Animated.Value(0)).current;
  const orb2y = useRef(new Animated.Value(0)).current;
  const orb3x = useRef(new Animated.Value(0)).current;
  const orb3y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeOrbit = (
      ax: Animated.Value, ay: Animated.Value,
      dx: number, dy: number, dur: number
    ) => Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ax, { toValue: dx, duration: dur / 3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ay, { toValue: dy, duration: dur / 3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ax, { toValue: -dx * 0.5, duration: dur / 3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ay, { toValue: dy * 1.5, duration: dur / 3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ax, { toValue: 0, duration: dur / 3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ay, { toValue: 0, duration: dur / 3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );

    makeOrbit(orb1x, orb1y, 30, 50, 25000).start();
    makeOrbit(orb2x, orb2y, -40, -30, 30000).start();
    makeOrbit(orb3x, orb3y, 25, -40, 28000).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Orb 1 — matcha, top-left */}
      <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateX: orb1x }, { translateY: orb1y }] }]} />
      {/* Orb 2 — peach/secondary, bottom-right */}
      <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateX: orb2x }, { translateY: orb2y }] }]} />
      {/* Orb 3 — matcha dim, center-right */}
      <Animated.View style={[styles.orb, styles.orb3, { transform: [{ translateX: orb3x }, { translateY: orb3y }] }]} />
    </View>
  );
}

/* ── Pulsing notification dot ──────────────────────────────── */
function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.notifDot, { transform: [{ scale }] }]} />
  );
}

/* ── "My Tea" story bubble ─────────────────────────────────── */
function MyTeaBubble({ displayName }: { displayName: string }) {
  return (
    <View style={styles.storyItem}>
      <View style={styles.myTeaRing}>
        {/* Avatar initials */}
        <View style={styles.myTeaAvatar}>
          <Text style={styles.myTeaInitial}>
            {displayName?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        {/* Add button */}
        <View style={styles.myTeaAddBtn}>
          <MaterialIcons name="add" size={10} color={C.onPrimaryContainer} />
        </View>
      </View>
      <Text style={styles.storyLabel}>My Tea</Text>
    </View>
  );
}

/* ── Chat card ─────────────────────────────────────────────── */
function ChatCard({ item, onPress, index }: { item: any; onPress: () => void; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const hasUnread = item.unreadCount > 0;
  const lastMsg = item.chat.lastMessageText;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.chatCard, hasUnread && styles.chatCardActive]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {/* Subtle glow overlay for active cards */}
        {hasUnread && <View style={styles.chatCardGlow} />}

        {/* Avatar circle */}
        <View style={[styles.chatAvatar, hasUnread && styles.chatAvatarActive]}>
          <Text style={styles.chatAvatarText}>
            {(item.chat.isGroup ? 'G' : '?')}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.chatInfo}>
          <View style={styles.chatRow}>
            <Text style={[styles.chatName, hasUnread && styles.chatNameActive]} numberOfLines={1}>
              {item.chat.isGroup ? 'Group Chat' : 'Direct Message'}
            </Text>
            <Text style={[styles.chatTime, hasUnread && styles.chatTimeActive]}>
              {item.chat.lastMessageAt ? 'Just now' : ''}
            </Text>
          </View>
          <Text style={styles.chatPreview} numberOfLines={1}>
            {lastMsg ?? 'No messages yet'}
          </Text>
        </View>

        {/* Unread indicator dot */}
        {hasUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ── Empty state ───────────────────────────────────────────── */
function EmptyState() {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={[styles.emptyIconWrapper, { transform: [{ translateY: floatAnim }] }]}>
        <View style={styles.emptyIconBg}>
          <Text style={styles.emptyIconText}>☕</Text>
        </View>
      </Animated.View>
      <Text style={styles.emptyTitle}>No chats yet</Text>
      <Text style={styles.emptySubtitle}>Start spilling! Hit the compose button{'\n'}to begin a conversation.</Text>
    </View>
  );
}

/* ── Main Screen ───────────────────────────────────────────── */
export default function ChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chats, fetchMyChats, isLoading } = useChat();
  const { user } = useAuth();

  useEffect(() => {
    fetchMyChats();
  }, [fetchMyChats]);

  const handleNewChat = useCallback(() => {
    router.push('/search');
  }, [router]);

  return (
    <View style={styles.container}>

      {/* ── Orbital background ──────────────────────────────── */}
      <OrbBackground />

      <SafeAreaView style={styles.safeArea}>

        {/* ── Top app bar ───────────────────────────────── */}
        <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.appBarBtn} activeOpacity={0.7}>
            <MaterialIcons name="menu" size={24} color={C.onSurfaceVariant} />
          </TouchableOpacity>

          <Text style={styles.appBarLogo}>Tea</Text>

          <TouchableOpacity style={styles.appBarBtn} activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={24} color={C.onSurfaceVariant} />
            <PulseDot />
          </TouchableOpacity>
        </View>

        {/* ── Scrollable content ──────────────────────────── */}
        <FlatList
          data={chats ?? []}
          keyExtractor={(item) => item.chat.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={() => (
            <>
              {/* Page title */}
              <View style={styles.titleSection}>
                <Text style={styles.pageTitle}>What's Brewin'</Text>
              </View>

              {/* Stories row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesRow}
                style={styles.storiesScroll}
              >
                <MyTeaBubble displayName={user?.name ?? user?.displayName ?? 'Me'} />
                {/* Future: contacts with statuses will be rendered here */}
              </ScrollView>

              {/* Section gap */}
              <View style={{ height: 12 }} />
            </>
          )}
          renderItem={({ item, index }) => (
            <ChatCard
              item={item}
              index={index}
              onPress={() =>
                router.push({ pathname: '/chat/[id]', params: { id: item.chat.id } })
              }
            />
          )}
          ListEmptyComponent={() =>
            !isLoading ? <EmptyState /> : null
          }
          ListFooterComponent={() =>
            isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={C.primaryContainer} />
              </View>
            ) : null
          }
        />

        {/* ── Floating Action Button ───────────────────────── */}
        <TouchableOpacity
          style={styles.fab}
          onPress={handleNewChat}
          activeOpacity={0.85}
        >
          <MaterialIcons name="edit-note" size={28} color={C.onPrimaryContainer} />
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
}

/* ── StyleSheet ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  safeArea: {
    flex: 1,
  },

  /* ── Orbital orbs ────────────────────────────────────────── */
  orb: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.13,
  },
  orb1: {
    width: 280,
    height: 280,
    backgroundColor: C.primaryContainer,
    top: -80,
    left: -80,
  },
  orb2: {
    width: 360,
    height: 360,
    backgroundColor: C.secondaryContainer,
    bottom: -120,
    right: -120,
  },
  orb3: {
    width: 220,
    height: 220,
    backgroundColor: C.primaryFixedDim,
    top: '40%',
    left: '55%',
    opacity: 0.09,
  },

  /* ── Top app bar ─────────────────────────────────────────── */
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(15,21,14,0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(63,74,61,0.3)',
  },
  appBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  appBarLogo: {
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    color: C.primaryFixedDim,
    letterSpacing: -1,
    // Glow via shadow
    textShadowColor: 'rgba(122,220,125,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primaryContainer,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },

  /* ── Scroll content ──────────────────────────────────────── */
  scrollContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },

  /* ── Page title ──────────────────────────────────────────── */
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -1,
    lineHeight: 40,
  },

  /* ── Stories row ─────────────────────────────────────────── */
  storiesScroll: {
    flexGrow: 0,
  },
  storiesRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 16,
    flexDirection: 'row',
  },
  storyItem: {
    alignItems: 'center',
    gap: 6,
  },
  storyLabel: {
    color: C.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  myTeaRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 2,
    borderColor: C.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  myTeaAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(122,220,125,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myTeaInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: C.primaryFixedDim,
  },
  myTeaAddBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.background,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },

  /* ── Chat cards ──────────────────────────────────────────── */
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    backgroundColor: 'rgba(27,33,26,0.65)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  chatCardActive: {
    backgroundColor: 'rgba(38,43,36,0.85)',
    borderColor: 'rgba(122,220,125,0.15)',
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  chatCardGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(150,249,150,0.04)',
    borderRadius: 20,
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chatAvatarActive: {
    borderWidth: 2,
    borderColor: 'rgba(122,220,125,0.4)',
  },
  chatAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: C.primaryFixedDim,
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
  },
  chatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600',
    color: C.onSurface,
    flex: 1,
  },
  chatNameActive: {
    color: C.white,
    fontWeight: '700',
  },
  chatTime: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 0.3,
    marginLeft: 8,
    flexShrink: 0,
  },
  chatTimeActive: {
    color: C.primaryContainer,
  },
  chatPreview: {
    fontSize: 14,
    fontWeight: '400',
    color: C.onSurfaceVariant,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primaryContainer,
    flexShrink: 0,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },

  /* ── Loading row ─────────────────────────────────────────── */
  loadingRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  /* ── Empty state ─────────────────────────────────────────── */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIconWrapper: {
    marginBottom: 8,
  },
  emptyIconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(122,220,125,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122,220,125,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: C.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },

  /* ── FAB ─────────────────────────────────────────────────── */
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
    zIndex: 40,
  },
});
