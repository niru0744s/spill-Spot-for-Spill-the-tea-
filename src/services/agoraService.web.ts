/**
 * agoraService.web.ts
 * -------------------
 * Web browser implementation of Agora RTC Engine.
 *
 * The Agora Web SDK is NOT bundled via npm/Metro. It is loaded from Agora's
 * CDN via a <script> tag in src/app/+html.tsx, which registers it as the
 * global window.AgoraRTC before the app boots.
 *
 * This sidesteps Metro's inability to bundle agora-rtc-sdk-ng (a 1.5MB UMD
 * browser bundle that causes Node.js heap-out-of-memory crashes in Metro).
 *
 * Key design decisions:
 *  - getRTC() safely reads window.AgoraRTC at call time (browser-only).
 *  - All SDK API calls are guarded: if the CDN script hasn't loaded, getRTC()
 *    returns null and the method exits cleanly.
 *  - Client creation is deferred into joinChannel() so it only runs in-browser.
 *  - onUserJoined fires for BOTH 'audio' and 'video' media types so voice-only
 *    calls correctly register the remote peer UID in the Zustand store.
 */

import { AgoraServiceInterface } from './agoraService';

/** Returns the Agora RTC SDK loaded from CDN, or null during SSR / if not loaded. */
const getRTC = (): any =>
  typeof window !== 'undefined' ? (window as any).AgoraRTC ?? null : null;

class AgoraServiceWeb implements AgoraServiceInterface {
  private client: any = null;
  private localAudioTrack: any = null;
  private localVideoTrack: any = null;
  private remoteUsers: { [uid: string]: any } = {};
  private handlers: any = {};
  private appId: string = '';

  initialize(appId: string): void {
    // Store appId only. Client creation is deferred to joinChannel()
    // so it runs after the CDN script has populated window.AgoraRTC.
    this.appId = appId;
  }

  async joinChannel(
    token: string,
    channelName: string,
    uid: number,
    type: 'voice' | 'video',
    options?: { isMuted?: boolean; isSpeaker?: boolean }
  ): Promise<void> {
    const AgoraRTC = getRTC();
    if (!AgoraRTC) {
      console.error(
        '[AgoraServiceWeb] window.AgoraRTC is not available. ' +
        'Ensure the CDN <script> in +html.tsx has loaded before joining a channel.'
      );
      return;
    }

    // 1. Create client and register listeners (once per session)
    if (!this.client) {
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      this.client.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
        await this.client.subscribe(user, mediaType);
        this.remoteUsers[user.uid.toString()] = user;

        // Fire for BOTH audio and video so voice-only calls register the remote peer
        if (this.handlers.onUserJoined) {
          this.handlers.onUserJoined(Number(user.uid));
        }

        // Auto-play remote audio immediately on subscription
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      this.client.on('user-unpublished', (_user: any, _mediaType: string) => {
        // Intentionally empty — cleanup is handled in user-left
      });

      this.client.on('user-left', (user: any) => {
        delete this.remoteUsers[user.uid.toString()];
        if (this.handlers.onUserOffline) {
          this.handlers.onUserOffline(Number(user.uid));
        }
      });
    }

    // 2. Join the Agora channel
    await this.client.join(this.appId, channelName, token || null, uid || null);

    // 3. Create and publish media tracks based on call type
    if (type === 'video') {
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      this.localAudioTrack = audioTrack;
      this.localVideoTrack = videoTrack;

      if (options?.isMuted) {
        await this.localAudioTrack.setEnabled(false);
      }

      await this.client.publish([this.localAudioTrack, this.localVideoTrack]);
    } else {
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

      if (options?.isMuted) {
        await this.localAudioTrack.setEnabled(false);
      }

      await this.client.publish([this.localAudioTrack]);
    }

    // 4. Notify caller that join succeeded
    if (this.handlers.onJoinChannelSuccess) {
      this.handlers.onJoinChannelSuccess(channelName);
    }
  }

  async leaveChannel(): Promise<void> {
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
    if (this.localVideoTrack) {
      this.localVideoTrack.stop();
      this.localVideoTrack.close();
      this.localVideoTrack = null;
    }
    if (this.client) {
      await this.client.leave();
      this.client = null;
    }
    this.remoteUsers = {};
  }

  muteLocalAudioStream(isMuted: boolean): void {
    if (this.localAudioTrack) {
      this.localAudioTrack.setEnabled(!isMuted).catch((err: any) => {
        console.error('[AgoraServiceWeb] Failed to set audio track state:', err);
      });
    }
  }

  setEnableSpeakerphone(_isSpeaker: boolean): void {
    // No browser API exists to switch speakerphone output routing
    console.log('[AgoraServiceWeb] Speakerphone toggle not supported on web browsers.');
  }

  switchCamera(): void {
    // Web SDK does not expose a direct switchCamera() method
    console.log('[AgoraServiceWeb] Switch camera not supported on web browsers.');
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
    if (typeof window === 'undefined') return;
    if (this.localVideoTrack) {
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
      this.localVideoTrack.play(containerId);
    }
  }

  async playRemoteVideo(uid: number, containerId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const user = this.remoteUsers[uid.toString()];
    if (user && user.videoTrack) {
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
      user.videoTrack.play(containerId);
    }
  }
}

export const agoraService = new AgoraServiceWeb();
export default agoraService;
