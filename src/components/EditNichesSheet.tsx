/**
 * components/EditNichesSheet.tsx
 * --------------------------------
 * Reusable bottom-sheet modal for selecting or changing interest niches.
 * Used from the Explore tab's floating edit button.
 *
 * Props:
 *   visible       — controls modal visibility
 *   currentNiches — array of already-selected niche labels to pre-fill
 *   onClose       — called when the sheet is dismissed without saving
 *   onSave        — called with the new niche array when user taps Save
 *   isSaving      — true while saveNiches() is in flight (shows spinner)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NICHES } from '@/constants/niches';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PILL_GAP = 10;
const PILL_WIDTH = (SCREEN_WIDTH - 40 - PILL_GAP) / 2;
const MIN_SELECTIONS = 3;
const MAX_SELECTIONS = 5;



// ---------------------------------------------------------------------------
// NichePill (local to this sheet)
// ---------------------------------------------------------------------------

interface PillProps {
  label: string;
  emoji: string;
  isSelected: boolean;
  isDisabled: boolean;
  onPress: () => void;
}

function NichePill({ label, emoji, isSelected, isDisabled, onPress }: PillProps) {
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }).start();

  return (
    <Animated.View style={[{ width: PILL_WIDTH, transform: [{ scale }], opacity: isDisabled ? 0.38 : 1 }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={[styles.pill, isSelected && styles.pillSelected]}
      >
        <Text style={styles.pillEmoji}>{emoji}</Text>
        <Text style={[styles.pillLabel, isSelected && styles.pillLabelSelected]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// EditNichesSheet
// ---------------------------------------------------------------------------

interface EditNichesSheetProps {
  visible: boolean;
  currentNiches: string[];
  onClose: () => void;
  onSave: (niches: string[]) => void;
  isSaving: boolean;
}

export default function EditNichesSheet({
  visible,
  currentNiches,
  onClose,
  onSave,
  isSaving,
}: EditNichesSheetProps) {
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentNiches));

  // Re-sync when sheet opens with fresh currentNiches
  useEffect(() => {
    if (visible) setSelected(new Set(currentNiches));
  }, [visible, currentNiches]);

  const toggleNiche = useCallback((label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        if (next.size >= MAX_SELECTIONS) return prev;
        next.add(label);
      }
      return next;
    });
  }, []);

  const selectedCount = selected.size;
  const atMax = selectedCount >= MAX_SELECTIONS;
  const canSave = selectedCount >= MIN_SELECTIONS;
  const hasChanges =
    selectedCount !== currentNiches.length ||
    Array.from(selected).some((n) => !currentNiches.includes(n));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Scrim */}
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Edit Your Niches</Text>
            <Text style={styles.sheetSub}>
              {selectedCount === 0
                ? 'Select at least 3'
                : atMax
                ? `✦ ${selectedCount} / ${MAX_SELECTIONS}  ·  Max reached`
                : `✦ ${selectedCount} / ${MAX_SELECTIONS} selected`}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <MaterialIcons name="close" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Pill grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
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
              />
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.sheetFooter}>
          <Text style={styles.ruleLabel}>
            {MIN_SELECTIONS} MINIMUM · {MAX_SELECTIONS} MAXIMUM
          </Text>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!canSave || !hasChanges) && styles.saveBtnDisabled,
            ]}
            onPress={() => canSave && hasChanges && onSave(Array.from(selected))}
            disabled={!canSave || !hasChanges || isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color={C.onPrimaryContainer} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, (!canSave || !hasChanges) && styles.saveBtnTextDisabled]}>
                Save Niches ✓
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function getStyles(C: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: '82%',
      backgroundColor: C.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      borderColor: C.cardBorder,
      paddingBottom: Platform.OS === 'android' ? 20 : 8,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.outlineVariant,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
      opacity: 0.5,
    },

    // Header
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.cardBorder,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: C.onSurface,
      letterSpacing: -0.3,
    },
    sheetSub: {
      fontSize: 12,
      fontWeight: '700',
      color: C.primaryDim,
      letterSpacing: 0.8,
      marginTop: 4,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
      gap: PILL_GAP,
    },

    // Pills
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.cardBg,
      borderWidth: 1.5,
      borderColor: C.cardBorder,
      borderRadius: 9999,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    pillSelected: {
      backgroundColor: isDark ? 'rgba(150,249,150,0.13)' : 'rgba(46,168,71,0.13)',
      borderColor: C.primary,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
    pillEmoji: { fontSize: 17 },
    pillLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: C.onSurfaceVariant,
      flexShrink: 1,
    },
    pillLabelSelected: { color: C.onSurface, fontWeight: '600' },

    // Footer
    sheetFooter: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: Platform.OS === 'android' ? 16 : 20,
      borderTopWidth: 1,
      borderTopColor: C.cardBorder,
      gap: 12,
      alignItems: 'center',
    },
    ruleLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: C.onSurfaceVariant,
      letterSpacing: 1.4,
      opacity: 0.7,
    },
    saveBtn: {
      backgroundColor: C.primaryContainer,
      borderRadius: 9999,
      paddingVertical: 15,
      alignItems: 'center',
      width: '100%',
      shadowColor: C.primaryContainer,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 6,
    },
    saveBtnDisabled: {
      backgroundColor: C.surfaceContainerHighest,
      shadowOpacity: 0,
      elevation: 0,
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: '800',
      color: C.onPrimaryContainer,
      letterSpacing: 0.3,
    },
    saveBtnTextDisabled: { color: C.onSurfaceVariant },
  });
}
