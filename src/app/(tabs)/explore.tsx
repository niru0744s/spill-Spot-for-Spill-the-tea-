/**
 * (tabs)/explore.tsx
 * ------------------
 * Niche-aware content feed powered by GNews API.
 *
 * States:
 *   • No niches set  → shuffled random articles from all 20 niches
 *                      + "Set Your Niches" banner at the top
 *   • Niches set     → articles filtered to the user's 3–5 niches
 *                      + floating ✏️ FAB to open EditNichesSheet
 *
 * Content: GNews API (EXPO_PUBLIC_GNEWS_API_KEY)
 *   - 100 req/day free tier; results cached in component state
 *   - Static fallback cards shown on API failure / offline
 *
 * Strictly does NOT modify any other screen, hook, or component.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import EditNichesSheet from '@/components/EditNichesSheet';
import { NICHE_KEYWORDS, ALL_NICHES, NICHE_EMOJI } from '@/constants/niches';

// ---------------------------------------------------------------------------
// Design tokens (matching DESIGN.md — no imports, keep self-contained)
// ---------------------------------------------------------------------------

const C = {
  background:           '#0f150e',
  surface:              '#1b211a',
  surfaceHigh:          '#262b24',
  surfaceVariant:       '#31362f',
  primary:              '#96f996',
  primaryDim:           '#7adc7d',
  secondary:            '#ffb59c',
  onSurface:            '#dfe4d9',
  onSurfaceVariant:     '#becab9',
  outline:              '#899485',
  outlineVariant:       'rgba(63,74,61,0.6)',
};

const { width: SCREEN_W } = Dimensions.get('window');


// ---------------------------------------------------------------------------
// Static fallback cards (shown when API is unavailable)
// ---------------------------------------------------------------------------

interface NewsArticle {
  id: string;
  niche: string;
  nicheEmoji: string;
  title: string;
  source: string;
  publishedAt: string;
  image: string | null;
  url: string;
}

const FALLBACK_CARDS: NewsArticle[] = [
  { id: 'f1', niche: 'Drama & Tea', nicheEmoji: '🍵', title: 'The biggest celebrity drama moments this week', source: 'Spill Digest', publishedAt: new Date().toISOString(), image: null, url: '' },
  { id: 'f2', niche: 'Tech & AI', nicheEmoji: '💻', title: 'AI just changed everything — here\'s what you need to know', source: 'Tech Daily', publishedAt: new Date().toISOString(), image: null, url: '' },
  { id: 'f3', niche: 'Fashion', nicheEmoji: '👗', title: 'Top trending fashion aesthetics taking over this season', source: 'Style Wire', publishedAt: new Date().toISOString(), image: null, url: '' },
  { id: 'f4', niche: 'Mental Health', nicheEmoji: '🧠', title: 'Simple daily habits that actually improve your mood', source: 'Wellness Hub', publishedAt: new Date().toISOString(), image: null, url: '' },
  { id: 'f5', niche: 'Gaming', nicheEmoji: '🎮', title: 'Most hyped game releases coming this month', source: 'Game Radar', publishedAt: new Date().toISOString(), image: null, url: '' },
  { id: 'f6', niche: 'K-Pop & K-Drama', nicheEmoji: '🎵', title: 'K-Drama releases you absolutely cannot miss right now', source: 'Hallyu Now', publishedAt: new Date().toISOString(), image: null, url: '' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (hrs  < 1)  return `${mins}m ago`;
  if (days < 1)  return `${hrs}h ago`;
  return `${days}d ago`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const GNEWS_KEY = process.env.EXPO_PUBLIC_GNEWS_API_KEY ?? '';

// Possible API failure reasons — used to show specific error messages
type FetchError = 'none' | 'quota' | 'auth' | 'network' | 'empty';

async function fetchForNiche(niche: string, max = 10): Promise<{ articles: NewsArticle[]; error: FetchError }> {
  const keyword = encodeURIComponent(NICHE_KEYWORDS[niche] ?? niche);
  const nicheEmoji = NICHE_EMOJI[niche] ?? '📰';
  try {
    const res = await fetch(
      `https://gnews.io/api/v4/search?q=${keyword}&lang=en&max=${max}&apikey=${GNEWS_KEY}`
    );

    if (!res.ok) {
      // Log the actual API error so it's visible in Metro/LogBox
      const body = await res.text().catch(() => '');
      console.warn(`[GNews] ${niche} → HTTP ${res.status}`, body.slice(0, 200));
      if (res.status === 429) return { articles: [], error: 'quota' };
      if (res.status === 401 || res.status === 403) return { articles: [], error: 'auth' };
      return { articles: [], error: 'network' };
    }

    const data = await res.json();
    const articles = (data.articles ?? []).map((a: GNewsArticle, i: number) => {
      // Force HTTPS — Android blocks HTTP image loads (cleartext traffic)
      let imageUrl: string | null = a.image ?? null;
      if (imageUrl && imageUrl.startsWith('http://')) {
        imageUrl = imageUrl.replace('http://', 'https://');
      }
      return {
        id: `${niche}-${i}-${Date.now()}`,
        niche,
        nicheEmoji,
        title: a.title,
        source: a.source?.name ?? 'Unknown',
        publishedAt: a.publishedAt,
        image: imageUrl,
        url: a.url ?? '',
      };
    });

    return { articles, error: articles.length === 0 ? 'empty' : 'none' };
  } catch (e) {
    console.warn(`[GNews] ${niche} → network error`, e);
    return { articles: [], error: 'network' };
  }
}

interface GNewsArticle {
  title: string;
  publishedAt: string;
  image?: string;
  url?: string;
  source?: { name: string };
}



// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Shown at the top when the user hasn't set their niches yet */
function NicheSetBanner({ onPress }: { onPress: () => void }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1400 }),
        withTiming(1, { duration: 1400 })
      ),
      -1,
      false
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[styles.banner, animatedStyle]}>
        <View style={styles.bannerIcon}>
          <Text style={{ fontSize: 22 }}>🎯</Text>
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>Personalize your feed</Text>
          <Text style={styles.bannerSub}>Pick 3–5 niches to see content you actually care about →</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

