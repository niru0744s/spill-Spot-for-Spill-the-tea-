/**
 * app/search.tsx
 * ---------------
 * Search screen — "Find your tea vibe."
 * Presented as a modal from the dashboard FAB.
 *
 * Layout (pixel-perfect from Stitch design):
 *   - "Tea" top bar with back arrow (modal dismiss)
 *   - 3 animated ambient orbs (matcha + peach)
 *   - "Find your ☕ tea vibe." large hero headline
 *   - Pill search bar: search icon | input | matcha arrow-forward button
 *     - Focus scale-up + green glow animation
 *   - Empty state (no query): nothing below the search bar
 *   - Results: "People" section header + animated user cards
 *     - Avatar circle with online indicator
 *     - Display name (bold, white) + @username (muted)
 *     - ONLINE / LAST SEEN badge (top-right)
 *     - Bio (italic, muted, 2 lines max)
 *     - "Start Chat" CTA button
 *       - Online user: matcha green filled pill
 *       - Offline user: surface-variant ghost pill
 *     - Staggered slide-up entrance animations
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSearch } from '@/hooks/useSearch';
import type { SearchUser } from '@/hooks/useSearch';
import { isUserOnline, getMillis } from '@/services/presenceService';
import { triggerSelection } from '@/services/hapticService';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

const { width, height } = Dimensions.get('window');

/* ── Ambient orb background ────────────────────────────────── */
function AmbientOrbs() {
  const styles = useStyles(getStyles);
  const orb1 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb2 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb3 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    const loop = (anim: Animated.ValueXY, dx: number, dy: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: { x: dx, y: dy }, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(anim, { toValue: { x: -dx * 0.5, y: dy * 1.2 }, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(anim, { toValue: { x: 0, y: 0 }, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      );
    loop(orb1, 30, -50, 20000).start();
    loop(orb2, -40, 30, 25000).start();
    loop(orb3, 20, -30, 18000).start();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateX: orb1.x }, { translateY: orb1.y }] }]} />
      <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateX: orb2.x }, { translateY: orb2.y }] }]} />
      <Animated.View style={[styles.orb, styles.orb3, { transform: [{ translateX: orb3.x }, { translateY: orb3.y }] }]} />
    </View>
  );
}

/* ── "Find your tea vibe." headline ────────────────────────── */
function HeroHeadline() {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.heroRow}>
      <MaterialIcons name="local-cafe" size={40} color={C.primaryFixedDim} />
      <View style={styles.heroTextBlock}>
        <Text style={styles.heroText}>
          Find your{' '}
          <Animated.Text style={[styles.heroAccent, { transform: [{ scale: pulseAnim }] }]}>
            tea
          </Animated.Text>
          {'\n'}vibe.
        </Text>
      </View>
    </View>
  );
}

