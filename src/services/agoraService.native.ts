/**
 * agoraService.native.ts
 * ----------------------
 * React Native mobile implementation of Agora RTC Engine.
 */

import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngine,
} from 'react-native-agora';
import { AgoraServiceInterface } from './agoraService';

class AgoraServiceNative implements AgoraServiceInterface {
  private engine: IRtcEngine | null = null;
  private handlers: any = {};

  initialize(appId: string) {
    if (!this.engine) {
      this.engine = createAgoraRtcEngine();
      this.engine.initialize({
        appId,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      this.engine.registerEventHandler({
        onJoinChannelSuccess: (connection, elapsed) => {
          if (this.handlers.onJoinChannelSuccess) {
            this.handlers.onJoinChannelSuccess(connection.channelId || '');
          }
        },
        onUserJoined: (connection, remoteUserUid, elapsed) => {
          if (this.handlers.onUserJoined) {
            this.handlers.onUserJoined(remoteUserUid);
          }
        },
        onUserOffline: (connection, remoteUserUid, reason) => {
          if (this.handlers.onUserOffline) {
            this.handlers.onUserOffline(remoteUserUid);
          }
        },
        onError: (err, msg) => {
          if (this.handlers.onError) {
            this.handlers.onError(err, msg);
          }
        },
      });
    }
  }

  async joinChannel(
    token: string,
    channelName: string,
    uid: number,
    type: 'voice' | 'video',
    options?: { isMuted?: boolean; isSpeaker?: boolean }
  ): Promise<void> {
    if (!this.engine) return;

    if (type === 'video') {
      this.engine.enableVideo();
      this.engine.startPreview();
    } else {
      this.engine.enableAudio();
    }

    this.engine.enableLocalAudio(true);
    if (options?.isMuted !== undefined) {
      this.engine.muteLocalAudioStream(options.isMuted);
    }
    if (options?.isSpeaker !== undefined) {
      this.engine.setEnableSpeakerphone(options.isSpeaker);
    }

    this.engine.joinChannel(token, channelName, uid, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    });
  }

  async leaveChannel(): Promise<void> {
    if (this.engine) {
      try {
        this.engine.leaveChannel();
        this.engine.release();
      } catch (err) {
        console.warn('[AgoraServiceNative] Error leaving channel:', err);
      }
      this.engine = null;
    }
  }

  muteLocalAudioStream(isMuted: boolean): void {
    if (this.engine) {
      this.engine.muteLocalAudioStream(isMuted);
    }
  }

  setEnableSpeakerphone(isSpeaker: boolean): void {
    if (this.engine) {
      this.engine.setEnableSpeakerphone(isSpeaker);
    }
  }

  switchCamera(): void {
    if (this.engine) {
      this.engine.switchCamera();
    }
  }

  registerEventHandler(handlers: {
    onJoinChannelSuccess?: (channelId: string) => void;
    onUserJoined?: (remoteUid: number) => void;
    onUserOffline?: (remoteUid: number) => void;
    onError?: (err: number, msg: string) => void;
  }): void {
    this.handlers = handlers;
  }

  async playLocalVideo(containerId: string): Promise<void> {
    // No-op on native
  }

  async playRemoteVideo(uid: number, containerId: string): Promise<void> {
    // No-op on native
  }
}

export const agoraService = new AgoraServiceNative();
export default agoraService;
