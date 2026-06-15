/**
 * app/settings.tsx
 * ----------------
 * Premium Settings Screen matching the Stitch and Tea Brand guidelines.
 * Features:
 *   - Custom "Squish" spring button tactile animations on press (scale 0.95)
 *   - Glassmorphic card layouts matching deep charcoal background (#0f150e)
 *   - Circular Avatar editor with camera overlay connecting to Supabase Storage via base64 raw binary uploads
 *   - Profile Editor: Username (displayName), Full Name (name), Bio (bio) text inputs
 *   - Username validation and unique check in Firestore collection
 *   - Segmented control pills for Theme Mode (Light / Dark / System)
 *   - Switch toggle for Push Notifications persisted in local MMKV storage
 *   - Cache clearing, Log Out, and sensitive Delete Account confirmation flows
 *   - Premium Sora, Plus Jakarta Sans, and Space Grotesk dynamic typography
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useFonts,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import { PlusJakartaSans_500Medium, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { getAllChatIds, clearLocalMessages } from '@/services/chatStorage';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';
import { storage } from '@/services/mmkv';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';

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

/* ── Settings Screen ────────────────────────────────────────── */
export default function SettingsScreen() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_700Bold,
    Sora_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    SpaceGrotesk_700Bold,
  });

  const { colors: C, themeMode, setThemeMode } = useTheme();
  const styles = useStyles(getStyles, fontsLoaded);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, user, updateProfile, updateProfilePhoto, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (fontError) {
      console.warn('[settings] Custom fonts failed to load, falling back to system fonts:', fontError);
    }
  }, [fontError]);

  // Form states
  const [username, setUsername] = useState(user?.displayName ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => storage.getBoolean('settings_notifications') !== false);

  // Focus tracking for inputs (for premium green glow borders)
  const [focusedInput, setFocusedInput] = useState<'username' | 'name' | 'bio' | null>(null);

  // Sync state if user loads later
  useEffect(() => {
    if (user) {
      setUsername(user.displayName);
      setName(user.name);
      setBio(user.bio ?? '');
    }
  }, [user]);

  // 1. Pick Image & Upload
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need gallery access to upload a new profile photo!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
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
          console.error('[settings] Error uploading photo:', err);
          Alert.alert('Error ⚠️', 'An error occurred during upload.');
        } finally {
          setIsUploadingPhoto(false);
        }
      } else {
        Alert.alert('Error ⚠️', 'Could not read image data.');
      }
    }
  };

  // 2. Validation & Save Profile details
  const handleSaveProfile = async () => {
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedBio = bio.trim();

    if (!trimmedUsername) {
      Alert.alert('Required Field', 'Username cannot be empty.');
      return;
    }
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      Alert.alert('Invalid Username', 'Username must be between 3 and 20 characters.');
      return;
    }
    // Username check: alphanumeric only (and underscore)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      Alert.alert('Invalid Username', 'Username can only contain letters, numbers, and underscores.');
      return;
    }

    if (!trimmedName) {
      Alert.alert('Required Field', 'Full name cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    try {
      // Check if username (displayName) is already taken
      if (trimmedUsername !== user?.displayName?.toLowerCase()) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('displayName', '==', trimmedUsername));
        const snap = await getDocs(q);
        const taken = snap.docs.some(doc => doc.id !== user?.uid);
        if (taken) {
          Alert.alert('Username Taken ☕', 'This username is already claimed by someone else. Try a different vibe!');
          setIsSavingProfile(false);
          return;
        }
      }

      // Perform update profile
      await updateProfile({
        displayName: trimmedUsername,
        name: trimmedName,
        bio: trimmedBio,
      });

      Alert.alert('Saved ✨', 'Your profile details have been spilled successfully.');
    } catch (err) {
      console.error('[settings] Error saving profile:', err);
      Alert.alert('Save Failed ⚠️', 'Could not save profile details. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 3. Clear Cache
  const handleClearCache = () => {
    Alert.alert(
      'Clear Message Cache?',
      'This will delete all locally cached message logs from your device to free up storage. All cloud messages in Firestore remain completely safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: () => {
            try {
              const chatIds = getAllChatIds();
              chatIds.forEach((id) => {
                clearLocalMessages(id);
              });
              Alert.alert('Cleaned ✨', 'All local message caches have been cleared.');
            } catch (err) {
              Alert.alert('Error', 'Failed to clear local message caches.');
            }
          },
        },
      ]
    );
  };

  // 4. Toggle Notifications
  const handleToggleNotifications = (val: boolean) => {
    setNotifEnabled(val);
    storage.set('settings_notifications', val);
  };

  // 5. Delete Account Flow
  const handleDeleteAccount = () => {
    Alert.alert(
      'Spill the Tea: Delete Account? ⚠️',
      'This action is permanent and cannot be undone. All your messages, profile metadata, and files will be wiped forever.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;
            try {
              setIsSavingProfile(true);
              // 1. Delete Firestore user document
              await deleteDoc(doc(db, 'users', currentUser.uid));
              // 2. Delete Auth User account
              await currentUser.delete();
              // 3. Redirect / Sign Out resets the store
              Alert.alert('Account Deleted', 'Your account has been deleted successfully. Goodbye!');
            } catch (err: any) {
              console.error('[settings] Delete account error:', err);
              if (err.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Sensitive Operation',
                  'This action requires a recent sign-in session. Please sign out, log back in, and try deleting your account again.'
                );
              } else {
                Alert.alert('Delete Failed ⚠️', 'Could not delete your account. Please try again.');
              }
            } finally {
              setIsSavingProfile(false);
            }
          },
        },
      ]
    );
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();
  const isWorking = authLoading || isUploadingPhoto || isSavingProfile;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
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
                  {getInitial(user?.name ?? 'U')}
                </Text>
              </View>
            )}
            
            <View style={styles.avatarEditOverlay}>
              {isWorking ? (
                <ActivityIndicator size="small" color={C.onPrimaryFixed} />
              ) : (
                <MaterialIcons name="camera-alt" size={14} color={C.onPrimaryFixed} />
              )}
            </View>
          </SquishButton>
          <Text style={styles.photoLabel}>Change Profile Photo</Text>
        </View>

        <Text style={styles.sectionLabel}>PROFILE DETAILS</Text>
        <View style={styles.formCard}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={[
              styles.inputCapsule,
              focusedInput === 'name' && styles.inputCapsuleFocused
            ]}>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Spill your name..."
                placeholderTextColor="rgba(190,202,185,0.4)"
                onFocus={() => setFocusedInput('name')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username (@)</Text>
            <View style={[
              styles.inputCapsule,
              focusedInput === 'username' && styles.inputCapsuleFocused
            ]}>
              <Text style={styles.prefixAt}>@</Text>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor="rgba(190,202,185,0.4)"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.bioLabelRow}>
              <Text style={styles.inputLabel}>Bio</Text>
              <Text style={styles.charCounter}>{bio.length}/150</Text>
            </View>
            <View style={[
              styles.inputCapsule,
              styles.bioCapsule,
              focusedInput === 'bio' && styles.inputCapsuleFocused
            ]}>
              <TextInput
                style={[styles.textInput, styles.bioInput]}
                value={bio}
                onChangeText={(text) => {
                  if (text.length <= 150) setBio(text);
                }}
                placeholder="Tell the world your vibe... ☕"
                placeholderTextColor="rgba(190,202,185,0.4)"
                multiline
                numberOfLines={3}
                onFocus={() => setFocusedInput('bio')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <SquishButton
            onPress={handleSaveProfile}
            disabled={isWorking}
            style={styles.saveBtn}
          >
            {isWorking ? (
              <ActivityIndicator color={C.onPrimaryFixed} />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile Details</Text>
            )}
          </SquishButton>
        </View>

        <Text style={styles.sectionLabel}>APP PREFERENCES</Text>
        <View style={styles.optionsList}>
          <View style={styles.themeRow}>
            <View style={styles.themeInfo}>
              <View style={[styles.optionIconBg, styles.matchaTint]}>
                <MaterialIcons name="nights-stay" size={20} color={C.primaryFixedDim} />
              </View>
              <View>
                <Text style={styles.optionLabel}>App Theme</Text>
                <Text style={styles.optionSubLabel}>Select your visual vibe</Text>
              </View>
            </View>
            <View style={styles.segmentedContainer}>
              {(['light', 'dark', 'system'] as const).map((mode) => {
                const active = themeMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.segmentPill,
                      active && styles.segmentPillActive
                    ]}
                    onPress={() => setThemeMode(mode)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.segmentText,
                      active && styles.segmentTextActive
                    ]}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.optionsRowDivider} />

          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIconBg, styles.matchaTint]}>
                <MaterialIcons name="notifications" size={20} color={C.primaryFixedDim} />
              </View>
              <View>
                <Text style={styles.optionLabel}>Push Notifications</Text>
                <Text style={styles.optionSubLabel}>Instant alerts on new tea</Text>
              </View>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={handleToggleNotifications}
              thumbColor={notifEnabled ? C.primaryFixed : C.onSurfaceVariant}
              trackColor={{ false: C.surfaceContainerHigh, true: 'rgba(150,249,150,0.35)' }}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>STORAGE & MAINTENANCE</Text>
        <View style={styles.optionsList}>
          <TouchableOpacity onPress={handleClearCache} activeOpacity={0.7}>
            <View style={styles.optionRow}>
              <View style={styles.optionInfo}>
                <View style={[styles.optionIconBg, styles.peachTint]}>
                  <MaterialIcons name="delete-outline" size={20} color={C.secondary} />
                </View>
                <View>
                  <Text style={styles.optionLabel}>Clear Message Cache</Text>
                  <Text style={styles.optionSubLabel}>Free up local device space</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.dangerLabel}>DANGER ZONE</Text>
        <View style={styles.dangerZoneContainer}>
          <SquishButton
            onPress={signOut}
            disabled={isWorking}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Log Out Session</Text>
          </SquishButton>

          <SquishButton
            onPress={handleDeleteAccount}
            disabled={isWorking}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteText}>Delete Account Permanently</Text>
          </SquishButton>
        </View>

        <Text style={styles.tagline}>PRIVATE  •  SECURE  •  AESTHETIC</Text>
      </ScrollView>
    </View>
  );
}

