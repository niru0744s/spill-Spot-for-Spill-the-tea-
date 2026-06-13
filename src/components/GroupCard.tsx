import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

export interface GroupCardItem {
  id: string;
  groupName: string;
  groupImageUrl: string | null;
  groupDescription: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isAdmin: boolean;
  status: 'ACTIVE' | 'REMOVED';
}

interface GroupCardProps {
  item: GroupCardItem;
  onPress: () => void;
  index: number;
}

export function GroupCard({ item, onPress, index }: GroupCardProps) {
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 9,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const hasUnread = item.unreadCount > 0;
  const isRemoved = item.status === 'REMOVED';

  // Format date safely
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    try {
      const ms = new Date(isoString).getTime();
      const now = Date.now();
      const diff = now - ms;
      const mins = Math.floor(diff / 60_000);
      const hrs = Math.floor(diff / 3_600_000);
      const days = Math.floor(diff / 86_400_000);
      if (mins < 1) return 'Just now';
      if (hrs < 1) return `${mins}m ago`;
      if (days < 1) return `${hrs}h ago`;
      if (days < 7) return `${days}d ago`;
      return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const timeLabel = formatTime(item.lastMessageAt);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.card, hasUnread && styles.cardActive]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {hasUnread && <View style={styles.glow} />}

        {/* Group Avatar */}
        <View style={[styles.avatar, hasUnread && styles.avatarActive, isRemoved && styles.avatarRemoved]}>
          {item.groupImageUrl ? (
            <Image source={{ uri: item.groupImageUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarText, isRemoved && styles.avatarTextRemoved]}>
              {item.groupName?.charAt(0)?.toUpperCase() ?? 'G'}
            </Text>
          )}
          {item.isAdmin && <View style={styles.adminBadge} />}
        </View>

        {/* Info Area */}
        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={[styles.name, hasUnread && styles.nameActive]} numberOfLines={1}>
              {item.groupName}
            </Text>
            <Text style={[styles.time, hasUnread && styles.timeActive]}>
              {timeLabel}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.preview, hasUnread && styles.previewActive]} numberOfLines={1}>
              {isRemoved
                ? 'You can no longer participate in this group'
                : item.lastMessageText || 'No messages yet. Say hi! 🫖'}
            </Text>

            {isRemoved ? (
              <View style={styles.removedTag}>
                <Text style={styles.removedText}>Removed</Text>
              </View>
            ) : hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const getStyles = (C: ThemeColors, isDark: boolean) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    backgroundColor: C.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  cardActive: {
    backgroundColor: isDark ? 'rgba(38,43,36,0.85)' : 'rgba(234,242,232,0.95)',
    borderColor: isDark ? 'rgba(122,220,125,0.15)' : 'rgba(46,168,71,0.25)',
    shadowColor: C.primaryFixedDim,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(150,249,150,0.04)' : 'rgba(46,168,71,0.04)',
    borderRadius: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarActive: {
    borderWidth: 2,
    borderColor: isDark ? 'rgba(122,220,125,0.4)' : 'rgba(46,168,71,0.5)',
  },
  avatarRemoved: {
    opacity: 0.5,
    borderWidth: 1,
    borderColor: C.secondary,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: C.secondary,
    includeFontPadding: false,
  },
  avatarTextRemoved: {
    color: C.secondary,
  },
  adminBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.secondary,
    borderWidth: 1.5,
    borderColor: C.background,
  },
  info: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: C.onSurface,
    flex: 1,
    paddingRight: 8,
    includeFontPadding: false,
  },
  nameActive: {
    color: C.white,
    fontWeight: '800',
  },
  time: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    includeFontPadding: false,
  },
  timeActive: {
    color: C.primaryFixedDim,
    fontWeight: '600',
  },
  preview: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    flex: 1,
    paddingRight: 8,
    includeFontPadding: false,
  },
  previewActive: {
    color: C.onSurface,
    fontWeight: '500',
  },
  unreadBadge: {
    height: 18,
    minWidth: 18,
    borderRadius: 9,
    backgroundColor: C.primaryFixedDim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: C.background,
    includeFontPadding: false,
  },
  removedTag: {
    backgroundColor: isDark ? 'rgba(255,181,156,0.15)' : 'rgba(224,101,61,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  removedText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.secondary,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
});