/* ── Pill search bar ───────────────────────────────────────── */
function SearchBar({
  value,
  onChangeText,
  onSubmit,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
}) {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1.03, useNativeDriver: false, tension: 60, friction: 8 }),
      Animated.timing(glowAnim,  { toValue: 1, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  const handleBlur = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: false, tension: 60, friction: 8 }),
      Animated.timing(glowAnim,  { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.outlineVariant, C.primaryFixedDim],
  });

  return (
    <Animated.View style={[styles.searchWrapper, { transform: [{ scale: scaleAnim }], borderColor }]}>
      <MaterialIcons name="search" size={24} color={C.primaryFixedDim} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search users, tags, or tea..."
        placeholderTextColor="rgba(190,202,185,0.45)"
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.searchArrowBtn} onPress={onSubmit} activeOpacity={0.8}>
        <MaterialIcons name="arrow-forward" size={20} color={C.onPrimaryContainer} />
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ── User result card ──────────────────────────────────────── */
const UserCard = memo(function UserCard({ user, index }: { user: SearchUser; index: number }) {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 90,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 8,
        delay: index * 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // isOnline is lease-checked based on Firestore fields
  const isOnline = isUserOnline(user.lastSeen, user.isOnline);

  const lastSeenLabel = () => {
    if (!user.lastSeen) return null;
    // Format timestamp using robust presenceService helper
    const ms = getMillis(user.lastSeen);
    const diff  = Date.now() - ms;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins  < 1)  return 'Just now';
    if (hours < 1)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const router = useRouter();

  const handleStartChat = useCallback(() => {
    triggerSelection(); // Selection haptic
    // Navigate directly to chat screen with the other user's UID.
    // The chat page will handle finding/creating the actual chat session.
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: user.uid,
        username: user.displayName,
        photoURL: user.photoURL ?? 'null',
        isOnline: String(isOnline),
      },
    });
  }, [user, router, isOnline]);

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Hover glow overlay */}
      <View style={styles.cardGlow} />

      {/* Header row: avatar + name/username + online status */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarWrapper}>
          {user.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {user.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {/* Online dot */}
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.cardNameBlock}>
          <Text style={styles.cardDisplayName} numberOfLines={1}>{user.name}</Text>
          <Text style={styles.cardUsername} numberOfLines={1}>@{user.displayName}</Text>
        </View>

        {/* Online / Last Seen badge */}
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeLabel}>{isOnline ? 'ONLINE' : 'LAST SEEN'}</Text>
          <Text style={[styles.cardBadgeTime, isOnline && styles.cardBadgeTimeOnline]}>
            {isOnline ? 'Just now' : (lastSeenLabel() ?? '—')}
          </Text>
        </View>
      </View>

      {/* No bio field in Firestore profile — skip */}
      <Text style={[styles.cardBio, { opacity: 0.4 }]} numberOfLines={1}>Spilling tea since forever. 🍵</Text>

      {/* Start Chat CTA */}
      <TouchableOpacity
        style={[styles.ctaBtn, !isOnline && styles.ctaBtnOffline]}
        onPress={handleStartChat}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name="chat-bubble-outline"
          size={17}
          color={isOnline ? C.onPrimaryContainer : C.onSurfaceVariant}
        />
        <Text style={[styles.ctaBtnText, !isOnline && styles.ctaBtnTextOffline]}>
          Start Chat
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.index === nextProps.index &&
    prevProps.user.uid === nextProps.user.uid &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.user.displayName === nextProps.user.displayName &&
    prevProps.user.photoURL === nextProps.user.photoURL &&
    prevProps.user.isOnline === nextProps.user.isOnline &&
    prevProps.user.lastSeen === nextProps.user.lastSeen
  );
});

