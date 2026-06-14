/**
 * (tabs)/profile.tsx
 * -------------------
 * Upgraded User Profile Screen matching the Stitch and Tea Brand guidelines.
 * Features:
 *   - Custom "Squish" spring button tactile animations on press (scale 0.95)
 *   - Glassmorphic card layouts matching deep charcoal background (#0f150e)
 *   - Circular Avatar with edit overlay connecting to Supabase Storage via base64 raw binary uploads
 *   - Premium Sora, Plus Jakarta Sans, and Space Grotesk dynamic typography
 *   - Inline edit mode for Display Name inside a glowing recessed capsule
 *   - Live local MMKV analytics (Tea Spilled / sent messages & Inner Circle size)
 *   - Safe chat cache cleaner & premium custom switches
 *   - Gorgeous peach-accented bounciness and physical light-emission glow shadows
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useFonts,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { getAllChatIds, getMessages, clearLocalMessages } from '@/services/chatStorage';

const { width } = Dimensions.get('window');

import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors, ThemeMode } from '@/types/theme';

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
  const { colors: C, themeMode, setThemeMode, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const insets = useSafeAreaInsets();
  const { signOut, user, updateProfile, updateProfilePhoto, isLoading: authLoading } = useAuth();

  // Load signature typography via bundled @expo-google-fonts packages (TTF, works on native)
  const [fontsLoaded, fontError] = useFonts({
    Sora_700Bold,
    Sora_800ExtraBold,
    PlusJakartaSans_500Medium,
    SpaceGrotesk_700Bold,
  });

  React.useEffect(() => {
    if (fontError) {
      console.warn('[profile] Custom fonts failed to load, falling back to system fonts:', fontError);
    }
  }, [fontError]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(user?.displayName ?? '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

  // Live MMKV stats
  const [stats, setStats] = useState({ teaSpilled: 0, circleSize: 0 });

  useFocusEffect(
    useCallback(() => {
      const chatIds = getAllChatIds();
      let sentCount = 0;
      chatIds.forEach((id) => {
        sentCount += getMessages(id).filter((m) => m.isMine).length;
      });
      setStats({
        teaSpilled: sentCount,
        circleSize: chatIds.length,
      });
      if (user?.displayName) {
        setTempDisplayName(user.displayName);
      }
    }, [user])
  );

  // 1. Pick Image & Convert to Base64 (Binary upload fix for Expo 56)
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need gallery access to upload a new profile photo!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', // Modern SDK 56 options to avoid deprecation warnings
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true, // Request base64 representation
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64Data = result.assets[0].base64;
      if (base64Data) {
        setIsUploadingPhoto(true);
        try {
          const downloadURL = await updateProfilePhoto(base64Data);
          if (downloadURL) {
            Alert.alert('Success 🎉', 'Profile picture updated successfully!');
          } else {
            Alert.alert('Error ⚠️', 'Failed to upload photo to storage.');
          }
        } catch (err) {
          console.error('[profile] Error uploading photo:', err);
          Alert.alert('Error ⚠️', 'An error occurred during upload.');
        } finally {
          setIsUploadingPhoto(false);
        }
      } else {
        Alert.alert('Error ⚠️', 'Could not read image data.');
      }
    }
  };

  // 2. Save Display Name to Firestore
  const handleSaveName = async () => {
    const nameToSave = tempDisplayName.trim();
    if (!nameToSave) {
      Alert.alert('Invalid Name', 'Display name cannot be empty.');
      return;
    }
    setIsEditingName(false);
    try {
      await updateProfile({ displayName: nameToSave });
    } catch (err) {
      Alert.alert('Error', 'Failed to save display name.');
    }
  };

  // 3. Clear local MMKV messages cache
  const handleClearCache = () => {
    Alert.alert(
      'Clear Chat Cache?',
      'This will delete all locally cached message logs from your device to free up storage. All cloud messages in Firestore remain completely safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: () => {
            const chatIds = getAllChatIds();
            chatIds.forEach((id) => {
              clearLocalMessages(id);
            });
            setStats((prev) => ({ ...prev, teaSpilled: 0 }));
            Alert.alert('Cleaned ✨', 'All local message caches have been cleared.');
          },
        },
      ]
    );
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();
  const formatJoinedDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };


  const getThemeIcon = () => {
    if (themeMode === 'light') return 'wb-sunny';
    if (themeMode === 'dark') return 'nights-stay';
    return 'settings';
  };

  const toggleTheme = () => {
    if (themeMode === 'system') {
      setThemeMode('light');
    } else if (themeMode === 'light') {
      setThemeMode('dark');
    } else {
      setThemeMode('system');
    }
  };

  const isWorking = authLoading || isUploadingPhoto;

  return (
    <View style={styles.container}>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerBrand}>My Profile</Text>
          <TouchableOpacity style={styles.themeToggleBtn} onPress={toggleTheme} activeOpacity={0.7}>
            <MaterialIcons name={getThemeIcon()} size={20} color={C.onSurface} />
          </TouchableOpacity>
        </View>

        {/* ── Glassmorphic Profile Card ───────────────────── */}
        <View style={styles.profileCard}>
          {/* Avatar Container with Squish spring Pressable */}
          <SquishButton
            onPress={handlePickImage}
            disabled={isWorking}
            style={styles.avatarWrapper}
          >
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {getInitial(user?.displayName ?? 'U')}
                </Text>
              </View>
            )}
            
            {/* Edit overlay */}
            <View style={styles.avatarEditOverlay}>
              {isWorking ? (
                <ActivityIndicator size="small" color={C.onPrimaryFixed} />
              ) : (
                <MaterialIcons name="camera-alt" size={14} color={C.onPrimaryFixed} />
              )}
            </View>
          </SquishButton>

          {/* User Details */}
          <View style={styles.detailsGroup}>
            {isEditingName ? (
              <View style={styles.inlineEditRow}>
                <TextInput
                  style={styles.inlineNameInput}
                  value={tempDisplayName}
                  onChangeText={setTempDisplayName}
                  autoFocus
                  maxLength={25}
                  placeholder="Enter name..."
                  placeholderTextColor="rgba(190,202,185,0.4)"
                />
                <TouchableOpacity style={styles.inlineActionBtn} onPress={handleSaveName}>
                  <MaterialIcons name="done" size={20} color={C.primaryFixed} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineActionBtn} onPress={() => {
                  setTempDisplayName(user?.displayName ?? '');
                  setIsEditingName(false);
                }}>
                  <MaterialIcons name="close" size={20} color={C.errorColor} />
                </TouchableOpacity>
              </View>
            ) : (
              <SquishButton
                style={styles.nameDisplayRow}
                onPress={() => setIsEditingName(true)}
              >
                <Text style={styles.displayName} numberOfLines={1} ellipsizeMode="tail">
                  {user?.displayName || 'Tea Friend'}
                </Text>
                <MaterialIcons name="edit" size={16} color={C.onSurfaceVariant} style={styles.editIcon} />
              </SquishButton>
            )}

            <Text style={styles.emailText}>{user?.email}</Text>
          </View>
        </View>

        {/* ── Spill Statistics ───────────────────────────── */}
        <Text style={styles.sectionLabel}>ACTIVITY STATS</Text>
        <View style={styles.statsCard}>
          {/* Stat 1 */}
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.teaSpilled}</Text>
            <Text style={styles.statLabel}>TEA SPILLED</Text>
          </View>

          <View style={styles.statDivider} />

          {/* Stat 2 */}
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.circleSize}</Text>
            <Text style={styles.statLabel}>INNER CIRCLE</Text>
          </View>

          <View style={styles.statDivider} />

          {/* Stat 3 */}
          <View style={styles.statBox}>
            <Text style={styles.statNumDate}>{formatJoinedDate(user?.createdAt)}</Text>
            <Text style={styles.statLabel}>JOINED DATE</Text>
          </View>
        </View>

        {/* ── Settings Menu ──────────────────────────────── */}
        <Text style={styles.sectionLabel}>OPTIONS & MAINTENANCE</Text>
        <View style={styles.optionsList}>
          {/* Notifications Toggle */}
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIconBg, styles.matchaTint]}>
                <MaterialIcons name="notifications" size={20} color={C.primaryFixedDim} />
              </View>
              <Text style={styles.optionLabel}>Push Notifications</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={setNotifEnabled}
              thumbColor={notifEnabled ? C.primaryFixed : C.onSurfaceVariant}
              trackColor={{ false: C.surfaceContainerHigh, true: 'rgba(150,249,150,0.35)' }}
            />
          </View>

          <View style={styles.optionsRowDivider} />

          {/* Clear Cache */}
          <SquishButton onPress={handleClearCache}>
            <View style={styles.optionRow}>
              <View style={styles.optionInfo}>
                <View style={[styles.optionIconBg, styles.peachTint]}>
                  <MaterialIcons name="delete-outline" size={20} color={C.secondary} />
                </View>
                <Text style={styles.optionLabel}>Clear Message Cache</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.onSurfaceVariant} />
            </View>
          </SquishButton>

          <View style={styles.optionsRowDivider} />

          {/* Storage Info */}
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIconBg, styles.matchaTint]}>
                <MaterialIcons name="info-outline" size={20} color={C.primaryFixedDim} />
              </View>
              <Text style={styles.optionLabel}>Spill Version</Text>
            </View>
            <Text style={styles.versionText}>1.0.0 (Supabase)</Text>
          </View>
        </View>

        {/* ── Log Out Button ──────────────────────────────── */}
        <View style={styles.logoutContainer}>
          <SquishButton
            onPress={signOut}
            disabled={isWorking}
            style={styles.logoutBtn}
          >
            {isWorking ? (
              <ActivityIndicator color={C.errorColor} />
            ) : (
              <Text style={styles.logoutText}>Log Out</Text>
            )}
          </SquishButton>
        </View>

        <Text style={styles.tagline}>PRIVATE  •  SECURE  •  AESTHETIC</Text>

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
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },

    /* Header */
    header: {
      marginTop: 10,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerBrand: {
      fontSize: 24,
      fontFamily: 'Sora_800ExtraBold',
      color: C.onSurface,
      letterSpacing: -0.5,
    },
    themeToggleBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.cardBorder,
      shadowColor: C.primaryFixed,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },

    /* Profile Card */
    profileCard: {
      width: '100%',
      backgroundColor: C.cardBg, // Glassmorphic surface dim
      borderRadius: 32,
      borderWidth: 1,
      borderColor: C.cardBorder, // Matcha high-contrast subtle border
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
      position: 'relative',
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      borderColor: C.primaryFixed,
      shadowColor: C.primaryFixed, // Physical light emission Matcha glow!
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
      fontFamily: 'Sora_700Bold',
      color: C.primaryFixed,
    },
    avatarEditOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.primaryFixed,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: C.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    detailsGroup: {
      alignItems: 'center',
      gap: 6,
    },
    nameDisplayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      maxWidth: '90%',
      alignSelf: 'center',
    },
    displayName: {
      fontSize: 24,
      fontFamily: 'Sora_700Bold',
      color: C.onSurface,
      letterSpacing: -0.5,
      flexShrink: 1,
    },
    editIcon: {
      opacity: 0.7,
    },
    emailText: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_500Medium',
      color: C.onSurfaceVariant,
      opacity: 0.8,
    },

    /* Inline Editing */
    inlineEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceContainerHigh, // Deep Recessed Recess Capsule
      borderWidth: 1.5,
      borderColor: C.primaryFixed, // Primary Matcha Glow border on focus
      borderRadius: 9999, // Pill recessed capsule
      paddingLeft: 18,
      paddingRight: 8,
      height: 48,
      width: width - 80,
      gap: 8,
      shadowColor: C.primaryFixed,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    inlineNameInput: {
      flex: 1,
      fontSize: 16,
      fontFamily: 'PlusJakartaSans_500Medium',
      color: C.onSurface,
      padding: 0,
    },
    inlineActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* Section Labels */
    sectionLabel: {
      fontSize: 12,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: C.onSurfaceVariant,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginTop: 28,
      marginBottom: 10,
      marginLeft: 6,
    },

    /* Statistics */
    statsCard: {
      width: '100%',
      backgroundColor: C.cardBg,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.cardBorder,
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 20,
      alignItems: 'center',
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    statNum: {
      fontSize: 22,
      fontFamily: 'Sora_700Bold',
      color: C.primaryFixed,
      letterSpacing: -0.5,
    },
    statNumDate: {
      fontSize: 16,
      fontFamily: 'Sora_700Bold',
      color: C.primaryFixed,
      letterSpacing: -0.2,
      paddingVertical: 3,
    },
    statLabel: {
      fontSize: 9,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: C.onSurfaceVariant,
      letterSpacing: 1,
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: 'rgba(137,148,133,0.18)',
    },

    /* Settings Options */
    optionsList: {
      width: '100%',
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
    peachTint: {
      backgroundColor: 'rgba(255,181,156,0.08)',
    },
    optionLabel: {
      fontSize: 15,
      fontFamily: 'PlusJakartaSans_500Medium',
      color: C.onSurface,
    },
    versionText: {
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_500Medium',
      color: C.onSurfaceVariant,
      opacity: 0.7,
    },
    optionsRowDivider: {
      height: 1,
      backgroundColor: 'rgba(137,148,133,0.1)',
      marginHorizontal: 16,
    },

    /* Log Out Container */
    logoutContainer: {
      marginTop: 36,
    },
    logoutBtn: {
      width: '100%',
      backgroundColor: C.errorBg,
      borderWidth: 1.5,
      borderColor: C.errorBorder,
      paddingVertical: 17,
      borderRadius: 9999, // Pill/Capsule shape
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: C.errorColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    logoutText: {
      color: C.errorText,
      fontFamily: 'Sora_700Bold',
      fontSize: 16,
      letterSpacing: 0.2,
    },

    /* Tagline */
    tagline: {
      marginTop: 28,
      color: C.onSurfaceVariant,
      fontSize: 9,
      fontFamily: 'SpaceGrotesk_700Bold',
      letterSpacing: 3,
      opacity: 0.35,
      textAlign: 'center',
    },
  });
}
