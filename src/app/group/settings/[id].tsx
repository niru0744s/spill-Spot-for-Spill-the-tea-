import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { auth, db } from '@/config/firebase';
import { useSearch, type SearchUser } from '@/hooks/useSearch';
import { uploadGroupPhotoToSupabase } from '@/services/supabaseService';
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

export default function GroupSettingsScreen() {
  const { colors: C, isDark } = useTheme();
  const styles = useStyles(getStyles);
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();

  const currentUid = auth.currentUser?.uid ?? '';

  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit details state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempDesc, setTempDesc] = useState('');

  // Add Member Modal State
  const [isAddMemberVisible, setIsAddMemberVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { results, isSearching, search, clearResults } = useSearch();

  // Load details
  const loadDetails = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'chats', groupId));
      if (snap.exists()) {
        const chat = snap.data();
        setGroupDetails(chat);
        setTempName(chat.groupName ?? '');
        setTempDesc(chat.groupDescription ?? '');
      }
    } catch (err) {
      console.error('[GroupSettings] Error loading details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Helper to update active member inboxes when group info changes
  const updateGroupInboxes = async (
    name: string,
    photoUrl: string | null,
    members: any
  ) => {
    const batch = writeBatch(db);
    const activeMemberUids = Object.keys(members).filter(
      (uid) => members[uid].status === 'ACTIVE'
    );
    for (const memberUid of activeMemberUids) {
      const inboxRef = doc(db, 'users', memberUid, 'inbox', groupId);
      batch.update(inboxRef, {
        partnerName: name,
        partnerPhoto: photoUrl,
      });
    }
    await batch.commit();
  };

  // Determine current user roles
  const activeParticipants = React.useMemo(() => {
    if (!groupDetails?.members) return [];
    return Object.keys(groupDetails.members).map((uid) => ({
      user: {
        id: uid,
        username: groupDetails.members[uid].displayName ?? 'Unknown',
        name: groupDetails.members[uid].name ?? 'Unknown',
        profilePictureUrl: groupDetails.members[uid].photoURL ?? null,
      },
      isAdmin: !!groupDetails.members[uid].isAdmin,
      status: groupDetails.members[uid].status ?? 'ACTIVE',
    }));
  }, [groupDetails]);

  const activeMembers = activeParticipants.filter((p: any) => p.status === 'ACTIVE');
  const removedMembers = activeParticipants.filter((p: any) => p.status === 'REMOVED');
  
  const currentParticipant = activeParticipants.find(
    (p: any) => p.user.id === currentUid
  );
  const isAdmin = !!currentParticipant?.isAdmin;
  const isRemoved = currentParticipant?.status === 'REMOVED';

  // Update Group Cover Image
  const handlePickImage = async () => {
    if (!isAdmin) return;
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
      const base64Data = result.assets[0].base64;
      if (base64Data) {
        setIsUpdating(true);
        try {
          const downloadUrl = await uploadGroupPhotoToSupabase(base64Data, groupId);
          if (downloadUrl) {
            const groupRef = doc(db, 'chats', groupId);
            await updateDoc(groupRef, {
              groupImageUrl: downloadUrl,
            });
            if (groupDetails?.members) {
              await updateGroupInboxes(
                groupDetails.groupName ?? 'Unknown Group',
                downloadUrl,
                groupDetails.members
              );
            }
            await loadDetails();
            Alert.alert('Success 🎉', 'Group avatar updated!');
          }
        } catch (err) {
          Alert.alert('Error ⚠️', 'Failed to upload group photo.');
        } finally {
          setIsUpdating(false);
        }
      }
    }
  };

  // Save Name & Description
  const handleSaveInfo = async () => {
    if (!tempName.trim()) {
      Alert.alert('Required', 'Group name cannot be empty.');
      return;
    }
    setIsUpdating(true);
    try {
      const groupRef = doc(db, 'chats', groupId);
      await updateDoc(groupRef, {
        groupName: tempName.trim(),
        groupDescription: tempDesc.trim() || null,
      });
      if (groupDetails?.members) {
        await updateGroupInboxes(
          tempName.trim(),
          groupDetails.groupImageUrl ?? null,
          groupDetails.members
        );
      }
      setIsEditingInfo(false);
      await loadDetails();
    } catch (err) {
      Alert.alert('Error', 'Failed to update group settings.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Add Member
  const handleAddMember = async (targetUser: SearchUser) => {
    setIsUpdating(true);
    try {
      const groupRef = doc(db, 'chats', groupId);
      
      const updatedMembers = {
        ...(groupDetails?.members ?? {}),
        [targetUser.uid]: {
          uid: targetUser.uid,
          displayName: targetUser.displayName,
          name: targetUser.name,
          photoURL: targetUser.photoURL ?? null,
          isAdmin: false,
          status: 'ACTIVE',
          joinedAt: Date.now(),
        }
      };

      await updateDoc(groupRef, {
        members: updatedMembers,
      });

      const inboxRef = doc(db, 'users', targetUser.uid, 'inbox', groupId);
      await setDoc(inboxRef, {
        chatId: groupId,
        isGroup: true,
        partnerUid: 'GROUP',
        partnerName: groupDetails?.groupName ?? 'Unknown Group',
        partnerPhoto: groupDetails?.groupImageUrl ?? null,
        lastMessage: 'You joined the group chat 🫖',
        lastMessageAt: serverTimestamp(),
        unread: 1,
        status: 'ACTIVE',
      }, { merge: true });

      setSearchQuery('');
      clearResults();
      setIsAddMemberVisible(false);
      await loadDetails();
      Alert.alert('Success 🎉', 'Member added successfully!');
    } catch (err) {
      console.error('[AddMember] Error:', err);
      Alert.alert('Error', 'Failed to add member to group.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Remove Member (Set status to REMOVED)
  const handleRemoveMember = (userId: string, username: string) => {
    const performRemove = async () => {
      setIsUpdating(true);
      try {
        const groupRef = doc(db, 'chats', groupId);
        const updatedMembers = { ...(groupDetails?.members ?? {}) };
        if (updatedMembers[userId]) {
          updatedMembers[userId].status = 'REMOVED';
          updatedMembers[userId].isAdmin = false;
        }
        await updateDoc(groupRef, {
          members: updatedMembers,
        });

        const inboxRef = doc(db, 'users', userId, 'inbox', groupId);
        await updateDoc(inboxRef, {
          status: 'REMOVED',
        });

        await loadDetails();
      } catch (err) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to remove member.');
        } else {
          Alert.alert('Error', 'Failed to remove member.');
        }
      } finally {
        setIsUpdating(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmRemove = window.confirm(
        `Remove Member?\nAre you sure you want to remove @${username}? they will no longer be able to reply but will retain chat history.`
      );
      if (confirmRemove) {
        performRemove();
      }
    } else {
      Alert.alert(
        'Remove Member?',
        `Are you sure you want to remove @${username}? they will no longer be able to reply but will retain chat history.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: performRemove,
          },
        ]
      );
    }
  };

  // Promoted Admin Toggle
  const handleToggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    setIsUpdating(true);
    try {
      const groupRef = doc(db, 'chats', groupId);
      const updatedMembers = { ...(groupDetails?.members ?? {}) };
      if (updatedMembers[userId]) {
        updatedMembers[userId].isAdmin = !currentlyAdmin;
      }
      await updateDoc(groupRef, {
        members: updatedMembers,
      });
      await loadDetails();
    } catch (err) {
      if (Platform.OS === 'web') {
        alert('Error: Failed to update member role.');
      } else {
        Alert.alert('Error', 'Failed to update member role.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Leave Group (Set own status to REMOVED)
  const handleLeaveGroup = () => {
    const performLeave = async () => {
      setIsUpdating(true);
      try {
        const groupRef = doc(db, 'chats', groupId);
        const updatedMembers = { ...(groupDetails?.members ?? {}) };
        if (updatedMembers[currentUid]) {
          updatedMembers[currentUid].status = 'REMOVED';
        }
        await updateDoc(groupRef, {
          members: updatedMembers,
        });

        const inboxRef = doc(db, 'users', currentUid, 'inbox', groupId);
        await updateDoc(inboxRef, {
          status: 'REMOVED',
        });

        router.replace('/(tabs)/community');
      } catch (err) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to leave group.');
        } else {
          Alert.alert('Error', 'Failed to leave group.');
        }
      } finally {
        setIsUpdating(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmLeave = window.confirm(
        'Leave Group? 🫖\nAre you sure you want to leave this tea circle? You will not be able to reply, but you can read previous messages.'
      );
      if (confirmLeave) {
        performLeave();
      }
    } else {
      Alert.alert(
        'Leave Group? 🫖',
        'Are you sure you want to leave this tea circle? You will not be able to reply, but you can read previous messages.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: performLeave,
          },
        ]
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.secondary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(`/group/${groupId}`);
            }
          }}
        >
          <MaterialIcons name="arrow-back-ios" size={20} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={[styles.avatarWrapper, isAdmin && styles.avatarAdminEdit]}
            onPress={handlePickImage}
            disabled={!isAdmin || isUpdating}
          >
            {groupDetails?.groupImageUrl ? (
              <Image source={{ uri: groupDetails.groupImageUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {groupDetails?.groupName?.charAt(0)?.toUpperCase() ?? 'G'}
                </Text>
              </View>
            )}
            {isAdmin && (
              <View style={styles.avatarEditOverlay}>
                <MaterialIcons name="camera-alt" size={16} color={isDark ? '#380c00' : '#0f150e'} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Block */}
        {isEditingInfo ? (
          <View style={styles.infoCard}>
            <Text style={styles.cardLabel}>GROUP NAME</Text>
            <TextInput
              style={styles.textInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Group name"
              placeholderTextColor="rgba(190,202,185,0.4)"
              maxLength={35}
            />

            <Text style={[styles.cardLabel, { marginTop: 12 }]}>DESCRIPTION</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={tempDesc}
              onChangeText={setTempDesc}
              placeholder="Description"
              placeholderTextColor="rgba(190,202,185,0.4)"
              multiline
              numberOfLines={3}
              maxLength={150}
            />

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveInfo} disabled={isUpdating}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setTempName(groupDetails?.groupName ?? '');
                  setTempDesc(groupDetails?.groupDescription ?? '');
                  setIsEditingInfo(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.infoCard}>
            <View style={styles.infoTitleRow}>
              <Text style={styles.groupNameText}>{groupDetails?.groupName}</Text>
              {isAdmin && (
                <TouchableOpacity onPress={() => setIsEditingInfo(true)}>
                  <MaterialIcons name="edit" size={20} color={C.secondary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.groupDescText}>
              {groupDetails?.groupDescription || 'No description provided.'}
            </Text>
          </View>
        )}

        {/* Member Roster Header */}
        <View style={styles.rosterHeader}>
          <Text style={styles.sectionLabel}>MEMBERS ({activeMembers.length})</Text>
          {isAdmin && !isRemoved && (
            <TouchableOpacity style={styles.addMemberBtn} onPress={() => setIsAddMemberVisible(true)}>
              <MaterialIcons name="person-add" size={16} color={C.primaryFixedDim} />
              <Text style={styles.addMemberBtnText}>Add Member</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Roster Cards */}
        <View style={styles.rosterList}>
          {activeMembers.map((member: any) => {
            const isMemberSelf = member.user.id === currentUid;
            const isMemberAdmin = !!member.isAdmin;

            return (
              <View key={member.user.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  {member.user.profilePictureUrl ? (
                    <Image source={{ uri: member.user.profilePictureUrl }} style={styles.memberAvatarImg} />
                  ) : (
                    <Text style={styles.memberAvatarText}>
                      {member.user.username?.charAt(0)?.toUpperCase() ?? '?'}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{member.user.name}</Text>
                  <Text style={styles.memberUsername}>@{member.user.username}</Text>
                </View>

                {/* Role badge */}
                {isMemberAdmin && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>Admin</Text>
                  </View>
                )}

                {/* Admin controls for other members */}
                {isAdmin && !isMemberSelf && !isRemoved && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionIcon}
                      onPress={() => handleToggleAdmin(member.user.id, isMemberAdmin)}
                    >
                      <MaterialIcons
                        name={isMemberAdmin ? 'verified-user' : 'security'}
                        size={20}
                        color={isMemberAdmin ? C.secondary : C.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIcon}
                      onPress={() => handleRemoveMember(member.user.id, member.user.username)}
                    >
                      <MaterialIcons name="remove-circle-outline" size={20} color={C.errorColor} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Leaving Action */}
        {!isRemoved && (
          <View style={styles.leaveSection}>
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
              <MaterialIcons name="exit-to-app" size={20} color={C.errorColor} />
              <Text style={styles.leaveBtnText}>Leave Tea Circle</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={isAddMemberVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddMemberVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContent} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Member</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setSearchQuery('');
                  clearResults();
                  setIsAddMemberVisible(false);
                }}
              >
                <MaterialIcons name="close" size={24} color={C.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBar}>
              <MaterialIcons name="search" size={20} color={C.onSurfaceVariant} />
              <TextInput
                style={styles.modalSearchInput}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  search(text);
                }}
                placeholder="Search by username..."
                placeholderTextColor="rgba(190,202,185,0.4)"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              {isSearching ? (
                <ActivityIndicator color={C.secondary} style={{ marginTop: 30 }} />
              ) : results.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {results.map((user) => {
                    // Check if already in group
                    const isAlreadyMember = activeMembers.some((m: any) => m.user.id === user.uid);
                    return (
                      <View key={user.uid} style={styles.modalUserCard}>
                        <View style={styles.modalUserAvatar}>
                          {user.photoURL ? (
                            <Image source={{ uri: user.photoURL }} style={styles.modalUserAvatarImg} />
                          ) : (
                            <Text style={styles.modalUserAvatarText}>
                              {user.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalUserName}>{user.displayName}</Text>
                          <Text style={styles.modalUserSub}>{user.name}</Text>
                        </View>

                        {isAlreadyMember ? (
                          <View style={styles.memberTag}>
                            <Text style={styles.memberTagText}>Joined</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.userAddBtn}
                            onPress={() => handleAddMember(user)}
                          >
                            <MaterialIcons name="add" size={18} color={C.onPrimaryFixed} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : searchQuery.length > 0 ? (
                <Text style={styles.modalEmptyText}>No tea friends found.</Text>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getStyles(C: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderColor: 'rgba(255,255,255,0.03)',
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
      color: C.white,
      letterSpacing: -0.5,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    avatarSection: {
      alignItems: 'center',
      marginTop: 24,
    },
    avatarWrapper: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: C.surfaceContainer,
      borderWidth: 2,
      borderColor: 'rgba(255,181,156,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    avatarAdminEdit: {
      borderColor: C.secondary,
    },
    avatarImg: {
      width: 110,
      height: 110,
    },
    avatarPlaceholder: {
      width: 110,
      height: 110,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 36,
      fontWeight: '800',
      color: C.secondary,
    },
    avatarEditOverlay: {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      height: 30,
      backgroundColor: 'rgba(255,181,156,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 4,
    },
    infoCard: {
      marginHorizontal: 20,
      backgroundColor: C.surfaceContainer,
      borderRadius: 20,
      padding: 16,
      marginTop: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.03)',
    },
    infoTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    groupNameText: {
      fontSize: 20,
      fontWeight: '800',
      color: C.white,
      flex: 1,
      paddingRight: 12,
    },
    groupDescText: {
      fontSize: 14,
      color: C.onSurfaceVariant,
      lineHeight: 20,
    },
    cardLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: C.secondary,
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: C.surfaceContainerHigh,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
      color: C.white,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      fontWeight: '600',
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    editActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 14,
    },
    saveBtn: {
      backgroundColor: C.secondary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    saveBtnText: {
      fontSize: 13,
      fontWeight: '900',
      color: isDark ? '#380c00' : '#ffffff',
    },
    cancelBtn: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: C.white,
    },
    rosterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: 28,
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: C.secondary,
      letterSpacing: 1.5,
    },
    addMemberBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    addMemberBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: C.primaryFixedDim,
    },
    rosterList: {
      marginHorizontal: 20,
      gap: 8,
    },
    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceContainer,
      borderRadius: 16,
      padding: 12,
      gap: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.02)',
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    memberAvatarImg: {
      width: 40,
      height: 40,
    },
    memberAvatarText: {
      fontSize: 16,
      fontWeight: '800',
      color: C.primaryFixedDim,
    },
    memberName: {
      fontSize: 14,
      fontWeight: '700',
      color: C.white,
    },
    memberUsername: {
      fontSize: 12,
      color: C.onSurfaceVariant,
    },
    roleBadge: {
      backgroundColor: 'rgba(255,181,156,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    roleBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: C.secondary,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaveSection: {
      paddingHorizontal: 20,
      marginTop: 36,
    },
    leaveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,107,107,0.08)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,107,107,0.2)',
      borderRadius: 16,
      height: 52,
      gap: 8,
    },
    leaveBtnText: {
      fontSize: 14,
      fontWeight: '800',
      color: C.errorColor,
    },

    /* ── Modal Styles ────────────────────────────────────────── */
    modalOverlay: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(15,21,14,0.9)' : 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      flex: 0.9,
      backgroundColor: C.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 18,
      borderBottomWidth: 1,
      borderColor: C.cardBorder,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: C.white,
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSearchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceContainer,
      borderRadius: 14,
      marginHorizontal: 16,
      marginTop: 16,
      paddingHorizontal: 14,
      height: 48,
      gap: 10,
    },
    modalSearchInput: {
      flex: 1,
      color: C.white,
      fontSize: 14,
      fontWeight: '600',
    },
    modalUserCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceContainer,
      borderRadius: 16,
      padding: 12,
      gap: 12,
    },
    modalUserAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    modalUserAvatarImg: {
      width: 40,
      height: 40,
    },
    modalUserAvatarText: {
      fontSize: 16,
      fontWeight: '800',
      color: C.primaryFixedDim,
    },
    modalUserName: {
      fontSize: 14,
      fontWeight: '700',
      color: C.white,
    },
    modalUserSub: {
      fontSize: 12,
      color: C.onSurfaceVariant,
    },
    userAddBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.primaryFixed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberTag: {
      backgroundColor: 'rgba(122,220,125,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    memberTagText: {
      fontSize: 11,
      fontWeight: '800',
      color: C.primaryFixedDim,
    },
    modalEmptyText: {
      color: C.onSurfaceVariant,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 40,
    },
  });
}
