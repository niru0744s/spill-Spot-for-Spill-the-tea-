/**
 * (onboarding)/niches.tsx
 * -----------------------
 * Niche selection onboarding screen.
 *
 * Shown exactly once — after signup — before the user lands on the main tabs.
 * Returning users who already have niches saved skip this screen entirely
 * (routing gate in _layout.tsx handles that).
 *
 * Rules:
 *   - 20 curated niches across 5 thematic clusters
 *   - Minimum 3 selections required to enable the CTA
 *   - Maximum 5 selections (unselected pills fade when cap is reached)
 *   - On submit: writes to Firestore via saveNiches() → routing gate
 *     detects niches now set → navigates to /(tabs)/chats automatically
 *
 * Design: strictly follows DESIGN.md
 *   - Background: Deep Charcoal #0f150e
 *   - Selected state: Matcha Green #96f996 glow border + tinted fill
 *   - Typography: Sora (headline), Plus Jakarta Sans (body), Space Grotesk (labels)
 *   - Animations: spring squish on pill tap, animated selection counter
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import {
  PlusJakartaSans_500Medium,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useAuth } from '@/hooks/useAuth';
import { NICHES, type NicheItem } from '@/constants/niches';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PILL_GAP = 10;
const PILL_WIDTH = (SCREEN_WIDTH - 40 - PILL_GAP) / 2; // 2 columns, 20px side margins

const MIN_SELECTIONS = 3;
const MAX_SELECTIONS = 5;


// ---------------------------------------------------------------------------
// NichePill component
// ---------------------------------------------------------------------------

interface NichePillProps {
  label: string;
  emoji: string;
  isSelected: boolean;
  isDisabled: boolean; // true when max reached and this pill is unselected
  onPress: () => void;
  fontsLoaded: boolean;
}

function NichePill({
  label,
  emoji,
  isSelected,
  isDisabled,
  onPress,
  fontsLoaded,
}: NichePillProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  // Sync glow animation when selection state changes
  React.useEffect(() => {
    Animated.spring(glowOpacity, {
      toValue: isSelected ? 1 : 0,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.93,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 8,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.pillWrapper,
        { transform: [{ scale }], opacity: isDisabled ? 0.38 : 1 },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[
          styles.pill,
          isSelected && styles.pillSelected,
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected, disabled: isDisabled }}
        accessibilityLabel={`${label} niche, ${isSelected ? 'selected' : 'not selected'}`}
      >
        <Text style={styles.pillEmoji}>{emoji}</Text>
        <Text
          style={[
            styles.pillLabel,
            fontsLoaded && { fontFamily: 'PlusJakartaSans_500Medium' },
            isSelected && styles.pillLabelSelected,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function NicheSelectionScreen() {
  const { saveNiches, isLoading } = useAuth();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Animated value for the counter badge scale pop
  const counterScale = useRef(new Animated.Value(1)).current;
  // Animated value for the CTA button
  const ctaScale = useRef(new Animated.Value(1)).current;

  const [fontsLoaded] = useFonts({
    Sora_800ExtraBold,
    PlusJakartaSans_500Medium,
    SpaceGrotesk_700Bold,
  });

  // ── Toggle niche selection ──────────────────────────────────────────────
  const toggleNiche = useCallback((label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        if (next.size >= MAX_SELECTIONS) return prev; // hard cap
        next.add(label);
      }

      // Pop the counter badge
      Animated.sequence([
        Animated.spring(counterScale, {
          toValue: 1.25,
          useNativeDriver: true,
          tension: 400,
          friction: 8,
        }),
        Animated.spring(counterScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 8,
        }),
      ]).start();

      return next;
    });
  }, [counterScale]);

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (selected.size < MIN_SELECTIONS || isLoading) return;
    await saveNiches(Array.from(selected));
    // Routing gate in _layout.tsx will automatically navigate to /(tabs)/chats
    // once the Zustand store updates with the new niches field.
  }, [selected, isLoading, saveNiches]);

  const handleCtaPressIn = () => {
    if (selected.size < MIN_SELECTIONS) return;
    Animated.spring(ctaScale, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handleCtaPressOut = () => {
    Animated.spring(ctaScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 8,
    }).start();
  };

  const selectedCount = selected.size;
  const atMax = selectedCount >= MAX_SELECTIONS;
  const canSubmit = selectedCount >= MIN_SELECTIONS;

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Background blobs ─────────────────────────────────────────────── */}
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Logo pill */}
        <View style={styles.logoPill}>
          <Text style={styles.logoPillText}>🍵 spill</Text>
        </View>

        {/* Headline */}
        <Text
          style={[
            styles.headline,
            fontsLoaded && { fontFamily: 'Sora_800ExtraBold' },
          ]}
        >
          What's your tea?
        </Text>

        {/* Subtext */}
        <Text
          style={[
            styles.subtext,
            fontsLoaded && { fontFamily: 'PlusJakartaSans_500Medium' },
          ]}
        >
          Pick topics that describe your vibe
        </Text>

        {/* Animated selection counter */}
        <Animated.View
          style={[
            styles.counterPill,
            canSubmit && styles.counterPillActive,
            { transform: [{ scale: counterScale }] },
          ]}
        >
          <Text
            style={[
              styles.counterText,
              fontsLoaded && { fontFamily: 'SpaceGrotesk_700Bold' },
              canSubmit && styles.counterTextActive,
            ]}
          >
            {selectedCount === 0
              ? 'SELECT AT LEAST 3'
              : atMax
              ? `✦ ${selectedCount} / ${MAX_SELECTIONS}  ·  MAX REACHED`
              : `✦ ${selectedCount} / ${MAX_SELECTIONS} SELECTED`}
          </Text>
        </Animated.View>
      </View>

      {/* ── Niche grid ───────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {NICHES.map((niche) => {
          const isSelected = selected.has(niche.label);
          const isDisabled = atMax && !isSelected;
          return (
            <NichePill
              key={niche.label}
              label={niche.label}
              emoji={niche.emoji}
              isSelected={isSelected}
              isDisabled={isDisabled}
              onPress={() => toggleNiche(niche.label)}
              fontsLoaded={fontsLoaded ?? false}
            />
          );
        })}
      </ScrollView>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        {/* Rule hint */}
        <Text
          style={[
            styles.ruleHint,
            fontsLoaded && { fontFamily: 'SpaceGrotesk_700Bold' },
          ]}
        >
          {MIN_SELECTIONS} MINIMUM · {MAX_SELECTIONS} MAXIMUM
        </Text>

        {/* CTA button */}
        <Animated.View style={{ transform: [{ scale: ctaScale }], width: '100%' }}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.ctaButton, !canSubmit && styles.ctaButtonDisabled]}
            onPress={handleSubmit}
            onPressIn={handleCtaPressIn}
            onPressOut={handleCtaPressOut}
            disabled={!canSubmit || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Let's Spill — confirm niche selection"
            accessibilityState={{ disabled: !canSubmit }}
          >
            {isLoading ? (
              <ActivityIndicator color="#00390d" size="small" />
            ) : (
              <Text
                style={[
                  styles.ctaText,
                  fontsLoaded && { fontFamily: 'Sora_800ExtraBold' },
                  !canSubmit && styles.ctaTextDisabled,
                ]}
              >
                Let's Spill! →
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f150e',
  },

  // ── Background decorations ──────────────────────────────────────────────
  blobTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(150, 249, 150, 0.055)',
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: 80,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 181, 156, 0.04)',
  },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  logoPill: {
    backgroundColor: 'rgba(150, 249, 150, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(150, 249, 150, 0.25)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
  },
  logoPillText: {
    fontSize: 13,
    color: '#96f996',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: '#dfe4d9',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtext: {
    fontSize: 15,
    fontWeight: '500',
    color: '#899485',
    textAlign: 'center',
    marginBottom: 18,
  },

  // ── Counter pill ───────────────────────────────────────────────────────
  counterPill: {
    backgroundColor: 'rgba(49, 54, 47, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(137, 148, 133, 0.25)',
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  counterPillActive: {
    backgroundColor: 'rgba(150, 249, 150, 0.12)',
    borderColor: 'rgba(150, 249, 150, 0.4)',
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#899485',
    letterSpacing: 1.2,
  },
  counterTextActive: {
    color: '#96f996',
  },

  // ── Grid ───────────────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: PILL_GAP,
  },

  // ── Niche pill ─────────────────────────────────────────────────────────
  pillWrapper: {
    width: PILL_WIDTH,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(27, 33, 26, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(137, 148, 133, 0.2)',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pillSelected: {
    backgroundColor: 'rgba(150, 249, 150, 0.13)',
    borderColor: '#96f996',
    // Glow effect via shadow
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  pillEmoji: {
    fontSize: 18,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#becab9',
    flexShrink: 1,
  },
  pillLabelSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // ── Footer ─────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    paddingTop: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(137, 148, 133, 0.1)',
    gap: 14,
  },
  ruleHint: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(137, 148, 133, 0.6)',
    letterSpacing: 1.4,
  },
  ctaButton: {
    backgroundColor: '#96f996',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaButtonDisabled: {
    backgroundColor: 'rgba(49, 54, 47, 0.8)',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#00390d',
    letterSpacing: 0.3,
  },
  ctaTextDisabled: {
    color: '#899485',
  },
});