/* ── StyleSheet ─────────────────────────────────────────────── */
function getStyles(C: ThemeColors, isDark: boolean, fontsLoaded: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: 60,
    },

    /* Header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: C.background,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(137,148,133,0.1)',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: fontsLoaded ? 'Sora_800ExtraBold' : undefined,
      color: C.onSurface,
      letterSpacing: -0.5,
    },

    /* Profile Section */
    profileSection: {
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 16,
      gap: 12,
    },
    avatarWrapper: {
      position: 'relative',
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 3,
      borderColor: C.primaryFixed,
      shadowColor: C.primaryFixed,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 6,
    },
    avatarImg: {
      width: 104,
      height: 104,
      borderRadius: 52,
    },
    avatarFallback: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: 'rgba(150,249,150,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 44,
      fontFamily: fontsLoaded ? 'Sora_700Bold' : undefined,
      color: C.primaryFixed,
    },
    avatarEditOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: C.primaryFixed,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: C.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    photoLabel: {
      fontSize: 13,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.primaryFixedDim,
    },

    /* Section Labels */
    sectionLabel: {
      fontSize: 11,
      fontFamily: fontsLoaded ? 'SpaceGrotesk_700Bold' : undefined,
      color: C.onSurfaceVariant,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginTop: 24,
      marginBottom: 10,
      marginLeft: 4,
      maxWidth: 500,
      width: '100%',
      alignSelf: 'center',
    },
    dangerLabel: {
      fontSize: 11,
      fontFamily: fontsLoaded ? 'SpaceGrotesk_700Bold' : undefined,
      color: C.errorColor,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginTop: 30,
      marginBottom: 10,
      marginLeft: 4,
      maxWidth: 500,
      width: '100%',
      alignSelf: 'center',
    },

    /* Form Card */
    formCard: {
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
      backgroundColor: C.cardBg,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: C.cardBorder,
      padding: 20,
      gap: 16,
      shadowColor: C.primaryFixed,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.05,
      shadowRadius: 20,
      elevation: 4,
    },
    inputContainer: {
      gap: 6,
    },
    inputLabel: {
      fontSize: 13,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_700Bold' : undefined,
      color: C.onSurface,
      opacity: 0.85,
      marginLeft: 4,
    },
    bioLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    charCounter: {
      fontSize: 11,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
      opacity: 0.7,
      marginRight: 4,
    },
    inputCapsule: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceContainerHigh,
      borderWidth: 1.5,
      borderColor: 'transparent',
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 48,
    },
    inputCapsuleFocused: {
      borderColor: C.primaryFixed,
      shadowColor: C.primaryFixed,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    },
    prefixAt: {
      fontSize: 15,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
      marginRight: 2,
    },
    textInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurface,
      padding: 0,
    },
    bioCapsule: {
      height: 90,
      paddingVertical: 12,
      alignItems: 'flex-start',
    },
    bioInput: {
      textAlignVertical: 'top',
      height: '100%',
    },
    saveBtn: {
      backgroundColor: C.primaryFixed,
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      shadowColor: C.primaryFixed,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 4,
    },
    saveBtnText: {
      color: C.onPrimaryFixed,
      fontFamily: fontsLoaded ? 'Sora_700Bold' : undefined,
      fontSize: 15,
    },

    /* Options List */
    optionsList: {
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
      backgroundColor: C.cardBg,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.cardBorder,
      paddingVertical: 6,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      width: '100%',
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      width: '100%',
      flexWrap: 'wrap',
      gap: 12,
    },
    themeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 120,
    },
    optionInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
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
      fontSize: 14,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_700Bold' : undefined,
      color: C.onSurface,
    },
    optionSubLabel: {
      fontSize: 11,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
      opacity: 0.75,
    },
    optionsRowDivider: {
      height: 1,
      backgroundColor: 'rgba(137,148,133,0.1)',
      marginHorizontal: 16,
    },

    /* Segmented Controls */
    segmentedContainer: {
      flexDirection: 'row',
      backgroundColor: C.surfaceContainerHigh,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: C.cardBorder,
    },
    segmentPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 9,
      backgroundColor: 'transparent',
    },
    segmentPillActive: {
      backgroundColor: C.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    segmentText: {
      fontSize: 12,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
    },
    segmentTextActive: {
      fontFamily: fontsLoaded ? 'PlusJakartaSans_700Bold' : undefined,
      color: C.primaryFixedDim,
    },

    /* Danger Zone Container */
    dangerZoneContainer: {
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
      gap: 12,
    },
    logoutBtn: {
      width: '100%',
      backgroundColor: C.surfaceContainer,
      borderWidth: 1.5,
      borderColor: C.cardBorder,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutText: {
      color: C.onSurface,
      fontFamily: fontsLoaded ? 'Sora_700Bold' : undefined,
      fontSize: 14,
    },
    deleteBtn: {
      width: '100%',
      backgroundColor: C.errorBg,
      borderWidth: 1.5,
      borderColor: C.errorBorder,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: C.errorColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    deleteText: {
      color: C.errorText,
      fontFamily: fontsLoaded ? 'Sora_700Bold' : undefined,
      fontSize: 14,
    },

    /* Tagline */
    tagline: {
      marginTop: 36,
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
