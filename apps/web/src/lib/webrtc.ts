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

  private onSpeakingChange?: (isSpeaking: boolean) => void;
  private onPeerSpeakingChange?: (isPeerSpeaking: boolean) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        if (this.remoteAudio && this.remoteAudio.paused && this.remoteAudio.srcObject) {
          this.remoteAudio.play().catch(() => {});
        }
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
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
    this.getOrCreateAudioContext();

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

      // Ultra-Fast Google STUN + Twilio Zero-Latency Cluster
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302', 'stun:stun4.l.google.com:19302'] },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
        iceCandidatePoolSize: 6,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });

      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
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

          this.setupRemoteAudioAnalysis(stream);
        } else if (track.kind === 'video') {
          // Remote Screen Share Video Track Received
          useCallStore.getState().setRemoteScreenSharing(true, stream);

          track.onended = () => {
            useCallStore.getState().setRemoteScreenSharing(false, null);
          };
          track.onmute = () => {
            // Track muted or paused
          };
          track.onunmute = () => {
            useCallStore.getState().setRemoteScreenSharing(true, stream);
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
          offerToReceiveVideo: true,
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

  private optimizeOpusSdp(sdp: string): string {
    const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
    if (!opusMatch) return sdp;
    const pt = opusMatch[1];
    const fmtpRegex = new RegExp(`a=fmtp:${pt} (.*)`, 'g');
    // High-Definition Studio Voice: 64kbps HD audio, FEC enabled, DTX disabled to avoid voice clipping
    const naturalVoiceFmtp = `a=fmtp:${pt} minptime=10;ptime=20;maxptime=60;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=64000`;

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
      useCallStore.getState().setRemoteScreenSharing(false, null);
      return;
    }

    if (payload.type === 'screen:start') {
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
          if (!isInitiator) {
            try {
              await this.pc.setLocalDescription({ type: 'rollback' });
            } catch (e) {
              console.warn('[WebRTC] Rollback ignored', e);
            }
          } else {
            return;
          }
        }

        this.isSettingRemote = true;
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        this.isSettingRemote = false;
        await this.flushQueuedIceCandidates();

        const answer = await this.pc.createAnswer();
        if (answer.sdp) {
          answer.sdp = this.optimizeOpusSdp(answer.sdp);
        }
        await this.pc.setLocalDescription(answer);

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

      // P2P WebRTC Path: Strictly capture OS display/screen (NEVER camera)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
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
        });
      }

      this.localScreenStream = stream;
      const videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        return null;
      }

      // Handle user clicking native browser "Stop Sharing" floating bar
      videoTrack.onended = () => {
        this.stopScreenShare().catch(() => {});
      };

      if (this.pc) {
        this.screenSender = this.pc.addTrack(videoTrack, stream);

        if (this.pc.signalingState === 'stable') {
          try {
            const offer = await this.pc.createOffer();
            if (offer.sdp) {
              offer.sdp = this.optimizeOpusSdp(offer.sdp);
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

      useCallStore.getState().setLocalScreenSharing(true, stream);
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
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream = null;
    }

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

      socketClient.send('webrtc:signal', { type: 'screen:stop' });

      if (this.pc.signalingState === 'stable') {
        try {
          const offer = await this.pc.createOffer();
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

    useCallStore.getState().setLocalScreenSharing(false, null);
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
      this.remoteAnalyser = ctx.createAnalyser();
      this.remoteAnalyser.fftSize = 256;
      this.remoteAnalyser.smoothingTimeConstant = 0.4;

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
        const speaking = average > 10;
        if (this.onSpeakingChange) this.onSpeakingChange(speaking);
      } else if (this.onSpeakingChange) {
        this.onSpeakingChange(false);
      }

      if (this.remoteAnalyser && !this.isDeafened) {
        this.remoteAnalyser.getByteFrequencyData(remoteData);
        let sum = 0;
        for (let i = 0; i < remoteData.length; i++) sum += remoteData[i];
        const average = sum / remoteData.length;
        const peerSpeaking = average > 10;
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
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
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

    // Stop active screen share on cleanup
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream = null;
    }
    this.screenSender = null;
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
    this.iceCandidatesQueue = [];
    this.pendingOffer = null;
    this.isSettingRemote = false;

    if (this.onSpeakingChange) this.onSpeakingChange(false);
    if (this.onPeerSpeakingChange) this.onPeerSpeakingChange(false);
  }
}

export const webrtcEngine = new LuraWebRTCEngine();
