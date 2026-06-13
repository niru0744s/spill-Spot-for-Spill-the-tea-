import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuthStore } from '@/store/authStore';
import { useSearch, type SearchUser } from '@/hooks/useSearch';
import { uploadGroupPhotoToSupabase } from '@/services/supabaseService';
import { db } from '@/config/firebase';
import { doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { randomUUID } from 'expo-crypto';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

function safeRandomUUID(): string {
  try {
    return randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

const { width } = Dimensions.get('window');

/* ── Tactile Squish Button ─────────────────────────────────── */
function SquishButton({
  children,
  onPress,
  style,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.95, duration: 100, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();
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

export default function CreateGroupScreen() {
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const router = useRouter();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // User search and selection
  const { results, isSearching, search, clearResults } = useSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);

  const [isCreating, setIsCreating] = useState(false);

  // Handle user search input
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    search(text);
  };

  // Toggle user selection
  const toggleUserSelection = (user: SearchUser) => {
    const exists = selectedUsers.some((u) => u.uid === user.uid);
    if (exists) {
      setSelectedUsers(selectedUsers.filter((u) => u.uid !== user.uid));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // Request gallery permission and pick image
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need gallery access to upload a cover photo!');
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
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required Field', 'Please enter a group name.');
      return;
    }
    if (!firebaseUser) {
      Alert.alert('Error', 'You must be logged in to create a group.');
      return;
    }

    setIsCreating(true);
    try {
      const newGroupId = safeRandomUUID();
      const creatorProfile = useAuthStore.getState().user;

      // Step 1: Upload photo to Supabase if selected
      let finalImageUrl: string | null = null;
      if (imageBase64) {
        try {
          finalImageUrl = await uploadGroupPhotoToSupabase(imageBase64, newGroupId);
        } catch (uploadErr) {
          console.warn('[CreateGroup] Image upload failed, continuing without avatar:', uploadErr);
        }
      }

      // Step 2: Build the members map
      const membersMap: any = {};
      membersMap[firebaseUser.uid] = {
        uid: firebaseUser.uid,
        displayName: creatorProfile?.displayName ?? firebaseUser.displayName ?? 'Me',
        name: creatorProfile?.name ?? firebaseUser.displayName ?? 'Me',
        photoURL: creatorProfile?.photoURL ?? firebaseUser.photoURL ?? null,
        isAdmin: true,
        status: 'ACTIVE',
        joinedAt: Date.now(),
      };

      for (const u of selectedUsers) {
        membersMap[u.uid] = {
          uid: u.uid,
          displayName: u.displayName,
          name: u.name,
          photoURL: u.photoURL ?? null,
          isAdmin: false,
          status: 'ACTIVE',
          joinedAt: Date.now(),
        };
      }

      // Step 3: Write group document to Firestore
      const groupRef = doc(db, 'chats', newGroupId);
      await setDoc(groupRef, {
        id: newGroupId,
        isGroup: true,
        groupName: groupName.trim(),
        groupDescription: description.trim() || null,
        groupImageUrl: finalImageUrl,
        createdAt: serverTimestamp(),
        createdById: firebaseUser.uid,
        lastMessage: 'Group created 🫖',
        lastMessageAt: serverTimestamp(),
        members: membersMap,
      });

      // Step 4: Write inbox documents for all participants atomically
      const batch = writeBatch(db);
      for (const memberUid of Object.keys(membersMap)) {
        const inboxRef = doc(db, 'users', memberUid, 'inbox', newGroupId);
        batch.set(inboxRef, {
          chatId: newGroupId,
          isGroup: true,
          partnerUid: 'GROUP',
          partnerName: groupName.trim(),
          partnerPhoto: finalImageUrl,
          lastMessage: 'Group created 🫖',
          lastMessageAt: serverTimestamp(),
          unread: memberUid === firebaseUser.uid ? 0 : 1,
          status: 'ACTIVE',
        }, { merge: true });
      }
      await batch.commit();

      if (Platform.OS === 'web') {
        alert(`Group Created! 🎉\n"${groupName.trim()}" is ready.`);
        router.replace(`/group/${newGroupId}`);
      } else {
        Alert.alert('Group Created! 🎉', `"${groupName.trim()}" is ready.`, [
          {
            text: 'Spill the Tea 🫖',
            onPress: () => {
              // Go to the newly created group screen
              router.replace(`/group/${newGroupId}`);
            },
          },
        ]);
      }
    } catch (err) {
      console.error('[CreateGroup] Failed to create group:', err);
      if (Platform.OS === 'web') {
        alert('Error ⚠️: Failed to create group. Please check your network and try again.');
      } else {
        Alert.alert('Error ⚠️', 'Failed to create group. Please check your network and try again.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/community');
            }
          }}
        >
          <MaterialIcons name="arrow-back-ios" size={20} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile/Group Image Upload */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons name="camera-enhance" size={32} color={C.secondary} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <MaterialIcons name="edit" size={12} color={C.background} />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarLabel}>Add Group Cover Photo</Text>
        </View>

        {/* Inputs */}
        <View style={styles.form}>
          <Text style={styles.inputLabel}>GROUP NAME</Text>
          <TextInput
            style={styles.textInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="e.g. Gossip Girls 🤫"
            placeholderTextColor="rgba(190,202,185,0.3)"
            maxLength={35}
          />

          <Text style={styles.inputLabel}>DESCRIPTION</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this tea circle about?"
            placeholderTextColor="rgba(190,202,185,0.3)"
            multiline
            numberOfLines={3}
            maxLength={150}
          />
        </View>

        {/* User Invite Section */}
        <View style={styles.inviteSection}>
          <Text style={styles.inputLabel}>ADD MEMBERS</Text>
          
          {/* Custom Search bar */}
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color={C.onSurfaceVariant} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Search user by display name..."
              placeholderTextColor="rgba(190,202,185,0.4)"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  clearResults();
                }}
              >
                <MaterialIcons name="clear" size={18} color={C.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal list of selected users */}
          {selectedUsers.length > 0 && (
            <View style={styles.selectedRow}>
              <FlatList
                horizontal
                data={selectedUsers}
                keyExtractor={(item) => item.uid}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.selectedChip}>
                    <Text style={styles.selectedChipText} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <TouchableOpacity
                      style={styles.chipRemove}
                      onPress={() => toggleUserSelection(item)}
                    >
                      <MaterialIcons name="close" size={12} color={C.background} />
                    </TouchableOpacity>
                  </View>
                )}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
              />
            </View>
          )}

          {/* Search results list */}
          {isSearching ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={C.secondary} />
          ) : results.length > 0 ? (
            <View style={styles.resultsList}>
              {results.map((user) => {
                const isSelected = selectedUsers.some((u) => u.uid === user.uid);
                return (
                  <TouchableOpacity
                    key={user.uid}
                    style={[styles.resultCard, isSelected && styles.resultCardSelected]}
                    onPress={() => toggleUserSelection(user)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultAvatar}>
                      {user.photoURL ? (
                        <Image source={{ uri: user.photoURL }} style={styles.resultAvatarImg} />
                      ) : (
                        <Text style={styles.resultAvatarText}>
                          {user.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{user.displayName}</Text>
                      <Text style={styles.resultFullName} numberOfLines={1}>
                        {user.name}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                      size={22}
                      color={isSelected ? C.primaryFixedDim : C.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : searchQuery.length > 0 ? (
            <Text style={styles.noResultsText}>No tea friends found.</Text>
          ) : null}
        </View>

        {/* Submit */}
        <View style={styles.submitSection}>
          <SquishButton
            disabled={isCreating}
            onPress={handleCreate}
            style={[styles.submitBtn, isCreating && styles.submitBtnDisabled]}
          >
            {isCreating ? (
              <ActivityIndicator color={C.background} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Create Tea Circle 🫖</Text>
            )}
          </SquishButton>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(C: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: C.outlineVariant,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.onSurface,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.surfaceContainer,
    borderWidth: 2,
    borderColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.background,
  },
  avatarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  form: {
    paddingHorizontal: 20,
    marginTop: 28,
    gap: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.secondary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: C.surfaceContainer,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    color: C.onSurface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  inviteSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainer,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    paddingHorizontal: 14,
    gap: 10,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: C.onSurface,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedRow: {
    marginTop: 12,
    height: 32,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.secondary,
    borderRadius: 9999,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 6,
  },
  selectedChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: isDark ? '#380c00' : '#ffffff',
  },
  chipRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: isDark ? 'rgba(15,21,14,0.15)' : 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsList: {
    marginTop: 14,
    gap: 8,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainer,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  resultCardSelected: {
    borderColor: C.primary,
    backgroundColor: isDark ? 'rgba(122,220,125,0.03)' : 'rgba(46,168,71,0.03)',
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  resultAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.primaryFixedDim,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onSurface,
  },
  resultFullName: {
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  noResultsText: {
    textAlign: 'center',
    color: C.onSurfaceVariant,
    fontSize: 14,
    marginTop: 20,
  },
  submitSection: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  submitBtn: {
    backgroundColor: C.secondary,
    borderRadius: 18,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: isDark ? '#380c00' : '#ffffff',
    letterSpacing: 0.5,
  },
});
}
