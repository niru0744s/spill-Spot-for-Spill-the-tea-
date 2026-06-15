/**
 * (tabs)/profile.tsx
 * -------------------
 * Upgraded User Profile Screen matching the Stitch and Tea Brand guidelines.
 * Displays a clean, view-only digital identity card, user bio, and navigation
 * entries for My Wallet, Transaction History, Call History, and Settings.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  useFonts,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useWallet } from '@/hooks/useWallet';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

const { width } = Dimensions.get('window');

/* ── Custom "Squish" Button ──────────────────────────────────── */
function SquishButton({
  onPress,
  children,
  style,
  disabled,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={style}
        disabled={disabled}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ── Profile Screen ─────────────────────────────────────────── */
export default function ProfileScreen() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_700Bold,
    Sora_800ExtraBold,
    PlusJakartaSans_500Medium,
    SpaceGrotesk_700Bold,
  });

  const { colors: C } = useTheme();
  const styles = useStyles(getStyles, fontsLoaded);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { formattedBalance, refreshBalance } = useWallet();

  React.useEffect(() => {
    if (fontError) {
      console.warn('[profile] Custom fonts failed to load, falling back to system fonts:', fontError);
    }
  }, [fontError]);

  useFocusEffect(
    useCallback(() => {
      refreshBalance().catch(() => {});
    }, [refreshBalance])
  );

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerBrand}>My Profile</Text>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings' as any)} activeOpacity={0.7}>
            <MaterialIcons name="settings" size={20} color={C.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {getInitial(user?.name ?? 'U')}
                </Text>
              </View>
            )}
          </View>

          {/* User Details */}
          <View style={styles.detailsGroup}>
            <Text style={styles.displayName} numberOfLines={1}>
              {user?.name || 'Tea Friend'}
            </Text>
            <Text style={styles.usernameText}>@{user?.displayName || 'username'}</Text>
            <Text style={styles.emailText}>{user?.email}</Text>

            {/* Bio Block */}
            <View style={styles.bioContainer}>
              <Text style={styles.bioText} numberOfLines={4}>
                {user?.bio || "No bio spilled yet... ☕"}
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation Options */}
        <Text style={styles.sectionLabel}>OPTIONS & UTILITIES</Text>
        <View style={styles.optionsList}>
          {/* My Wallet */}
          <SquishButton onPress={() => router.push('/wallet' as any)}>
            <View style={styles.optionRow}>
              <View style={styles.optionInfo}>
                <View style={[styles.optionIconBg, styles.matchaTint]}>
                  <MaterialIcons name="account-balance-wallet" size={20} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.optionLabel}>My Wallet</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.walletBalanceBadge}>{formattedBalance}</Text>
                <MaterialIcons name="chevron-right" size={20} color={C.onSurfaceVariant} />
              </View>
            </View>
          </SquishButton>

          <View style={styles.optionsRowDivider} />

          {/* All Transactions */}
          <SquishButton onPress={() => router.push('/transactions' as any)}>
            <View style={styles.optionRow}>
              <View style={styles.optionInfo}>
                <View style={[styles.optionIconBg, styles.matchaTint]}>
                  <MaterialIcons name="receipt-long" size={20} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.optionLabel}>Transaction History</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.onSurfaceVariant} />
            </View>
          </SquishButton>

          <View style={styles.optionsRowDivider} />

          {/* Call History */}
          <SquishButton onPress={() => router.push('/call-history' as any)}>
            <View style={styles.optionRow}>
              <View style={styles.optionInfo}>
                <View style={[styles.optionIconBg, styles.matchaTint]}>
                  <MaterialIcons name="history" size={20} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.optionLabel}>Call History</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.onSurfaceVariant} />
            </View>
          </SquishButton>

          <View style={styles.optionsRowDivider} />

          {/* Settings Page */}
          <SquishButton onPress={() => router.push('/settings' as any)}>
            <View style={styles.optionRow}>
              <View style={styles.optionInfo}>
                <View style={[styles.optionIconBg, styles.matchaTint]}>
                  <MaterialIcons name="settings" size={20} color={C.primaryFixedDim} />
                </View>
                <Text style={styles.optionLabel}>Settings & Privacy</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.onSurfaceVariant} />
            </View>
          </SquishButton>
        </View>

        <Text style={styles.tagline}>PRIVATE  •  SECURE  •  AESTHETIC</Text>
      </ScrollView>
    </View>
  );
}