/* ── Main Screen ───────────────────────────────────────────── */
export default function SearchScreen() {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { results, isSearching, error, search, clearResults } = useSearch();
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);

  const [query, setQuery] = useState('');
  const hasQuery = query.trim().length > 0;

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    search(text);
  }, [search]);

  const handleSubmit = useCallback(() => {
    search(query);
  }, [query, search]);

  const handleClear = useCallback(() => {
    setQuery('');
    clearResults();
  }, [clearResults]);

  return (
    <View style={styles.container}>
      <AmbientOrbs />

      {/* ── Top bar ─────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/chats')} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color={C.onSurfaceVariant} />
        </TouchableOpacity>
        <Text style={styles.topBarLogo}>Tea</Text>
        {/* Clear button — shown when typing */}
        {hasQuery ? (
          <TouchableOpacity onPress={handleClear} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="close" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {/* ── Scrollable content ──────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View style={styles.heroSection}>
          <HeroHeadline />
          <SearchBar value={query} onChangeText={handleChange} onSubmit={handleSubmit} />
        </View>

        {/* Results section — only shown when query exists */}
        {hasQuery && (
          <View style={styles.resultsSection}>
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person-search" size={22} color={C.primaryFixedDim} />
              <Text style={styles.sectionTitle}>People</Text>
            </View>

            {/* Loading */}
            {isSearching && (
              <View style={styles.feedbackRow}>
                <ActivityIndicator size="small" color={C.primaryContainer} />
                <Text style={styles.feedbackText}>Searching…</Text>
              </View>
            )}

            {/* Error */}
            {!isSearching && error && (
              <View style={styles.feedbackRow}>
                <MaterialIcons name="error-outline" size={18} color="#ef4444" />
                <Text style={[styles.feedbackText, { color: '#ef4444' }]}>{error}</Text>
              </View>
            )}

            {/* No results */}
            {!isSearching && !error && results.length === 0 && (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsText}>No users found for "@{query}"</Text>
                <Text style={styles.emptyResultsSubtext}>Try a different username.</Text>
              </View>
            )}

            {/* Result cards */}
            {!isSearching && results.map((user, i) => (
              <UserCard key={user.uid} user={user} index={i} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── StyleSheet ─────────────────────────────────────────────── */
function getStyles(C: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },

  /* ── Ambient orbs ──────────────────────────────────────────── */
  orb: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.12,
  },
  orb1: {
    width: 280,
    height: 280,
    backgroundColor: C.primaryContainer,
    top: '8%',
    left: -80,
  },
  orb2: {
    width: 360,
    height: 360,
    backgroundColor: C.secondaryContainer,
    bottom: '18%',
    right: -100,
    opacity: 0.08,
  },
  orb3: {
    width: 180,
    height: 180,
    backgroundColor: C.primaryFixedDim,
    top: '38%',
    left: '55%',
    opacity: 0.08,
  },

  /* ── Top bar ────────────────────────────────────────────────── */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: isDark ? 'rgba(15,21,14,0.75)' : 'rgba(244,250,243,0.75)',
    borderBottomWidth: 1,
    borderBottomColor: C.outlineVariant,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLogo: {
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: C.primaryFixedDim,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(122,220,125,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  /* ── Scroll ─────────────────────────────────────────────────── */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, flexGrow: 1 },

  /* ── Hero section ───────────────────────────────────────────── */
  heroSection: {
    paddingTop: 32,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 24,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'flex-start',
  },
  heroTextBlock: { flex: 1 },
  heroText: {
    fontSize: 34,
    fontWeight: '800',
    color: C.onSurface,
    lineHeight: 40,
    letterSpacing: -1,
  },
  heroAccent: {
    color: C.primaryFixedDim,
    fontStyle: 'italic',
    fontSize: 34,
    fontWeight: '800',
  },

  /* ── Search bar ─────────────────────────────────────────────── */
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 9999,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    width: '100%',
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 16,
    elevation: 4,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: C.onSurface,
    padding: 0,
  },
  searchArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },

  /* ── Results section ────────────────────────────────────────── */
  resultsSection: { paddingTop: 8, gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.onSurface,
    letterSpacing: -0.3,
  },

  /* ── Feedback states ────────────────────────────────────────── */
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  feedbackText: {
    color: C.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyResults: { paddingVertical: 32, alignItems: 'center', gap: 6 },
  emptyResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.onSurface,
    textAlign: 'center',
  },
  emptyResultsSubtext: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: 'center',
  },

  /* ── User card ──────────────────────────────────────────────── */
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: isDark ? 'rgba(150,249,150,0.03)' : 'rgba(46,168,71,0.03)',
    borderRadius: 20,
  },

  /* Avatar */
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
    flexShrink: 0,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: C.outlineVariant,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.surfaceContainer,
    borderWidth: 2,
    borderColor: C.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: C.primaryFixedDim,
    includeFontPadding: false,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: C.primaryContainer,
    borderWidth: 2,
    borderColor: C.background,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  /* Name block */
  cardNameBlock: { flex: 1, gap: 2 },
  cardDisplayName: {
    fontSize: 17,
    fontWeight: '700',
    color: C.onSurface,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  cardUsername: {
    fontSize: 13,
    fontWeight: '400',
    color: C.onSurfaceVariant,
    includeFontPadding: false,
  },

  /* Online/last seen badge */
  cardBadge: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  cardBadgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(190,202,185,0.6)',
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  cardBadgeTime: {
    fontSize: 10,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
  cardBadgeTimeOnline: {
    color: C.primaryFixedDim,
  },

  /* Bio */
  cardBio: {
    fontSize: 14,
    fontWeight: '400',
    color: C.onSurfaceVariant,
    fontStyle: 'italic',
    lineHeight: 20,
    includeFontPadding: false,
  },

  /* CTA */
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primaryContainer,
    borderRadius: 9999,
    paddingVertical: 13,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaBtnOffline: {
    backgroundColor: C.surfaceVariant,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.onPrimaryContainer,
    includeFontPadding: false,
  },
  ctaBtnTextOffline: {
    color: C.onSurfaceVariant,
  },
});
}
