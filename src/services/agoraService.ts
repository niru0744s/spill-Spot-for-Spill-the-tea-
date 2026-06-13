/**
 * agoraService.ts
 * ---------------
 * Type definitions and interface declaration for cross-platform Agora calling.
 */

export interface AgoraServiceInterface {
  initialize(appId: string): void;
  joinChannel(
    token: string,
    channelName: string,
    uid: number,
    type: 'voice' | 'video',
    options?: { isMuted?: boolean; isSpeaker?: boolean }
  ): Promise<void>;
  leaveChannel(): Promise<void>;
  muteLocalAudioStream(isMuted: boolean): void;
  setEnableSpeakerphone(isSpeaker: boolean): void;
  switchCamera(): void;
  registerEventHandler(handlers: {
    onJoinChannelSuccess?: (channelId: string) => void;
    onUserJoined?: (remoteUid: number) => void;
    onUserOffline?: (remoteUid: number) => void;
    onError?: (err: number, msg: string) => void;
  }): void;
  playLocalVideo(containerId: string): Promise<void>;
  playRemoteVideo(uid: number, containerId: string): Promise<void>;
}

// Dummy export to satisfy TypeScript compiler (actual implementations resolved via .native.ts and .web.ts)
export const agoraService: AgoraServiceInterface = {} as any;