function getStyles(C: ThemeColors, isDark: boolean, fontsLoaded: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    header: {
      marginTop: 10,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      maxWidth: 500,
      width: '100%',
      alignSelf: 'center',
    },
    headerBrand: {
      fontSize: 24,
      fontFamily: fontsLoaded ? 'Sora_800ExtraBold' : undefined,
      color: C.onSurface,
      letterSpacing: -0.5,
    },
    settingsBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.cardBorder,
    },
    profileCard: {
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
      backgroundColor: C.cardBg,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: C.cardBorder,
      paddingVertical: 32,
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 20,
      shadowColor: C.primaryFixed,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.1,
      shadowRadius: 28,
      elevation: 6,
    },
    avatarWrapper: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      borderColor: C.primaryFixed,
      shadowColor: C.primaryFixed,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
    avatarImg: {
      width: 114,
      height: 114,
      borderRadius: 57,
    },
    avatarFallback: {
      width: 114,
      height: 114,
      borderRadius: 57,
      backgroundColor: 'rgba(150,249,150,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 48,
      fontFamily: fontsLoaded ? 'Sora_700Bold' : undefined,
      color: C.primaryFixed,
    },
    detailsGroup: {
      alignItems: 'center',
      gap: 6,
      width: '100%',
    },
    displayName: {
      fontSize: 24,
      fontFamily: fontsLoaded ? 'Sora_700Bold' : undefined,
      color: C.onSurface,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    usernameText: {
      fontSize: 14,
      fontFamily: fontsLoaded ? 'SpaceGrotesk_700Bold' : undefined,
      color: C.primaryFixedDim,
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    emailText: {
      fontSize: 13,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
      opacity: 0.75,
      textAlign: 'center',
    },
    bioContainer: {
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: 'rgba(150,249,150,0.04)',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(137,148,133,0.1)',
      width: '100%',
    },
    bioText: {
      fontSize: 13,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
      lineHeight: 18,
      textAlign: 'center',
      fontStyle: 'italic',
      opacity: 0.85,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: fontsLoaded ? 'SpaceGrotesk_700Bold' : undefined,
      color: C.onSurfaceVariant,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginTop: 28,
      marginBottom: 10,
      marginLeft: 6,
      maxWidth: 500,
      width: '100%',
      alignSelf: 'center',
    },
    optionsList: {
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
      backgroundColor: C.cardBg,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.cardBorder,
      paddingVertical: 8,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      width: '100%',
    },
    optionInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    optionIconBg: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matchaTint: {
      backgroundColor: 'rgba(150,249,150,0.08)',
    },
    optionLabel: {
      fontSize: 15,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurface,
    },
    walletBalanceBadge: {
      fontSize: 13,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.primaryFixedDim,
      marginRight: 6,
    },
    optionsRowDivider: {
      height: 1,
      backgroundColor: 'rgba(137,148,133,0.1)',
      marginHorizontal: 16,
    },

    /* Tagline */
    tagline: {
      marginTop: 28,
      color: C.onSurfaceVariant,
      fontSize: 9,
      fontFamily: fontsLoaded ? 'SpaceGrotesk_700Bold' : undefined,
      letterSpacing: 3,
      opacity: 0.35,
      textAlign: 'center',
      maxWidth: 500,
      width: '100%',
      alignSelf: 'center',
    },
  });
}
