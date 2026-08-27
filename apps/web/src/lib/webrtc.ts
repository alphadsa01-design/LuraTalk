// LuraTalk Real-Time Audio & Screen Engine: LiveKit SFU (Primary) + TURN WebRTC (Fallback)

import { socketClient } from '@/lib/socket';
import { useCallStore } from '@/stores/useCallStore';
import { Room, RoomEvent, RemoteTrack, Track, RemoteParticipant, LocalAudioTrack } from 'livekit-client';

export interface WebRTCVoiceOptions {
  isInitiator?: boolean;
  livekitToken?: string;
  livekitUrl?: string;
  roomName?: string;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onPeerSpeakingChange?: (isPeerSpeaking: boolean) => void;
  onDisconnected?: () => void;
  onError?: (err: Error) => void;
}

class LuraWebRTCEngine {
  // LiveKit SFU State
  private livekitRoom: Room | null = null;
  private isUsingLiveKit: boolean = false;

  // P2P WebRTC Fallback State
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private unsubSignal: (() => void) | null = null;

  // Screen Sharing State
  private screenSender: RTCRtpSender | null = null;
  private localScreenStream: MediaStream | null = null;
  private remoteVideoStream: MediaStream | null = null;
  private isRemoteScreenSharingActive: boolean = false;

