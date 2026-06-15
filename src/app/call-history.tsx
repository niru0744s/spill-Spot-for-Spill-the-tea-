/**
 * app/call-history.tsx
 * --------------------
 * Premium Call History screen matching the Stitch and Tea Brand guidelines.
 * Displays voice & video call logs with quick call-back actions.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';
import { initiateCall } from '@/services/callService';
import { useFonts, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { PlusJakartaSans_500Medium, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';

interface CallRecord {
  id: string;
  callerUid: string;
  callerName: string;
  callerPhoto: string | null;
  receiverUid: string;
  status: string;
  type: 'voice' | 'video';
  createdAt: number;
}

interface PartnerProfile {
  uid: string;
  name: string;
  photoURL: string | null;
  displayName: string;
}

export default function CallHistoryScreen() {
  const [fontsLoaded] = useFonts({
    Sora_700Bold,
    Sora_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    SpaceGrotesk_700Bold,
  });

  const { colors: C } = useTheme();
  const styles = useStyles(getStyles, fontsLoaded);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const currentUid = auth.currentUser?.uid ?? '';
  const [callLogs, setCallLogs] = useState<CallRecord[]>([]);
  const [partners, setPartners] = useState<Record<string, PartnerProfile>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUid) return;

    const fetchCallLogs = async () => {
      setIsLoading(true);
      try {
        const callsRef = collection(db, 'calls');

        // Query 1: where current user is caller
        const q1 = query(
          callsRef,
          where('callerUid', '==', currentUid),
          orderBy('createdAt', 'desc'),
          limit(30)
        );

        // Query 2: where current user is receiver
        const q2 = query(
          callsRef,
          where('receiverUid', '==', currentUid),
          orderBy('createdAt', 'desc'),
          limit(30)
        );

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        const rawList: CallRecord[] = [];
        const seenIds = new Set<string>();

        const processSnap = (snap: any) => {
          snap.forEach((docSnap: any) => {
            const data = docSnap.data();
            if (!seenIds.has(docSnap.id)) {
              seenIds.add(docSnap.id);
              rawList.push({
                id: docSnap.id,
                callerUid: data.callerUid,
                callerName: data.callerName ?? 'Spill User',
                callerPhoto: data.callerPhoto ?? null,
                receiverUid: data.receiverUid,
                status: data.status,
                type: data.type || 'voice',
                createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
              });
            }
          });
        };

        processSnap(snap1);
        processSnap(snap2);

        // Sort combined list descending
        rawList.sort((a, b) => b.createdAt - a.createdAt);
        setCallLogs(rawList);

        // Find all unique partner UIDs
        const partnerUids = new Set<string>();
        rawList.forEach((log) => {
          const partnerUid = log.callerUid === currentUid ? log.receiverUid : log.callerUid;
          if (partnerUid) partnerUids.add(partnerUid);
        });

        const partnerUidArray = Array.from(partnerUids);
        if (partnerUidArray.length > 0) {
          // Fetch profiles in batches of 10 (Firestore 'in' limit is 30, but 10 is very safe)
          const profileMap: Record<string, PartnerProfile> = {};
          const usersRef = collection(db, 'users');

          // Chunk function
          const chunks = [];
          for (let i = 0; i < partnerUidArray.length; i += 10) {
            chunks.push(partnerUidArray.slice(i, i + 10));
          }

          await Promise.all(
            chunks.map(async (chunk) => {
              const uQuery = query(usersRef, where('uid', 'in', chunk));
              const uSnap = await getDocs(uQuery);
              uSnap.forEach((uDoc) => {
                const uData = uDoc.data();
                profileMap[uDoc.id] = {
                  uid: uDoc.id,
                  name: uData.name ?? 'Spill User',
                  photoURL: uData.photoURL ?? null,
                  displayName: uData.displayName ?? '',
                };
              });
            })
          );

          setPartners(profileMap);
        }
      } catch (err) {
        console.warn('[CallHistory] Failed to load call logs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCallLogs();
  }, [currentUid]);

  const handleCallBack = async (partnerUid: string, type: 'voice' | 'video') => {
    const partner = partners[partnerUid];
    const partnerName = partner?.name ?? 'Tea Friend';
    const partnerPhoto = partner?.photoURL ?? null;

    Alert.alert(
      `Call Back?`,
      `Would you like to initiate a ${type} call to ${partnerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: async () => {
            try {
              const callId = await initiateCall(partnerUid, partnerName, partnerPhoto, type);
              if (callId) {
                // Navigates automatically through Layout overlay
                console.log('[CallHistory] Call initiated successfully:', callId);
              } else {
                Alert.alert('Call Failed', 'Could not initiate calling session.');
              }
            } catch (err) {
              Alert.alert('Call Error', 'An error occurred while dialing.');
            }
          },
        },
      ]
    );
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    });
    return `${dateStr}, ${timeStr}`;
  };

  const renderCallRow = ({ item }: { item: CallRecord }) => {
    const isOutgoing = item.callerUid === currentUid;
    const partnerUid = isOutgoing ? item.receiverUid : item.callerUid;
    const partner = partners[partnerUid];

    const partnerName = partner?.name ?? (isOutgoing ? 'Spill User' : item.callerName);
    const partnerPhoto = partner?.photoURL ?? (isOutgoing ? null : item.callerPhoto);

    // Call status parsing
    let statusLabel = '';
    let statusColor = C.onSurfaceVariant;
    let statusIcon = 'call-made';

    if (isOutgoing) {
      statusLabel = 'Outgoing';
      statusIcon = 'call-made';
      statusColor = C.primaryFixedDim;
    } else {
      const isMissed = item.status === 'dialing' || item.status === 'ringing' || item.status === 'rejected';
      if (isMissed) {
        statusLabel = 'Missed';
        statusIcon = 'call-missed';
        statusColor = C.errorColor;
      } else {
        statusLabel = 'Incoming';
        statusIcon = 'call-received';
        statusColor = C.primaryFixed;
      }
    }

    return (
      <View style={styles.callRow}>
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          {partnerPhoto ? (
            <Image source={{ uri: partnerPhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{getInitial(partnerName)}</Text>
            </View>
          )}
        </View>

        {/* Mid Content */}
        <View style={styles.midContent}>
          <Text style={styles.partnerName} numberOfLines={1}>
            {partnerName}
          </Text>
          <View style={styles.statusRow}>
            <MaterialIcons name={statusIcon as any} size={14} color={statusColor} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {statusLabel} • {formatDate(item.createdAt)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.rightContent}>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => handleCallBack(partnerUid, item.type)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={item.type === 'video' ? 'videocam' : 'phone'}
              size={20}
              color={C.primaryFixed}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Call History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primaryFixedDim} />
        </View>
      ) : callLogs.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="phone-missed" size={48} color={C.onSurfaceVariant} style={{ opacity: 0.4 }} />
          <Text style={styles.emptyText}>No call history logs spilled yet... 📞</Text>
        </View>
      ) : (
        <FlatList
          data={callLogs}
          renderItem={renderCallRow}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

/* Styles */
function getStyles(C: ThemeColors, isDark: boolean, fontsLoaded: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
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
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      color: C.onSurfaceVariant,
      textAlign: 'center',
      opacity: 0.7,
    },

    /* Row Item */
    callRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(137,148,133,0.08)',
      gap: 14,
    },
    avatarWrapper: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: C.cardBorder,
      overflow: 'hidden',
    },
    avatar: {
      width: '100%',
      height: '100%',
    },
    avatarFallback: {
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(150,249,150,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 18,
      fontFamily: fontsLoaded ? 'Sora_700Bold' : undefined,
      color: C.primaryFixed,
    },
    midContent: {
      flex: 1,
      gap: 3,
    },
    partnerName: {
      fontSize: 15,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_700Bold' : undefined,
      color: C.onSurface,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statusLabel: {
      fontSize: 11,
      fontFamily: fontsLoaded ? 'PlusJakartaSans_500Medium' : undefined,
      opacity: 0.8,
    },
    rightContent: {
      justifyContent: 'center',
    },
    callBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(150,249,150,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.cardBorder,
    },
  });
}
