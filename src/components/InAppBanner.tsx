/**
 * components/InAppBanner.tsx
 * --------------------------
 * Sliding in-app notification banner overlay.
 * Absolute-positioned at the root of the app, sliding down from the top safe area insets.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBannerStore } from '@/store/bannerStore';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

const { width } = Dimensions.get('window');

export function InAppBanner() {
  const { colors: C, isDark } = useTheme();
  const styles = getStyles(C, isDark);
  const insets = useSafeAreaInsets();
  const { visible, title, message, photoURL, onPress, hideBanner } = useBannerStore();
  
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger animations when visibility changes
  useEffect(() => {
    if (visible) {
      // Clear any running timers
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

      // Slide Down
      Animated.spring(slideAnim, {
        toValue: insets.top + 8,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Setup 4-second auto-dismiss
      dismissTimerRef.current = setTimeout(() => {
        hideBanner();
      }, 4000);
    } else {
      // Slide Up
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [visible, insets.top, slideAnim, hideBanner]);

  const handlePress = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    hideBanner();
    if (onPress) onPress();
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  // Don't render if completely hidden off-screen (saves rendering layout costs)
  if (!visible && (slideAnim as any)._value === -150) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Sender Avatar */}
        <View style={styles.avatarWrap}>
          {photoURL && photoURL !== 'null' ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{getInitial(title)}</Text>
            </View>
          )}
        </View>

        {/* Message Info */}
        <View style={styles.contentWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.message} numberOfLines={1}>
            {message}
          </Text>
        </View>

        {/* Arrow Action / Close Icon */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={(e) => {
            e.stopPropagation(); // prevent triggering onPress navigation
            hideBanner();
          }}
        >
          <MaterialIcons name="close" size={18} color={C.onSurfaceVariant} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const getStyles = (C: ThemeColors, isDark: boolean) => StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: width - 32,
    padding: 12,
    backgroundColor: isDark ? 'rgba(27, 33, 26, 0.95)' : 'rgba(234, 242, 232, 0.95)', // glassmorphic surface
    borderWidth: 1,
    borderColor: isDark ? 'rgba(150, 249, 150, 0.25)' : 'rgba(46, 168, 71, 0.25)',
    borderRadius: 20,
    gap: 12,
    // Soft matcha green glow
    shadowColor: C.primaryFixedDim,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(122,220,125,0.15)' : 'rgba(46,168,71,0.15)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(122,220,125,0.3)' : 'rgba(46,168,71,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: C.primaryFixedDim,
  },
  contentWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: C.onSurface,
    fontFamily: 'Sora',
  },
  message: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontFamily: 'Plus Jakarta Sans',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  },
});
