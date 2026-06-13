/**
 * CallScreen.tsx
 * --------------
 * Global call overlay component. Renders full-screen dialogs for
 * dialing, ringing, active voice calls, and active video calls.
 * Handles Agora engine lifecycle natively.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useCallStore } from '@/store/useCallStore';
import { acceptCall, rejectCall, endCall } from '@/services/callService';
import { useCallPermissions } from '@/hooks/useCallPermissions';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
  IRtcEngine,
} from 'react-native-agora';

const { width, height } = Dimensions.get('window');
const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

export function CallScreen() {
  const {
    callId,
    partnerUid,
    partnerName,
    partnerPhoto,
    type,
    status,
    isIncoming,
    isMuted,
    isSpeaker,
    remoteUid,
    channelName,
    agoraToken,
    setStatus,
    setRemoteUid,
    toggleMute,
    toggleSpeaker,
  } = useCallStore();

  const { requestPermissions } = useCallPermissions();
  const [duration, setDuration] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [cameraState, setCameraState] = useState(true); // true = front/enabled

  const engineRef = useRef<IRtcEngine | null>(null);
  const timerRef = useRef<any>(null);

  // 1. Manage Active Timer
  useEffect(() => {
    if (status === 'accepted') {
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  // 2. Agora RTC Engine lifecycle
  useEffect(() => {
    if (status !== 'accepted' || !channelName || !agoraToken) {
      // Clean up engine if call ends or status resets
      cleanupAgora();
      return;
    }

    let isMounted = true;

    const startAgora = async () => {
      setIsJoining(true);
      // A. Verify mic/camera permissions
      const hasGranted = await requestPermissions(type || 'voice');
      if (!hasGranted) {
        console.warn('[CallScreen] Hardware permissions not granted, ending call.');
        if (callId) endCall(callId);
        return;
      }

      if (!isMounted) return;

      try {
        // B. Initialize Agora engine instance
        const engine = createAgoraRtcEngine();
        engineRef.current = engine;

        engine.initialize({
          appId: AGORA_APP_ID,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        // C. Register Event Handlers
        engine.registerEventHandler({
          onJoinChannelSuccess: (connection, elapsed) => {
            console.log('[Agora] Local user joined channel successfully:', connection.channelId);
            setIsJoining(false);
          },
          onUserJoined: (connection, remoteUserUid, elapsed) => {
            console.log('[Agora] Remote user joined:', remoteUserUid);
            setRemoteUid(remoteUserUid);
          },
          onUserOffline: (connection, remoteUserUid, reason) => {
            console.log('[Agora] Remote user offline:', remoteUserUid, 'reason:', reason);
            if (callId) endCall(callId);
          },
          onError: (err, msg) => {
            console.error('[Agora] Error code:', err, 'Message:', msg);
          },
        });

        // D. Configure Media Options based on Call Type
        if (type === 'video') {
          engine.enableVideo();
          engine.startPreview();
        } else {
          engine.enableAudio();
        }

        // Configure default audio routing
        engine.enableLocalAudio(true);
        engine.muteLocalAudioStream(isMuted);
        engine.setEnableSpeakerphone(isSpeaker);

        // E. Join Channel
        engine.joinChannel(agoraToken, channelName, 0, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        });
      } catch (error) {
        console.error('[CallScreen] Agora setup error:', error);
        if (callId) endCall(callId);
      }
    };

    startAgora();

    return () => {
      isMounted = false;
      cleanupAgora();
    };
  }, [status, channelName, agoraToken]);

  // Sync mute state with Agora engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.muteLocalAudioStream(isMuted);
    }
  }, [isMuted]);

  // Sync speaker state with Agora engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setEnableSpeakerphone(isSpeaker);
    }
  }, [isSpeaker]);

  const cleanupAgora = async () => {
    if (engineRef.current) {
      try {
        engineRef.current.leaveChannel();
        engineRef.current.release();
      } catch (err) {
        console.warn('[CallScreen] Error releasing Agora engine:', err);
      }
      engineRef.current = null;
    }
    setRemoteUid(null);
    setIsJoining(false);
  };

  const handleToggleCamera = () => {
    if (engineRef.current && type === 'video') {
      engineRef.current.switchCamera();
      setCameraState((prev) => !prev);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (status === 'idle') return null;

  // ---------------------------------------------------------------------------
  // View 1: Incoming Ringing Screen
  // ---------------------------------------------------------------------------
  if (status === 'ringing' && isIncoming) {
    return (
      <View style={styles.container}>
        <View style={styles.infoArea}>
          <Image
            source={
              partnerPhoto
                ? { uri: partnerPhoto }
                : require('../../assets/images/icon.png')
            }
            style={styles.avatarLarge}
          />
          <Text style={styles.nameText}>{partnerName}</Text>
          <Text style={styles.statusText}>
            Incoming {type === 'video' ? 'Video' : 'Voice'} Call...
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btnRound, styles.btnDecline]}
            onPress={() => callId && rejectCall(callId)}
            activeOpacity={0.8}
          >
            <Feather name="phone-off" size={24} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnRound, styles.btnAccept]}
            onPress={() => callId && acceptCall(callId)}
            activeOpacity={0.8}
          >
            <Feather name="phone" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // View 2: Outgoing Dialing Screen
  // ---------------------------------------------------------------------------
  if (status === 'dialing' && !isIncoming) {
    return (
      <View style={styles.container}>
        <View style={styles.infoArea}>
          <Image
            source={
              partnerPhoto
                ? { uri: partnerPhoto }
                : require('../../assets/images/icon.png')
            }
            style={styles.avatarLarge}
          />
          <Text style={styles.nameText}>{partnerName}</Text>
          <Text style={styles.statusText}>Calling...</Text>
        </View>

        <View style={styles.actionRowSingle}>
          <TouchableOpacity
            style={[styles.btnRound, styles.btnDecline]}
            onPress={() => callId && endCall(callId)}
            activeOpacity={0.8}
          >
            <Feather name="phone-off" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // View 3: Active Call Screen (Accepted)
  // ---------------------------------------------------------------------------
  if (status === 'accepted') {
    const isVideo = type === 'video';

    return (
      <View style={styles.container}>
        {/* MEDIA VIEWPORT */}
        {isVideo ? (
          <View style={styles.videoGrid}>
            {/* Remote Feed */}
            {remoteUid ? (
              <RtcSurfaceView
                canvas={{ uid: remoteUid }}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <ActivityIndicator size="large" color="#7ADC7D" />
                <Text style={styles.placeholderText}>Waiting for camera feed...</Text>
              </View>
            )}

            {/* Local Preview (PiP) */}
            <View style={styles.localPipWindow}>
              <RtcSurfaceView
                canvas={{ uid: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </View>
        ) : (
          /* Voice Call Center Profile */
          <View style={styles.infoArea}>
            <Image
              source={
                partnerPhoto
                  ? { uri: partnerPhoto }
                  : require('../../assets/images/icon.png')
              }
              style={[styles.avatarLarge, styles.avatarPulse]}
            />
            <Text style={styles.nameText}>{partnerName}</Text>
            {isJoining ? (
              <Text style={styles.statusText}>Connecting audio...</Text>
            ) : (
              <Text style={styles.timerText}>{formatDuration(duration)}</Text>
            )}
          </View>
        )}

        {/* TOP OVERLAY (Video Call Metadata) */}
        {isVideo && (
          <View style={styles.topOverlay}>
            <Text style={styles.topNameText}>{partnerName}</Text>
            <Text style={styles.topTimerText}>{formatDuration(duration)}</Text>
          </View>
        )}

        {/* BOTTOM CONTROLS BAR */}
        <View style={styles.controlBarContainer}>
          <View style={styles.controlBar}>
            {/* Mute */}
            <TouchableOpacity
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
              onPress={toggleMute}
              activeOpacity={0.8}
            >
              <Feather
                name={isMuted ? 'mic-off' : 'mic'}
                size={22}
                color={isMuted ? '#FF4A4A' : '#FFF'}
              />
            </TouchableOpacity>

            {/* Speakerphone */}
            <TouchableOpacity
              style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]}
              onPress={toggleSpeaker}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSpeaker ? 'volume-high' : 'volume-medium'}
                size={22}
                color={isSpeaker ? '#7ADC7D' : '#FFF'}
              />
            </TouchableOpacity>

            {/* Camera Switch (Video Only) */}
            {isVideo && (
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handleToggleCamera}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-reverse-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            )}

            {/* End Call */}
            <TouchableOpacity
              style={[styles.btnRound, styles.btnDecline, styles.controlHangup]}
              onPress={() => callId && endCall(callId)}
              activeOpacity={0.8}
            >
              <Feather name="phone-off" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0f150e',
    zIndex: 9999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 80,
  },
  infoArea: {
    alignItems: 'center',
    marginTop: 40,
  },
  avatarLarge: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: '#7ADC7D',
    marginBottom: 24,
  },
  avatarPulse: {
    // Basic pulse borders or visual effects can be mapped here
    shadowColor: '#7ADC7D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  nameText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'PlusJakartaSans-Bold',
    marginBottom: 8,
  },
  statusText: {
    color: '#7ADC7D',
    fontSize: 16,
    fontWeight: '500',
  },
  timerText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk-Medium',
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
    marginBottom: 20,
  },
  actionRowSingle: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  btnRound: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  btnAccept: {
    backgroundColor: '#24A148',
  },
  btnDecline: {
    backgroundColor: '#DA1E28',
  },
  // Active Video Styles
  videoGrid: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1c2419',
  },
  placeholderText: {
    color: '#aaa',
    marginTop: 12,
    fontSize: 14,
  },
  localPipWindow: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#7ADC7D',
    backgroundColor: '#222',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  topNameText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  topTimerText: {
    color: '#7ADC7D',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  controlBarContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  controlBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 28, 18, 0.85)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(122, 220, 125, 0.2)',
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  controlHangup: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginHorizontal: 12,
  },
});
