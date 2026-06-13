/**
 * (auth)/index.tsx
 * ----------------
 * Landing page shown to unauthenticated new users.
 * Matches the Stitch "Tea" landing design:
 *   - Deep charcoal (#0f150e) background with animated radial glow blobs
 *   - Matcha green (#96f996) primary / Peach (#ffb59c) secondary palette
 *   - Animated coffee cup icon + bouncing "!!!" badge
 *   - Italic "Tea" headline (bold, large)
 *   - Subtitle in readable body font
 *   - "Start Spilling" pill → signup, "Sign In" outline pill → login
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

const { width, height } = Dimensions.get('window');

/* ─── Animated Coffee Cup ───────────────────────────────────── */
function CoffeeCupIcon({ glowAnim }: { glowAnim: Animated.Value }) {
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const steamAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Badge bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -10, duration: 450, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0,   duration: 450, useNativeDriver: true }),
      ])
    ).start();

    // Steam rise
    Animated.loop(
      Animated.sequence([
        Animated.timing(steamAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(steamAnim, { toValue: 0, duration: 300,  useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const steamTranslate = steamAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const steamOpacity = steamAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.7, 0],
  });

  return (
    <View style={styles.iconWrapper}>
      {/* Glow halo behind cup */}
      <Animated.View
        style={[
          styles.iconGlow,
          {
            opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.2, 0.5] }),
            transform: [{
              scale: glowAnim.interpolate({ inputRange: [0,1], outputRange: [1, 1.18] }),
            }],
          },
        ]}
      />

      {/* ── Cup shape ─────────────────────────────────────── */}
      <View style={styles.cupOuter}>
        {/* Steam wisps */}
        <Animated.View style={[styles.steamWisp, styles.steamL, { opacity: steamOpacity, transform: [{ translateY: steamTranslate }] }]} />
        <Animated.View style={[styles.steamWisp, styles.steamM, { opacity: steamOpacity, transform: [{ translateY: steamTranslate }] }]} />
        <Animated.View style={[styles.steamWisp, styles.steamR, { opacity: steamOpacity, transform: [{ translateY: steamTranslate }] }]} />

        {/* Cup rim */}
        <View style={styles.cupRim} />

        {/* Cup body row: handle + body */}
        <View style={styles.cupRow}>
          <View style={styles.cupBody} />
          <View style={styles.cupHandle} />
        </View>

        {/* Saucer */}
        <View style={styles.cupSaucer} />
      </View>

      {/* Bouncing "!!!" peach badge */}
      <Animated.View style={[styles.badge, { transform: [{ translateY: bounceAnim }] }]}>
        <Text style={styles.badgeText}>!!!</Text>
      </Animated.View>
    </View>
  );
}

/* ─── Landing Screen ────────────────────────────────────────── */
export default function LandingScreen() {
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const router = useRouter();

  const glowAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(70)).current;
  const scaleHero = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();

    // Page entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 700, useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0, tension: 45, friction: 8, useNativeDriver: true,
      }),
      Animated.spring(scaleHero, {
        toValue: 1, tension: 55, friction: 7, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* ── Background glow blobs ──────────────────────────── */}
      <Animated.View
        style={[styles.blobTopLeft, {
          opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.06, 0.15] }),
          pointerEvents: 'none',
        }]}
      />
      <Animated.View
        style={[styles.blobBottomRight, {
          opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.05, 0.12] }),
          pointerEvents: 'none',
        }]}
      />

      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

        {/* ── Hero ──────────────────────────────────────────── */}
        <Animated.View style={[styles.hero, { transform: [{ scale: scaleHero }] }]}>
          <CoffeeCupIcon glowAnim={glowAnim} />

          <Text style={styles.title}>Tea</Text>

          <Text style={styles.subtitle}>
            Spill the tea. Unfiltered social space{'\n'}for the chronically online.
          </Text>
        </Animated.View>

        {/* ── CTA Buttons ───────────────────────────────────── */}
        <Animated.View style={[styles.cta, { transform: [{ translateY: slideAnim }] }]}>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.82}
          >
            <Text style={styles.primaryBtnText}>Start Spilling</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.82}
          >
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

/* ─── StyleSheet ────────────────────────────────────────────── */
function getStyles(C: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: C.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 40,
      paddingTop: 16,
    },

    /* Background blobs */
    blobTopLeft: {
      position: 'absolute',
      top: -(height * 0.08),
      left: -(width * 0.08),
      width: width * 0.55,
      height: width * 0.55,
      borderRadius: width * 0.275,
      backgroundColor: C.primaryContainer,
    },
    blobBottomRight: {
      position: 'absolute',
      bottom: -(height * 0.08),
      right: -(width * 0.08),
      width: width * 0.65,
      height: width * 0.65,
      borderRadius: width * 0.325,
      backgroundColor: C.secondaryContainer,
    },

    /* Hero section */
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
    },

    /* ── Icon wrapper ─────────────────────────────────────────── */
    iconWrapper: {
      width: 130,
      height: 130,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    iconGlow: {
      position: 'absolute',
      width: 108,
      height: 108,
      borderRadius: 54,
      backgroundColor: C.primaryFixedDim,
    },

    /* Cup */
    cupOuter: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      paddingTop: 16,
    },
    steamWisp: {
      position: 'absolute',
      width: 4,
      height: 14,
      borderRadius: 2,
      backgroundColor: 'rgba(122,220,125,0.6)',
      top: 0,
    },
    steamL: { left: 22 },
    steamM: { left: 36 },
    steamR: { left: 50 },
    cupRim: {
      width: 68,
      height: 7,
      backgroundColor: C.primaryFixedDim,
      borderRadius: 4,
      marginBottom: 2,
    },
    cupRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cupBody: {
      width: 60,
      height: 42,
      backgroundColor: C.primaryFixedDim,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
    },
    cupHandle: {
      width: 15,
      height: 26,
      borderRadius: 10,
      borderWidth: 4,
      borderColor: C.primaryFixedDim,
      backgroundColor: 'transparent',
      marginLeft: -2,
      marginTop: 6,
    },
    cupSaucer: {
      width: 76,
      height: 7,
      backgroundColor: C.primaryFixedDim,
      borderRadius: 4,
      marginTop: 2,
    },

    /* Bouncing badge */
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: C.secondary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 6,
    },
    badgeText: {
      color: isDark ? '#5c1a00' : '#ffffff',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },

    /* Title */
    title: {
      fontSize: 56,
      fontWeight: '800',
      color: C.onSurface,
      fontStyle: 'italic',
      letterSpacing: -2,
      lineHeight: 60,
      textAlign: 'center',
    },

    /* Subtitle */
    subtitle: {
      fontSize: 17,
      fontWeight: '500',
      color: C.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 27,
      maxWidth: 300,
    },

    /* CTA area */
    cta: {
      width: '100%',
      gap: 12,
    },
    primaryBtn: {
      width: '100%',
      backgroundColor: C.primaryContainer,
      paddingVertical: 18,
      borderRadius: 9999,
      alignItems: 'center',
      shadowColor: C.primaryContainer,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 22,
      elevation: 12,
    },
    primaryBtnText: {
      color: C.onPrimaryContainer,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    secondaryBtn: {
      width: '100%',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: C.outlineVariant,
      paddingVertical: 18,
      borderRadius: 9999,
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: C.secondaryFixed,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });
}
