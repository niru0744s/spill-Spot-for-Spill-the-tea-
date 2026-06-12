import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInbox } from '@/hooks/useInbox';
import { GroupCard, type GroupCardItem } from '@/components/GroupCard';
import { getMessages, getUnreadCount } from '@/services/chatStorage';
import { storage } from '@/services/mmkv';

const { width } = Dimensions.get('window');

const C = {
  background: '#0f150e',
  surfaceContainer: '#1b211a',
  surfaceContainerHigh: '#262b24',
  primaryFixedDim: '#7adc7d',
  secondary: '#ffb59c',
  onSurface: '#dfe4d9',
  onSurfaceVariant: '#becab9',
  outlineVariant: '#3f4a3d',
  white: '#ffffff',
};

/* ── Animated Orbital Background ───────────────────────────── */
function OrbBackground() {
  const orb1x = useRef(new Animated.Value(0)).current;
  const orb1y = useRef(new Animated.Value(0)).current;
  const orb2x = useRef(new Animated.Value(0)).current;
  const orb2y = useRef(new Animated.Value(0)).current;
  const orb3x = useRef(new Animated.Value(0)).current;
  const orb3y = useRef(new Animated.Value(0)).current;
  const animsRef = useRef<Animated.CompositeAnimation[]>([]);

  useFocusEffect(
    useCallback(() => {
      const makeOrbit = (
        ax: Animated.Value,
        ay: Animated.Value,
        dx: number,
        dy: number,
        dur: number
      ) =>
        Animated.loop(
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

      const a1 = makeOrbit(orb1x, orb1y, -25, 45, 27000);
      const a2 = makeOrbit(orb2x, orb2y, 35, -35, 32000);
      const a3 = makeOrbit(orb3x, orb3y, -20, -45, 29000);
      animsRef.current = [a1, a2, a3];

      a1.start();
      a2.start();
      a3.start();

      return () => {
        animsRef.current.forEach((a) => a.stop());
      };
    }, [])
  );

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateX: orb1x }, { translateY: orb1y }] }]} />
      <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateX: orb2x }, { translateY: orb2y }] }]} />
      <Animated.View style={[styles.orb, styles.orb3, { transform: [{ translateX: orb3x }, { translateY: orb3y }] }]} />
    </View>
  );
}

/* ── Empty State ───────────────────────────────────────────── */
function EmptyState({ onCreateGroup }: { onCreateGroup: () => void }) {
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
        <MaterialIcons name="group" size={48} color={C.secondary} />
      </Animated.View>
      <Text style={styles.emptyTitle}>Your Tea Circles</Text>
      <Text style={styles.emptySubtitle}>
        You haven't joined any groups yet. Let's create one and brew some tea together! 🫖
      </Text>
      <TouchableOpacity style={styles.createPill} onPress={onCreateGroup} activeOpacity={0.8}>
        <Text style={styles.createPillText}>✦ CREATE A GROUP</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chats, refresh } = useInbox();
  const [localPreviewTrigger, setLocalPreviewTrigger] = useState(0);
  const isLoading = false;

  // Fetch groups on focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Listen to local MMKV changes to reactively update last messages and unread badges
  useEffect(() => {
    const listener = storage.addOnValueChangedListener((key) => {
      if (
        key === 'chats_index' ||
        key.startsWith('unread_') ||
        key.startsWith('msgs_')
      ) {
        setLocalPreviewTrigger((prev) => prev + 1);
      }
    });
    return () => listener.remove();
  }, []);

  // Filter and map Firestore-based chats to GroupCardItems, merging local MMKV states
  const groups: GroupCardItem[] = React.useMemo(() => {
    if (!chats) return [];
    return chats
      .filter(
        (item) =>
          item.isGroup &&
          (item.status === 'ACTIVE' || item.status === 'REMOVED')
      )
      .map((item) => {
        // Read local message list from MMKV for preview
        const localMsgs = getMessages(item.chatId);
        const lastMsg = localMsgs[localMsgs.length - 1];
        
        return {
          id: item.chatId,
          groupName: item.partnerName ?? 'Unknown Group',
          groupImageUrl: item.partnerPhoto ?? null,
          groupDescription: null,
          lastMessageText: lastMsg ? lastMsg.content : item.lastMessage,
          lastMessageAt: lastMsg
            ? new Date(lastMsg.createdAt).toISOString()
            : item.lastMessageAt
              ? new Date(item.lastMessageAt).toISOString()
              : null,
          unreadCount: getUnreadCount(item.chatId),
          isAdmin: false,
          status: (item.status as 'ACTIVE' | 'REMOVED') || 'ACTIVE',
        };
      })
      .sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [chats, localPreviewTrigger]);

  const handleCreateGroup = () => {
    router.push('/group/create');
  };

  const handleCardPress = (groupId: string) => {
    router.push(`/group/${groupId}`);
  };

  return (
    <View style={styles.container}>
      <OrbBackground />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Community</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleCreateGroup}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={20} color={C.background} />
          <Text style={styles.headerBtnText}>CREATE</Text>
        </TouchableOpacity>
      </View>

      {/* Feed List */}
      {isLoading && groups.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={C.secondary} />
        </View>
      ) : groups.length === 0 ? (
        <EmptyState onCreateGroup={handleCreateGroup} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <GroupCard
              item={item}
              onPress={() => handleCardPress(item.id)}
              index={index}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    gap: 4,
  },
  headerBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: C.background,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 100,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Orb Background Styles ───────────────────────────────── */
  orb: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.04,
  },
  orb1: {
    top: 50,
    left: -50,
    backgroundColor: C.primaryFixedDim,
  },
  orb2: {
    bottom: 100,
    right: -50,
    backgroundColor: C.secondary,
  },
  orb3: {
    top: '40%',
    right: -20,
    backgroundColor: C.primaryFixedDim,
  },

  /* ── Empty State Styles ──────────────────────────────────── */
  emptyContainer: {
    flex: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,181,156,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,181,156,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 21,
  },
  createPill: {
    marginTop: 8,
    backgroundColor: 'rgba(255,181,156,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,181,156,0.25)',
    borderRadius: 9999,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  createPillText: {
    color: C.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