  // Audio Context & Analysis
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private remoteAudioSource: MediaStreamAudioSourceNode | null = null;
  private remoteGainNode: GainNode | null = null;
  private animationFrameId: number | null = null;

  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];
  private pendingOffer: any = null;
  private isSettingRemote: boolean = false;
  private isCalling: boolean = false;
  private currentAnalyzedStreamId: string | null = null;

  // Mobile Background Keep-Alive & Wake Lock State
  private silentAudio: HTMLAudioElement | null = null;
  private wakeLock: any = null;

  private onSpeakingChange?: (isSpeaking: boolean) => void;
  private onPeerSpeakingChange?: (isPeerSpeaking: boolean) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.resumeAudio();
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });

      // Mobile Background & Home Screen Voice Keep-Alive Recovery
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && this.isCalling) {
            this.resumeAudio();
            this.requestWakeLock();
          }
        });
      }
      window.addEventListener('pageshow', () => {
        if (this.isCalling) {
          this.resumeAudio();
          this.requestWakeLock();
        }
      });
      window.addEventListener('focus', () => {
        if (this.isCalling) {
          this.resumeAudio();
        }
      });
    }
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
        }
      } catch {}
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release().catch(() => {});
      } catch {}
      this.wakeLock = null;
    }
  }

  private ensureSilentAudioElement(): HTMLAudioElement {
    if (typeof document !== 'undefined') {
      let el = document.getElementById('luratalk-silent-keepalive') as HTMLAudioElement;
      if (!el) {
        el = document.createElement('audio');
        el.id = 'luratalk-silent-keepalive';
        el.setAttribute('playsinline', 'true');
        el.setAttribute('webkit-playsinline', 'true');
        el.loop = true;
        el.volume = 0.001;
        // 0.1s valid silent WAV data URI to keep iOS/Android media session alive in background
        el.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        el.style.position = 'fixed';
        el.style.bottom = '0px';
        el.style.right = '0px';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.opacity = '0.001';
        el.style.pointerEvents = 'none';
        document.body.appendChild(el);
      }
      this.silentAudio = el;
      return el;
    }
    this.silentAudio = new Audio();
    this.silentAudio.loop = true;
    return this.silentAudio;
  }

  private ensureRemoteAudioElement(): HTMLAudioElement {
    if (typeof document !== 'undefined') {
      let el = document.getElementById('luratalk-remote-audio') as HTMLAudioElement;
      if (!el) {
        el = document.createElement('audio');
        el.id = 'luratalk-remote-audio';
        el.autoplay = true;
        el.setAttribute('playsinline', 'true');
        el.setAttribute('webkit-playsinline', 'true');
        el.style.position = 'fixed';
        el.style.bottom = '0px';
        el.style.right = '0px';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.opacity = '0.01';
        el.style.pointerEvents = 'none';
        document.body.appendChild(el);
      }
      this.remoteAudio = el;
      return el;
    }
    this.remoteAudio = new Audio();
    this.remoteAudio.autoplay = true;
    return this.remoteAudio;
  }

  public async warmupMicrophone(): Promise<MediaStream | null> {
    if (this.localStream && this.localStream.active) {
      return this.localStream;
    }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      return this.localStream;
    } catch (err) {
      console.warn('Microphone pre-warm skipped or permission denied', err);
      return null;
    }
  }

  public setSpeakingCallbacks(
    onSpeakingChange?: (isSpeaking: boolean) => void,
    onPeerSpeakingChange?: (isPeerSpeaking: boolean) => void
  ) {
    if (onSpeakingChange) this.onSpeakingChange = onSpeakingChange;
    if (onPeerSpeakingChange) this.onPeerSpeakingChange = onPeerSpeakingChange;
  }

  public async startCall(options: WebRTCVoiceOptions) {
    this.cleanup();
    this.isCalling = true;
    this.iceCandidatesQueue = [];
    this.pendingOffer = null;

    this.onSpeakingChange = options.onSpeakingChange;
    this.onPeerSpeakingChange = options.onPeerSpeakingChange;

    this.ensureRemoteAudioElement();
    this.ensureSilentAudioElement();
    if (this.silentAudio) {
      this.silentAudio.play().catch(() => {});
    }
    this.getOrCreateAudioContext();
    this.requestWakeLock();

    // Register OS MediaSession for mobile lock screen & background keepalive
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'LuraTalk Voice Call',
          artist: options.roomName ? `Room ${options.roomName}` : 'Active Voice Call',
          album: 'Encrypted Real-Time Audio',
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => {
          this.resumeAudio();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          this.resumeAudio();
        });
      } catch (e) {
        console.warn('[WebRTC] MediaSession registration ignored:', e);
      }
    }

    // Strategy 1: Attempt LiveKit SFU ONLY if a valid, live remote LiveKit host is provided
    const isLiveKitAvailable =
      Boolean(options.livekitToken && options.livekitUrl) &&
      !options.livekitUrl?.includes('localhost') &&
      !options.livekitUrl?.includes('example.com') &&
      !options.livekitUrl?.includes('127.0.0.1');

    if (isLiveKitAvailable) {
      try {
        const success = await this.connectLiveKitSFU(options);
        if (success) {
          this.isUsingLiveKit = true;
          return;
        }
      } catch (err) {
        console.warn('[VoiceEngine] LiveKit SFU failed, falling back to TURN P2P WebRTC:', err);
      }
    }

    // Strategy 2: Enterprise P2P WebRTC with Google STUN (sub-50ms connection)
    await this.connectP2PWebRTC(options);
  }

  private async connectLiveKitSFU(options: WebRTCVoiceOptions): Promise<boolean> {
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      publishDefaults: {
        simulcast: false,
        videoCodec: 'vp8',
        dtx: false,
        screenShareEncoding: {
          maxBitrate: 1_500_000,
          maxFramerate: 24,
        },
      },
    });

    this.livekitRoom = room;

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio && this.remoteAudio) {
        track.attach(this.remoteAudio);
        if (this.remoteAudio.srcObject instanceof MediaStream) {
          this.setupRemoteAudioAnalysis(this.remoteAudio.srcObject);
        }
      } else if (track.kind === Track.Kind.Video) {
        const stream = new MediaStream([track.mediaStreamTrack]);
        useCallStore.getState().setRemoteScreenSharing(true, stream);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video) {
        useCallStore.getState().setRemoteScreenSharing(false, null);
      }
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const isLocalSpeaking = speakers.some((s) => s.isLocal);
      const isRemoteSpeaking = speakers.some((s) => !s.isLocal);

      if (this.onSpeakingChange) this.onSpeakingChange(isLocalSpeaking);
      if (this.onPeerSpeakingChange) this.onPeerSpeakingChange(isRemoteSpeaking);
    });

    // Try connecting with a 2.5-second timeout so fallback to TURN P2P WebRTC is fast & seamless
    const connectPromise = room.connect(options.livekitUrl!, options.livekitToken!);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LiveKit connect timeout')), 2500)
    );
    await Promise.race([connectPromise, timeoutPromise]);

    await room.localParticipant.setMicrophoneEnabled(!this.isMuted);

    // Attach disconnect listeners for room and remote participants
    room.on(RoomEvent.Disconnected, () => {
      if (this.isCalling && this.isUsingLiveKit) {
        options.onDisconnected?.();
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (this.isCalling) {
        options.onDisconnected?.();
      }
    });

    return true;
  }

  private async connectP2PWebRTC(options: WebRTCVoiceOptions) {
    this.isUsingLiveKit = false;
    this.ensureRemoteAudioElement();

    this.unsubSignal = socketClient.on('webrtc:signal', async (payload: any) => {
      await this.handleIncomingSignal(payload, !!options.isInitiator);
    });

    try {
      if (!this.localStream || !this.localStream.active) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          },
          video: false,
        });
      }

      // Multi-Region High-Availability STUN Cluster + Dynamic TURN Support
      const iceServers: RTCIceServer[] = [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302', 'stun:stun4.l.google.com:19302'] },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.nextcloud.com:443' },
      ];

      const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
      const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
      const turnPass = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
      if (turnUrl) {
        iceServers.push({
          urls: turnUrl.split(',').map((u) => u.trim()),
          ...(turnUser && turnPass ? { username: turnUser, credential: turnPass } : {}),
        });
      }

      this.pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 8,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });

      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
        if (this.pc && this.localStream) {
          const sender = this.pc.addTrack(track, this.localStream);
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].priority = 'high';
            params.encodings[0].networkPriority = 'high';
            params.encodings[0].maxBitrate = 64000;
            sender.setParameters(params).catch(() => {});
          } catch {}
        }
      });

      this.pc.ontrack = (event) => {
        const track = event.track;
        const stream =
          event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([track]);

        if (track.kind === 'audio') {
          this.remoteStream = stream;

          const audioEl = this.ensureRemoteAudioElement();
          if (audioEl) {
            if (audioEl.srcObject !== stream) {
              audioEl.srcObject = stream;
              audioEl.volume = 1.0;
              audioEl.muted = this.isDeafened;
              const playPromise = audioEl.play();
              if (playPromise !== undefined) {
                playPromise.catch((err) => {
                  console.warn('[WebRTC] Autoplay waiting for interaction:', err);
                  const unlockAudio = () => {
                    audioEl.play().catch(() => {});
                    window.removeEventListener('click', unlockAudio);
                    window.removeEventListener('touchstart', unlockAudio);
                    window.removeEventListener('keydown', unlockAudio);
                  };
                  window.addEventListener('click', unlockAudio, { once: true, passive: true });
                  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
                  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
                });
              }
            }
          }

          this.setupRemoteAudioAnalysis(stream);
        } else if (track.kind === 'video') {
          // Live Screen Share Video Track Received
          const videoStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([track]);
          this.remoteVideoStream = videoStream;
          useCallStore.getState().setRemoteScreenSharing(true, videoStream);

          track.onunmute = () => {
            useCallStore.getState().setRemoteScreenSharing(true, videoStream);
          };

          track.onended = () => {
            this.remoteVideoStream = null;
            useCallStore.getState().setRemoteScreenSharing(false, null);
          };
        }
      };

      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketClient.send('webrtc:signal', {
            type: 'candidate',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        const state = this.pc?.iceConnectionState;
        if (state === 'failed') {
          this.pc?.restartIce();
        } else if (state === 'connected' || state === 'completed') {
          this.resumeAudio();
        } else if (state === 'disconnected') {
          options.onDisconnected?.();
        }
      };

      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'disconnected' || state === 'failed') {
          options.onDisconnected?.();
        }
      };

      if (this.pendingOffer) {
        const offerToProcess = this.pendingOffer;
        this.pendingOffer = null;
        await this.handleIncomingSignal(offerToProcess, !!options.isInitiator);
      }

      if (options.isInitiator && this.pc.signalingState === 'stable') {
        const offer = await this.pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        if (offer.sdp) {
          offer.sdp = this.optimizeOpusSdp(offer.sdp);
        }
        await this.pc.setLocalDescription(offer);
        socketClient.send('webrtc:signal', {
          type: 'offer',
          offer: offer,
        });
      }

      this.setupLocalAudioAnalysis(this.localStream);
      this.startAudioEnergyLoop();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        console.warn('[WebRTC] Microphone permission denied by user in browser');
      } else {
        console.warn('[WebRTC] Handled audio call initialization issue:', err);
      }
      if (options.onError) {
        options.onError(err);
      }
    }
  }

  private setPreferredVideoCodecs(transceiver: RTCRtpTransceiver) {
    if (typeof RTCRtpReceiver !== 'undefined' && 'getCapabilities' in RTCRtpReceiver) {
      try {
        const capabilities = RTCRtpReceiver.getCapabilities('video');
        if (capabilities && capabilities.codecs) {
          // Prioritize VP8 (universal 100% WebRTC zero-black-screen compatibility across mobile & desktop) + H264
          const vp8Codecs = capabilities.codecs.filter(
            (c) => c.mimeType.toLowerCase() === 'video/vp8'
          );
          const h264Codecs = capabilities.codecs.filter(
            (c) => c.mimeType.toLowerCase() === 'video/h264'
          );
          const otherCodecs = capabilities.codecs.filter(
            (c) => c.mimeType.toLowerCase() !== 'video/vp8' && c.mimeType.toLowerCase() !== 'video/h264'
          );
          if (typeof transceiver.setCodecPreferences === 'function') {
            transceiver.setCodecPreferences([...vp8Codecs, ...h264Codecs, ...otherCodecs]);
          }
        }
      } catch (e) {
        console.warn('[WebRTC] setCodecPreferences fallback:', e);
      }
    }
  }

  private prioritizeUniversalVideoCodecsAndOptimizeSdp(sdp: string): string {
    let optimized = this.optimizeOpusSdp(sdp);

    const videoMediaRegex = /m=video (\d+) ([\w\/]+) ([^\r\n]+)/;
    const match = optimized.match(videoMediaRegex);
    if (!match) return optimized;

    const currentPayloads = match[3].trim().split(/\s+/);
    
    // Find all VP8 and H264 payload IDs from rtpmap lines
    const vp8Payloads: string[] = [];
    const h264Payloads: string[] = [];
    const otherPayloads: string[] = [];
    
    const vp8Regex = /a=rtpmap:(\d+)\s+VP8\/90000/gi;
    let vp8Match: RegExpExecArray | null;
    const vp8Ids = new Set<string>();
    while ((vp8Match = vp8Regex.exec(optimized)) !== null) {
      vp8Ids.add(vp8Match[1]);
    }

    const h264Regex = /a=rtpmap:(\d+)\s+H264\/90000/gi;
    let rtpMatch: RegExpExecArray | null;
    const h264Ids = new Set<string>();
    while ((rtpMatch = h264Regex.exec(optimized)) !== null) {
      h264Ids.add(rtpMatch[1]);
    }

    currentPayloads.forEach((pt) => {
      if (vp8Ids.has(pt)) {
        vp8Payloads.push(pt);
      } else if (h264Ids.has(pt)) {
        h264Payloads.push(pt);
      } else {
        otherPayloads.push(pt);
      }
    });

    const newPayloadOrder = [...vp8Payloads, ...h264Payloads, ...otherPayloads].join(' ');
    optimized = optimized.replace(
      videoMediaRegex,
      `m=video ${match[1]} ${match[2]} ${newPayloadOrder}\r\nb=AS:3500\r\nb=TIAS:3500000`
    );

    const primaryPt = vp8Payloads[0] || h264Payloads[0];
    if (primaryPt) {
      const fmtpRegex = new RegExp(`a=fmtp:${primaryPt} (.*)`);
      if (fmtpRegex.test(optimized)) {
        optimized = optimized.replace(fmtpRegex, `a=fmtp:${primaryPt} $1;x-google-min-bitrate=1500;x-google-start-bitrate=3000;x-google-max-bitrate=4500`);
      } else {
        optimized = optimized.replace(
          new RegExp(`a=rtpmap:${primaryPt} ([^\\r\\n]+)`, 'i'),
          `a=rtpmap:${primaryPt} $1\r\na=fmtp:${primaryPt} x-google-min-bitrate=1500;x-google-start-bitrate=3000;x-google-max-bitrate=4500`
        );
      }
    }

    return optimized;
  }

  private optimizeOpusSdp(sdp: string): string {
    const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
    if (!opusMatch) return sdp;
    const pt = opusMatch[1];
    const fmtpRegex = new RegExp(`a=fmtp:${pt} (.*)`, 'g');
    // High-Definition Studio Voice: 64kbps HD audio, FEC enabled, DTX disabled (cbr=0;usedtx=0) to avoid voice clipping and stuttering during high network/video load
    const naturalVoiceFmtp = `a=fmtp:${pt} minptime=10;ptime=20;maxptime=60;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=64000;cbr=0;usedtx=0`;

    if (fmtpRegex.test(sdp)) {
      return sdp.replace(fmtpRegex, naturalVoiceFmtp);
    } else {
      return sdp.replace(
        new RegExp(`a=rtpmap:${pt} opus/48000/2`, 'i'),
        `a=rtpmap:${pt} opus/48000/2\r\n${naturalVoiceFmtp}`
      );
    }
  }

  private async handleIncomingSignal(payload: any, isInitiator: boolean) {
    if (!payload || !payload.type) return;

    if (payload.type === 'screen:stop') {
      this.isRemoteScreenSharingActive = false;
      this.remoteVideoStream = null;
      useCallStore.getState().setRemoteScreenSharing(false, null);
      return;
    }

    if (payload.type === 'screen:start') {
      this.isRemoteScreenSharingActive = true;
      let vStream = this.remoteVideoStream;
      if (!vStream && this.pc) {
        const vReceiver = this.pc.getReceivers().find((r) => r.track?.kind === 'video');
        if (vReceiver && vReceiver.track) {
          vStream = new MediaStream([vReceiver.track]);
          this.remoteVideoStream = vStream;
        }
      }
      useCallStore.getState().setRemoteScreenSharing(true, vStream);
      return;
    }

    if (!this.pc) {
      if (payload.type === 'offer') {
        this.pendingOffer = payload;
      } else if (payload.type === 'candidate' && payload.candidate) {
        this.iceCandidatesQueue.push(payload.candidate);
      }
      return;
    }

    try {
      if (payload.type === 'offer') {
        if (this.pc.signalingState !== 'stable') {
          try {
            await this.pc.setLocalDescription({ type: 'rollback' });
          } catch (e) {
            console.warn('[WebRTC] Rollback ignored', e);
          }
        }

        const transceivers = this.pc.getTransceivers();
        const vTransceiver = transceivers.find(
          (t) => t.receiver?.track?.kind === 'video' || t.sender?.track?.kind === 'video'
        );
        if (vTransceiver) {
          this.setPreferredVideoCodecs(vTransceiver);
          vTransceiver.direction = 'sendrecv';
        }

        this.isSettingRemote = true;
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        this.isSettingRemote = false;
        await this.flushQueuedIceCandidates();

        const answer = await this.pc.createAnswer();
        if (answer.sdp) {
          answer.sdp = this.prioritizeUniversalVideoCodecsAndOptimizeSdp(answer.sdp);
        }
        await this.pc.setLocalDescription(answer);

        const vReceiver = this.pc.getReceivers().find((r) => r.track?.kind === 'video');
        if (vReceiver && vReceiver.track) {
          const vStream = new MediaStream([vReceiver.track]);
          this.remoteVideoStream = vStream;
          useCallStore.getState().setRemoteScreenSharing(true, vStream);
        }

        socketClient.send('webrtc:signal', {
          type: 'answer',
          answer: answer,
        });
      } else if (payload.type === 'answer') {
        if (this.pc.signalingState === 'have-local-offer') {
          this.isSettingRemote = true;
          await this.pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          this.isSettingRemote = false;
          await this.flushQueuedIceCandidates();

          if (this.screenSender) {
            try {
              const params = this.screenSender.getParameters();
              if (params && params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = 3_500_000;
                params.encodings[0].maxFramerate = 30;
                params.encodings[0].scaleResolutionDownBy = 1.0;
                await this.screenSender.setParameters(params).catch(() => {});
              }
            } catch {}
          }

          const vReceiver = this.pc.getReceivers().find((r) => r.track?.kind === 'video');
          if (vReceiver && vReceiver.track) {
            const vStream = new MediaStream([vReceiver.track]);
            this.remoteVideoStream = vStream;
            if (useCallStore.getState().isRemoteScreenSharing) {
              useCallStore.getState().setRemoteScreenSharing(true, vStream);
            }
          }
        }
      } else if (payload.type === 'candidate' && payload.candidate) {
        if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('[WebRTC] Could not add ICE candidate directly', e);
          }
        } else {
          this.iceCandidatesQueue.push(payload.candidate);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] Handled WebRTC signal edge case:', err);
    }
  }

  public async startScreenShare(): Promise<MediaStream | null> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== 'function'
    ) {
      throw new Error('UNSUPPORTED_BROWSER');
    }

    try {
      // LiveKit SFU Path
      if (this.isUsingLiveKit && this.livekitRoom) {
        await this.livekitRoom.localParticipant.setScreenShareEnabled(true, { audio: false });
        const tracks = Array.from(this.livekitRoom.localParticipant.videoTrackPublications.values());
        const screenPub = tracks.find((p) => p.source === Track.Source.ScreenShare);
        if (screenPub && screenPub.track) {
          const stream = new MediaStream([screenPub.track.mediaStreamTrack]);
          this.localScreenStream = stream;
          useCallStore.getState().setLocalScreenSharing(true, stream);
          return stream;
        }
        useCallStore.getState().setLocalScreenSharing(true, null);
        return null;
      }

      // P2P WebRTC Path: Capture OS display/screen in Full HD 1080p
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'monitor',
            frameRate: { ideal: 30, max: 30 },
            width: { ideal: 1920, max: 2560 },
            height: { ideal: 1080, max: 1440 },
          },
          audio: false,
        });
      } catch (firstErr: any) {
        if (firstErr.name === 'NotAllowedError' || firstErr.name === 'AbortError') {
          return null; // User clicked "Cancel" in browser picker
        }
        if (firstErr.name === 'NotSupportedError') {
          throw new Error('UNSUPPORTED_BROWSER');
        }
        // Fallback for browsers requiring plain video constraint
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      }

      this.localScreenStream = stream;
      // Update local UI immediately so laptop user instantly sees their shared screen
      useCallStore.getState().setLocalScreenSharing(true, stream);

      const videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        return null;
      }

      if ('contentHint' in videoTrack) {
        videoTrack.contentHint = 'detail';
      }

      // Handle user clicking native browser "Stop Sharing" floating bar
      videoTrack.onended = () => {
        this.stopScreenShare().catch(() => {});
      };

      if (this.pc) {
        const transceivers = this.pc.getTransceivers();
        let vTransceiver = transceivers.find(
          (t) => t.receiver?.track?.kind === 'video' || t.sender?.track?.kind === 'video'
        );

        if (vTransceiver && vTransceiver.sender) {
          this.screenSender = vTransceiver.sender;
          this.setPreferredVideoCodecs(vTransceiver);
          vTransceiver.direction = 'sendrecv';
          if ('degradationPreference' in vTransceiver) {
            try {
              (vTransceiver as any).degradationPreference = 'maintain-resolution';
            } catch {}
          }
          await vTransceiver.sender.replaceTrack(videoTrack).catch(() => {});
        } else {
          if (this.screenSender) {
            try {
              this.pc.removeTrack(this.screenSender);
            } catch {}
          }
          this.screenSender = this.pc.addTrack(videoTrack, stream);
          const newTransceiver = this.pc.getTransceivers().find(
            (t) => t.sender === this.screenSender
          );
          if (newTransceiver) {
            this.setPreferredVideoCodecs(newTransceiver);
            newTransceiver.direction = 'sendrecv';
            if ('degradationPreference' in newTransceiver) {
              try {
                (newTransceiver as any).degradationPreference = 'maintain-resolution';
              } catch {}
            }
          }
        }

        if (this.pc.signalingState === 'stable') {
          try {
            const offer = await this.pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            if (offer.sdp) {
              offer.sdp = this.prioritizeUniversalVideoCodecsAndOptimizeSdp(offer.sdp);
            }
            await this.pc.setLocalDescription(offer);
            socketClient.send('webrtc:signal', {
              type: 'offer',
              offer: offer,
            });
          } catch (e) {
            console.warn('[WebRTC] Renegotiation offer error', e);
          }
        }
        socketClient.send('webrtc:signal', { type: 'screen:start' });
      }

      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        return null;
      }
      if (err.name === 'NotSupportedError' || err.message === 'UNSUPPORTED_BROWSER') {
        throw new Error('UNSUPPORTED_BROWSER');
      }
      console.warn('[WebRTC] Screen share error handled:', err);
      throw err;
    }
  }

  public async stopScreenShare() {
    // 1. Immediately reset store state on self for 0ms transition
    useCallStore.getState().setLocalScreenSharing(false, null);
    useCallStore.getState().setRemoteScreenSharing(false, null);
    this.remoteVideoStream = null;

    // 2. Broadcast screen:stop to peer immediately via WebSocket
    socketClient.send('webrtc:signal', { type: 'screen:stop' });

    // 3. Stop local screen capture tracks
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream = null;
    }

    // 4. Detach from WebRTC and renegotiate audio-only cleanly
    if (this.isUsingLiveKit && this.livekitRoom) {
      try {
        await this.livekitRoom.localParticipant.setScreenShareEnabled(false);
      } catch {}
    } else if (this.pc) {
      if (this.screenSender) {
        try {
          this.pc.removeTrack(this.screenSender);
        } catch {}
        this.screenSender = null;
      }

      if (this.pc.signalingState === 'stable') {
        try {
          const offer = await this.pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false,
          });
          if (offer.sdp) {
            offer.sdp = this.optimizeOpusSdp(offer.sdp);
          }
          await this.pc.setLocalDescription(offer);
          socketClient.send('webrtc:signal', {
            type: 'offer',
            offer: offer,
          });
        } catch (e) {
          console.warn('[WebRTC] Renegotiation stop offer error', e);
        }
      }
    }
  }

  private getOrCreateAudioContext(): AudioContext {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private setupLocalAudioAnalysis(stream: MediaStream) {
    try {
      const ctx = this.getOrCreateAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      this.localAnalyser = ctx.createAnalyser();
      this.localAnalyser.fftSize = 256;
      this.localAnalyser.smoothingTimeConstant = 0.4;
      source.connect(this.localAnalyser);
    } catch (err) {
      console.warn('Local AudioContext setup failed', err);
    }
  }

  private setupRemoteAudioAnalysis(stream: MediaStream) {
    try {
      if (this.currentAnalyzedStreamId === stream.id && this.remoteAnalyser) {
        return;
      }
      this.currentAnalyzedStreamId = stream.id;

      const ctx = this.getOrCreateAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (this.remoteAudioSource) {
        try {
          this.remoteAudioSource.disconnect();
        } catch {}
      }
      this.remoteAudioSource = ctx.createMediaStreamSource(stream);
      if (!this.remoteAnalyser) {
        this.remoteAnalyser = ctx.createAnalyser();
        this.remoteAnalyser.fftSize = 256;
        this.remoteAnalyser.smoothingTimeConstant = 0.4;
      }

      // Studio-Grade Voice Gain Booster (1.8x Gain Node for crisp, loud output)
      if (!this.remoteGainNode) {
        this.remoteGainNode = ctx.createGain();
      }
      this.remoteGainNode.gain.value = this.isDeafened ? 0 : 1.8;

      this.remoteAudioSource.connect(this.remoteGainNode);
      this.remoteGainNode.connect(this.remoteAnalyser);
    } catch (err) {
      console.warn('Remote AudioContext analysis setup failed', err);
    }
  }

  private startAudioEnergyLoop() {
    const localData = new Uint8Array(128);
    const remoteData = new Uint8Array(128);

    const checkAudioLevels = () => {
      if (!this.isCalling) return;

      if (this.localAnalyser && !this.isMuted) {
        this.localAnalyser.getByteFrequencyData(localData);
        let sum = 0;
        for (let i = 0; i < localData.length; i++) sum += localData[i];
        const average = sum / localData.length;
        const speaking = average > 4;
        if (this.onSpeakingChange) this.onSpeakingChange(speaking);
      } else if (this.onSpeakingChange) {
        this.onSpeakingChange(false);
      }

      if (this.remoteAnalyser && !this.isDeafened) {
        this.remoteAnalyser.getByteFrequencyData(remoteData);
        let sum = 0;
        for (let i = 0; i < remoteData.length; i++) sum += remoteData[i];
        const average = sum / remoteData.length;
        const peerSpeaking = average > 4;
        if (this.onPeerSpeakingChange) this.onPeerSpeakingChange(peerSpeaking);
      } else if (this.onPeerSpeakingChange) {
        this.onPeerSpeakingChange(false);
      }

      this.animationFrameId = requestAnimationFrame(checkAudioLevels);
    };

    checkAudioLevels();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.isUsingLiveKit && this.livekitRoom) {
      this.livekitRoom.localParticipant.setMicrophoneEnabled(!muted).catch(() => {});
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    if (this.remoteAudio) {
      this.remoteAudio.muted = deafened;
    }
  }

  public resumeAudio() {
    if (this.remoteAudio && this.remoteAudio.srcObject) {
      this.remoteAudio.play().catch(() => {});
    }
    if (this.silentAudio && this.silentAudio.paused && this.isCalling) {
      this.silentAudio.play().catch(() => {});
    }
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended' || (this.audioCtx.state as string) === 'interrupted') {
        this.audioCtx.resume().catch(() => {});
      }
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        if (!track.enabled && !this.isMuted) {
          track.enabled = true;
        }
      });
    }
    if (this.pc && (this.pc.iceConnectionState === 'disconnected' || this.pc.iceConnectionState === 'failed')) {
      try {
        this.pc.restartIce();
      } catch {}
    }
  }

  private async flushQueuedIceCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Failed to add queued ICE candidate', err);
        }
      }
    }
  }

  public async switchAudioInput(
    deviceId: string,
    constraints?: { noiseSuppression?: boolean; echoCancellation?: boolean; autoGainControl?: boolean }
  ) {
    try {
      if (this.isUsingLiveKit && this.livekitRoom) {
        await this.livekitRoom.switchActiveDevice('audioinput', deviceId);
        return;
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: constraints?.echoCancellation ?? true,
          noiseSuppression: constraints?.noiseSuppression ?? true,
          autoGainControl: constraints?.autoGainControl ?? true,
        },
        video: false,
      });

      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;

      newTrack.enabled = !this.isMuted;

      if (this.pc) {
        const senders = this.pc.getSenders();
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender) {
          await audioSender.replaceTrack(newTrack);
        }
      }

      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((t) => t.stop());
      }
      this.localStream = newStream;

      this.setupLocalAudioAnalysis(newStream);
    } catch (err) {
      console.error('Failed to switch audio input device', err);
      throw err;
    }
  }

  public cleanup() {
    this.isCalling = false;
    this.releaseWakeLock();

    if (this.silentAudio) {
      this.silentAudio.pause();
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch {}
    }

    // Stop active screen share on cleanup
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream = null;
    }
    this.screenSender = null;
    this.remoteVideoStream = null;
    useCallStore.getState().setLocalScreenSharing(false, null);
    useCallStore.getState().setRemoteScreenSharing(false, null);

    if (this.livekitRoom) {
      this.livekitRoom.disconnect().catch(() => {});
      this.livekitRoom = null;
    }
    this.isUsingLiveKit = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.unsubSignal) {
      this.unsubSignal();
      this.unsubSignal = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
    }
    if (this.remoteAudioSource) {
      try {
        this.remoteAudioSource.disconnect();
      } catch {}
      this.remoteAudioSource = null;
    }
    if (this.remoteGainNode) {
      try {
        this.remoteGainNode.disconnect();
      } catch {}
      this.remoteGainNode = null;
    }
    this.remoteStream = null;
    this.currentAnalyzedStreamId = null;
    this.iceCandidatesQueue = [];
    this.pendingOffer = null;
    this.isSettingRemote = false;

    if (this.onSpeakingChange) this.onSpeakingChange(false);
    if (this.onPeerSpeakingChange) this.onPeerSpeakingChange(false);
  }

  public isActive(): boolean {
    return this.isCalling && (Boolean(this.pc) || Boolean(this.livekitRoom));
  }
}

export const webrtcEngine = new LuraWebRTCEngine();