/** Shimmer placeholder card shown while loading */
function SkeletonCard() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 800 }),
        withTiming(0.4, { duration: 800 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.skeletonChip} />
      <View style={styles.skeletonImageBox} />
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '65%' }]} />
      <View style={[styles.skeletonLine, { width: '40%', opacity: 0.5 }]} />
    </Animated.View>
  );
}

/** Individual news card */
function FeedCard({ article, index }: { article: NewsArticle; index: number }) {
  const scale = useSharedValue(1);
  // Flip to emoji fallback if the image URL fails to load
  const [imgError, setImgError] = useState(false);

  const cappedDelay = Math.min(index, 8) * 55;

  const onPressIn  = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handlePress = () => {
    if (article.url) Linking.openURL(article.url).catch(() => {});
  };

  const showImage = article.image && !imgError;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(cappedDelay).springify().damping(15).stiffness(150)}
    >
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.card}
        >
          {/* Niche chip */}
          <View style={styles.nicheChip}>
            <Text style={styles.nicheChipEmoji}>{article.nicheEmoji}</Text>
            <Text style={styles.nicheChipLabel}>{article.niche.toUpperCase()}</Text>
          </View>

          {/* Thumbnail — falls back to emoji if URL fails or is null */}
          {showImage ? (
            <Image
              source={{ uri: article.image! }}
              style={styles.cardImage}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.cardImageFallback}>
              <Text style={{ fontSize: 36 }}>{article.nicheEmoji}</Text>
            </View>
          )}

          {/* Headline */}
          <Text style={styles.cardTitle} numberOfLines={2}>
            {article.title}
          </Text>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardSource} numberOfLines={1}>
              {article.source}
            </Text>
            <Text style={styles.cardTime}>{timeAgo(article.publishedAt)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

/** Floating edit FAB */
function EditFAB({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const onPressIn  = () => {
    scale.value = withSpring(0.9, { damping: 10, stiffness: 300 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 8, stiffness: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.fab, animatedStyle]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={styles.fabInner}
        accessibilityLabel="Edit your niches"
        accessibilityRole="button"
      >
        <MaterialIcons name="tune" size={20} color="#00390d" />
        <Text style={styles.fabLabel}>Niches</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

// How many articles to show per page of the infinite scroll
const PAGE_SIZE = 10;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { user, saveNiches, isLoading } = useAuth();

  const userNiches: string[] = user?.niches ?? [];
  const hasNiches = userNiches.length >= 3;

  // Full fetched pool — never shown directly, used as the infinite source
  const articlePool = useRef<NewsArticle[]>([]);
  // Timestamp of the last successful feed fetch (ms). Used to skip re-fetches
  // when the user quickly switches tabs and comes back.
  const lastFetchedAt = useRef<number>(0);
  // How long a feed is considered "fresh" before we re-fetch (15 minutes)
  const FEED_TTL_MS = 15 * 60 * 1000;
  // What's actually rendered in the FlatList (grows on each loadMore)
  const [displayed, setDisplayed]     = useState<NewsArticle[]>([]);
  const [isFetching, setIsFetching]   = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedError, setFeedError]     = useState<FetchError>('none');
  const [refreshing, setRefreshing]   = useState(false);
  const [sheetOpen, setSheetOpen]     = useState(false);
  // Tracks how many full loops through the pool we've done
  const loopCount = useRef(0);
  // Cursor = index of the next article in the pool to show
  const cursor = useRef(0);

  // ── Append next page from pool (infinite scroll) ─────────────────────────
  const loadMore = useCallback(() => {
    if (isLoadingMore || isFetching || articlePool.current.length === 0) return;
    setIsLoadingMore(true);

    setTimeout(() => {
      const pool = articlePool.current;

      // If cursor is at or past the end, reshuffle and start a new cycle
      if (cursor.current >= pool.length) {
        loopCount.current += 1;
        articlePool.current = shuffle(pool);
        cursor.current = 0;
      }

      // Slice the next PAGE_SIZE unseen articles
      const nextBatch = articlePool.current
        .slice(cursor.current, cursor.current + PAGE_SIZE)
        .map((a, i) => ({
          ...a,
          // Unique key per cycle so FlatList doesn't collide
          id: `${a.id}-c${loopCount.current}-${cursor.current + i}`,
        }));

      cursor.current += PAGE_SIZE;
      setDisplayed((prev) => [...prev, ...nextBatch]);
      setIsLoadingMore(false);
    }, 500);
  }, [isLoadingMore, isFetching]);

  // ── Fetch feed from API ──────────────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    if (!GNEWS_KEY) {
      articlePool.current = shuffle(FALLBACK_CARDS);
      setDisplayed(articlePool.current.slice(0, PAGE_SIZE));
      return;
    }

    // ── Cache guard: skip re-fetch if pool is warm and within TTL ────────────
    // (Triggered on tab switch or minor state change — not on explicit refresh)
    const now = Date.now();
    if (
      !refreshing &&
      articlePool.current.length > 0 &&
      now - lastFetchedAt.current < FEED_TTL_MS
    ) {
      return;
    }

    setIsFetching(true);
    setFeedError('none');
    loopCount.current = 0;
    cursor.current = 0;

    try {
      const nichesToFetch = hasNiches
        ? userNiches
        : shuffle(ALL_NICHES).slice(0, 8);

      const perNiche = 10;

      const results = await Promise.all(
        nichesToFetch.map((n) => fetchForNiche(n, perNiche))
      );

      // Detect the most critical error across all niche fetches
      const errors = results.map((r) => r.error);
      const dominantError: FetchError =
        errors.includes('quota')   ? 'quota'   :
        errors.includes('auth')    ? 'auth'    :
        errors.includes('network') ? 'network' : 'none';

      const flat = shuffle(results.flatMap((r) => r.articles));

      if (flat.length === 0) {
        articlePool.current = shuffle(FALLBACK_CARDS);
        setFeedError(dominantError === 'none' ? 'empty' : dominantError);
      } else {
        articlePool.current = flat;
        // Show error badge even when some articles loaded (partial failure)
        if (dominantError !== 'none') setFeedError(dominantError);
      }

      setDisplayed(articlePool.current.slice(0, PAGE_SIZE));
      // Mark the pool as fresh so tab-switches don't trigger re-fetches
      lastFetchedAt.current = Date.now();
    } catch (e) {
      console.warn('[Explore] loadFeed crashed:', e);
      articlePool.current = shuffle(FALLBACK_CARDS);
      setDisplayed(articlePool.current.slice(0, PAGE_SIZE));
      setFeedError('network');
    } finally {
      setIsFetching(false);
      setRefreshing(false);
    }
  }, [hasNiches, userNiches]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setDisplayed([]);
    // Clear timestamp so the cache guard in loadFeed doesn't skip this refresh
    lastFetchedAt.current = 0;
    loadFeed();
  }, [loadFeed]);

  // ── Handle niche save from sheet ────────────────────────────────────────
  const handleSaveNiches = useCallback(
    async (niches: string[]) => {
      await saveNiches(niches);
      setSheetOpen(false);
    },
    [saveNiches]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  // ── List sub-components (defined inside render to access state) ──────────

  const ListHeader = useCallback(() => (
    <View style={styles.listHeaderWrapper}>
      {!hasNiches && <NicheSetBanner onPress={() => setSheetOpen(true)} />}
      <View style={styles.sectionRow}>
        <MaterialIcons
          name={hasNiches ? 'local-fire-department' : 'shuffle'}
          size={16}
          color={C.primaryDim}
        />
        <Text style={styles.sectionLabel}>
          {hasNiches ? 'YOUR TEA FEED' : 'DISCOVER ALL VIBES'}
        </Text>
      </View>
      {/* Skeleton loading state */}
      {isFetching && !refreshing && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}
    </View>
  ), [hasNiches, isFetching, refreshing]);

  const ListFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={styles.footerLoaderText}>Pouring more tea...</Text>
      </View>
    );
  }, [isLoadingMore]);

  const renderCard = useCallback(
    ({ item, index }: { item: NewsArticle; index: number }) => (
      <FeedCard article={item} index={index} />
    ),
    []
  );

  return (
    <View style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8) }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Explore</Text>
          {hasNiches && (
            <View style={styles.headerNichePills}>
              {userNiches.slice(0, 2).map((n) => (
                <View key={n} style={styles.headerNichePill}>
                  <Text style={styles.headerNichePillText}>
                    {NICHE_EMOJI[n]} {n}
                  </Text>
                </View>
              ))}
              {userNiches.length > 2 && (
                <View style={styles.headerNichePill}>
                  <Text style={styles.headerNichePillText}>+{userNiches.length - 2}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {feedError !== 'none' && (
            <TouchableOpacity
              onPress={handleRefresh}
              activeOpacity={0.75}
              style={[
                styles.errorBadge,
                feedError === 'quota' && styles.errorBadgeQuota,
              ]}
            >
              <MaterialIcons
                name={feedError === 'network' ? 'wifi-off' : feedError === 'quota' ? 'hourglass-empty' : 'error-outline'}
                size={12}
                color={feedError === 'quota' ? '#ffd166' : '#ffb59c'}
              />
              <Text style={[
                styles.errorBadgeText,
                feedError === 'quota' && { color: '#ffd166' },
              ]}>
                {feedError === 'quota'   ? 'quota limit' :
                 feedError === 'auth'    ? 'bad API key' :
                 feedError === 'network' ? 'network err' :
                 feedError === 'empty'   ? 'no results'  : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Feed — FlatList for infinite scroll ─────────────────────────── */}
      <FlatList
        data={isFetching ? [] : displayed}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          !isFetching ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🫙</Text>
              <Text style={styles.emptyTitle}>No tea right now</Text>
              <Text style={styles.emptySub}>Pull down to refresh</Text>
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        removeClippedSubviews
        windowSize={8}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
      />

      {/* ── Floating Edit FAB (only when niches are set) ───────────────── */}
      {hasNiches && <EditFAB onPress={() => setSheetOpen(true)} />}

      {/* ── Edit Niches Bottom Sheet ────────────────────────────────────── */}
      <EditNichesSheet
        visible={sheetOpen}
        currentNiches={userNiches}
        onClose={() => setSheetOpen(false)}
        onSave={handleSaveNiches}
        isSaving={isLoading}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(63,74,61,0.4)',
    backgroundColor: 'rgba(15,21,14,0.92)',
  },
  headerLeft: { flex: 1, gap: 8 },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.onSurface,
    letterSpacing: -0.5,
  },
  headerNichePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerNichePill: {
    backgroundColor: 'rgba(150,249,150,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(150,249,150,0.2)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  headerNichePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.primaryDim,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,181,156,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,181,156,0.2)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  errorBadgeQuota: {
    backgroundColor: 'rgba(255,209,102,0.08)',
    borderColor: 'rgba(255,209,102,0.25)',
  },
  errorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffb59c',
    letterSpacing: 0.5,
  },

  // ── List ─────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
    flexGrow: 1,
  },
  listHeaderWrapper: {
    gap: 14,
  },

  // ── Footer loader ─────────────────────────────────────────────────────────
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  footerLoaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.outline,
    letterSpacing: 0.3,
  },

  // ── Banner ───────────────────────────────────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,181,156,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,181,156,0.2)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,181,156,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerText: { flex: 1, gap: 4 },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffb59c',
  },
  bannerSub: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,181,156,0.7)',
    lineHeight: 18,
  },

  // ── Section label ─────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.outline,
    letterSpacing: 1.4,
  },

  // ── Feed card ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: 'rgba(27,33,26,0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(63,74,61,0.5)',
    overflow: 'hidden',
    gap: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  nicheChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(150,249,150,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(150,249,150,0.18)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nicheChipEmoji: { fontSize: 12 },
  nicheChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primaryDim,
    letterSpacing: 0.8,
  },
  cardImage: {
    width: '100%',
    height: 170,
    borderRadius: 12,
    backgroundColor: C.surfaceHigh,
  },
  cardImageFallback: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    backgroundColor: 'rgba(38,43,36,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onSurface,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardSource: {
    fontSize: 12,
    fontWeight: '500',
    color: C.outline,
    flex: 1,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(137,148,133,0.6)',
    letterSpacing: 0.3,
    flexShrink: 0,
  },

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonChip: {
    width: 90,
    height: 22,
    borderRadius: 9999,
    backgroundColor: C.surfaceHigh,
  },
  skeletonImageBox: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: C.surfaceHigh,
  },
  skeletonLine: {
    width: '100%',
    height: 14,
    borderRadius: 6,
    backgroundColor: C.surfaceHigh,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.onSurface,
  },
  emptySub: {
    fontSize: 14,
    color: C.outline,
  },

  // ── FAB ───────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.primary,
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  fabLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00390d',
    letterSpacing: 0.2,
  },
});
