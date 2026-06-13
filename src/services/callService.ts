/**
 * callService.ts
 * ---------------
 * Handles Firestore call signaling and push notifications for 1:1 calling.
 * Schema: `/calls/{callId}`
 */

import { auth, db } from '@/config/firebase';
import { useCallStore, type CallStatus, type CallType } from '@/store/useCallStore';
import { randomUUID } from 'expo-crypto';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { sendPushNotification } from './notificationService';

let activeCallListener: Unsubscribe | null = null;
let incomingCallListener: Unsubscribe | null = null;
let dialTimeout: any = null;

const DIAL_TIMEOUT_MS = 45000; // 45 seconds to answer

/**
 * Initiates a voice/video call session, writes signaling document to Firestore,
 * dispatches a high-priority push notification, and starts listening for responses.
 */
export async function initiateCall(
  receiverUid: string,
  receiverName: string,
  receiverPhoto: string | null,
  type: CallType
): Promise<string | null> {
  const caller = auth.currentUser;
  if (!caller) return null;

  const callId = randomUUID();
  const channelName = 'Spill'; // Fixed channel matching the Agora temp token
  const agoraAppId = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
  const agoraToken = process.env.EXPO_PUBLIC_AGORA_TEMP_TOKEN || '';

  const callerName = caller.displayName || 'Spill User';
  const callerPhoto = caller.photoURL || null;

  // 1. Set active local Zustand store state
  useCallStore.getState().setCallActive({
    callId,
    partnerUid: receiverUid,
    partnerName: receiverName,
    partnerPhoto: receiverPhoto,
    type,
    isIncoming: false,
    channelName,
    agoraToken,
  });

  // 2. Write call signaling document to Firestore
  const callDocRef = doc(db, 'calls', callId);
  await setDoc(callDocRef, {
    id: callId,
    callerUid: caller.uid,
    callerName,
    callerPhoto,
    receiverUid,
    status: 'dialing',
    type,
    channelName,
    agoraToken,
    createdAt: serverTimestamp(),
  });

  // 3. Dispatch Push Notification
  try {
    const userDocRef = doc(db, 'users', receiverUid);
    const userDocSnap = await getDoc(userDocRef);
    const pushToken = userDocSnap.data()?.pushToken;

    if (pushToken) {
      await sendPushNotification({
        to: pushToken,
        title: `Incoming ${type === 'video' ? 'Video' : 'Voice'} Call`,
        body: `${callerName} is calling you...`,
        data: {
          type: 'CALL_INCOMING',
          callId,
          callerUid: caller.uid,
          callerName,
          callerPhoto: callerPhoto || '',
          channelName,
          agoraToken,
          callType: type,
        },
      });
    }
  } catch (error) {
    console.error('[CallService] Push notification dispatch failed:', error);
  }

  // 4. Listen to signaling status changes
  startActiveCallListener(callId);

  // 5. Setup auto-hangup timer if unanswered
  dialTimeout = setTimeout(() => {
    const currentStatus = useCallStore.getState().status;
    if (currentStatus === 'dialing' || currentStatus === 'ringing') {
      endCall(callId);
    }
  }, DIAL_TIMEOUT_MS);

  return callId;
}

/**
 * Subscribes to the active call's Firestore document to track transitions
 * such as accepted, rejected, or ended.
 */
export function startActiveCallListener(callId: string) {
  if (activeCallListener) activeCallListener();

  const callDocRef = doc(db, 'calls', callId);
  activeCallListener = onSnapshot(callDocRef, (snapshot) => {
    if (!snapshot.exists()) {
      // Document deleted
      cleanupCallSession();
      return;
    }

    const data = snapshot.data();
    const status = data.status as CallStatus;

    if (status === 'accepted') {
      if (dialTimeout) {
        clearTimeout(dialTimeout);
        dialTimeout = null;
      }
      useCallStore.getState().setStatus('accepted');
    } else if (status === 'rejected' || status === 'ended') {
      cleanupCallSession();
    }
  });
}

/**
 * Accepts an incoming call: updates Firestore status to 'accepted'.
 */
export async function acceptCall(callId: string) {
  const callDocRef = doc(db, 'calls', callId);
  await updateDoc(callDocRef, { status: 'accepted' });
  useCallStore.getState().setStatus('accepted');
  startActiveCallListener(callId);
}

/**
 * Rejects an incoming call: updates Firestore status to 'rejected'.
 */
export async function rejectCall(callId: string) {
  const callDocRef = doc(db, 'calls', callId);
  await updateDoc(callDocRef, { status: 'rejected' });
  cleanupCallSession();
}

/**
 * Ends/cancels an active call session: updates Firestore status to 'ended'.
 */
export async function endCall(callId: string) {
  const callDocRef = doc(db, 'calls', callId);
  try {
    await updateDoc(callDocRef, { status: 'ended' });
  } catch (err) {
    console.warn('[CallService] Document update failed during endCall:', err);
  }
  cleanupCallSession();
}

/**
 * Subscribes to new dialing calls targeting the current user's UID.
 */
export function listenForIncomingCalls(uid: string, onIncoming: (callId: string) => void): Unsubscribe {
  if (incomingCallListener) incomingCallListener();

  // We can query calls collection, but since simple Firestore queries can require indexes,
  // we listen to the active /calls subcollection or just filter dynamically locally if volume is small.
  // Given it's 1:1, we listen on the specific call doc or sub-path. 
  // An alternative is a collection group query or simply checking documents. 
  // Let's implement real-time snapshot subscription on the document `/calls/{uid}` or general query.
  // However, we query `calls` where `receiverUid == uid` and `status == 'dialing'`.
  // To avoid complex composite index creation issues, we can listen for any changes where we are receiver.
  // Wait, let's import queries from firestore:
  const { query, collection, where } = require('firebase/firestore');
  const callsQuery = query(
    collection(db, 'calls'),
    where('receiverUid', '==', uid),
    where('status', '==', 'dialing')
  );

  incomingCallListener = onSnapshot(callsQuery, (snapshot: any) => {
    snapshot.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        const callId = data.id;

        // If local status is already active, ignore incoming (send busy soon)
        if (useCallStore.getState().status !== 'idle') {
          // Update call to ended/busy
          const callRef = doc(db, 'calls', callId);
          updateDoc(callRef, { status: 'rejected' });
          return;
        }

        // Set local call store state
        useCallStore.getState().setCallActive({
          callId,
          partnerUid: data.callerUid,
          partnerName: data.callerName,
          partnerPhoto: data.callerPhoto,
          type: data.type,
          isIncoming: true,
          channelName: data.channelName,
          agoraToken: data.agoraToken,
        });

        // Trigger callback/ui
        onIncoming(callId);
        startActiveCallListener(callId);
      }
    });
  });

  return () => {
    if (incomingCallListener) {
      incomingCallListener();
      incomingCallListener = null;
    }
  };
}

/**
 * Resets local stores, cancels timers, and detaches active database listeners.
 */
function cleanupCallSession() {
  if (dialTimeout) {
    clearTimeout(dialTimeout);
    dialTimeout = null;
  }
  if (activeCallListener) {
    activeCallListener();
    activeCallListener = null;
  }
  useCallStore.getState().reset();
}
