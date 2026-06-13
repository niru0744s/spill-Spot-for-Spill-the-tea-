/**
 * useCallStore.ts
 * ---------------
 * Zustand store to manage global 1:1 voice & video calling states,
 * Agora remote user IDs, and UI overlays.
 */

import { create } from 'zustand';

export type CallStatus = 'idle' | 'dialing' | 'ringing' | 'accepted' | 'rejected' | 'ended';
export type CallType = 'voice' | 'video';

interface CallState {
  callId: string | null;
  partnerUid: string | null;
  partnerName: string;
  partnerPhoto: string | null;
  type: CallType | null;
  status: CallStatus;
  isIncoming: boolean;
  isMuted: boolean;
  isSpeaker: boolean;
  remoteUid: number | null; // Agora remote user JSI UID
  channelName: string | null;
  agoraToken: string | null;
}

interface CallActions {
  setCallActive: (params: {
    callId: string;
    partnerUid: string;
    partnerName: string;
    partnerPhoto: string | null;
    type: CallType;
    isIncoming: boolean;
    channelName: string;
    agoraToken: string;
  }) => void;
  setStatus: (status: CallStatus) => void;
  setRemoteUid: (remoteUid: number | null) => void;
  toggleMute: () => void;
  setMuted: (isMuted: boolean) => void;
  toggleSpeaker: () => void;
  setSpeaker: (isSpeaker: boolean) => void;
  reset: () => void;
}

const initialState: CallState = {
  callId: null,
  partnerUid: null,
  partnerName: 'Someone',
  partnerPhoto: null,
  type: null,
  status: 'idle',
  isIncoming: false,
  isMuted: false,
  isSpeaker: false,
  remoteUid: null,
  channelName: null,
  agoraToken: null,
};

export const useCallStore = create<CallState & CallActions>((set) => ({
  ...initialState,

  setCallActive: (params) =>
    set({
      callId: params.callId,
      partnerUid: params.partnerUid,
      partnerName: params.partnerName,
      partnerPhoto: params.partnerPhoto,
      type: params.type,
      isIncoming: params.isIncoming,
      channelName: params.channelName,
      agoraToken: params.agoraToken,
      status: params.isIncoming ? 'ringing' : 'dialing',
    }),

  setStatus: (status) => set({ status }),
  
  setRemoteUid: (remoteUid) => set({ remoteUid }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  
  setMuted: (isMuted) => set({ isMuted }),

  toggleSpeaker: () => set((state) => ({ isSpeaker: !state.isSpeaker })),
  
  setSpeaker: (isSpeaker) => set({ isSpeaker }),

  reset: () => set(initialState),
}));
