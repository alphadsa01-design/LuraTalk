// LuraTalk Real-Time WebRTC Voice & Audio Engine (Ultra-Low Latency + Race-Proof)

import { socketClient } from '@/lib/socket';

export interface WebRTCVoiceOptions {
  isInitiator: boolean;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onPeerSpeakingChange?: (isPeerSpeaking: boolean) => void;
  onError?: (err: Error) => void;
}

class LuraWebRTCEngine {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private unsubSignal: (() => void) | null = null;

  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private remoteAudioSource: MediaStreamAudioSourceNode | null = null;
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
      // Pre-bind unlock listeners for mobile / Chrome autoplay policies
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
        el.style.top = '-9999px';
        el.style.left = '-9999px';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.opacity = '0';
        document.body.appendChild(el);
      }
      this.remoteAudio = el;
      return el;
    }
    this.remoteAudio = new Audio();
    this.remoteAudio.autoplay = true;
    return this.remoteAudio;
  }

  /**
   * Pre-warms microphone access so connecting to a match is instant (<100ms)
   */
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

  public async startCall(options: WebRTCVoiceOptions) {
    this.cleanup();
    this.isCalling = true;
    this.iceCandidatesQueue = [];
    this.pendingOffer = null;

    this.onSpeakingChange = options.onSpeakingChange;
    this.onPeerSpeakingChange = options.onPeerSpeakingChange;

    // 1. Prepare Audio Element & AudioContext immediately
    this.ensureRemoteAudioElement();
    this.getOrCreateAudioContext();

    // 2. Register Signal Listener IMMEDIATELY before async getUserMedia
    // This prevents dropping the peer's offer during microphone acquisition!
    this.unsubSignal = socketClient.on('webrtc:signal', async (payload: any) => {
      await this.handleIncomingSignal(payload, options.isInitiator);
    });

    try {
      // 3. Acquire Local Microphone (or use pre-warmed stream)
      if (!this.localStream || !this.localStream.active) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        });
      }

      // 4. Initialize RTCPeerConnection with low-latency STUN pool
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
        iceCandidatePoolSize: 8,
        bundlePolicy: 'max-bundle',
      });

      // Add local audio track directly to RTCPeerConnection (automatically configures bidirectional transceiver)
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });

      // Handle incoming remote audio track
      this.pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote audio track:', event.track.id, 'Kind:', event.track.kind);
        const stream =
          event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([event.track]);

        this.remoteStream = stream;

        // Route 1: Direct High-Fidelity HTMLAudioElement (Primary audio pipeline)
        if (this.remoteAudio) {
          this.remoteAudio.srcObject = stream;
          this.remoteAudio.volume = 1.0;
          this.remoteAudio.muted = this.isDeafened;
          const playPromise = this.remoteAudio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn('[WebRTC] Autoplay prevented remote audio, awaiting user gesture:', err);
              const unlockAudio = () => {
                this.remoteAudio?.play().catch(() => {});
                document.removeEventListener('click', unlockAudio);
                document.removeEventListener('touchstart', unlockAudio);
              };
              document.addEventListener('click', unlockAudio, { once: true });
              document.addEventListener('touchstart', unlockAudio, { once: true });
            });
          }
        }

        // Route 2: Visual Frequency & Speech Detection Analyser ONLY (Never piped to destination to prevent echo)
        this.setupRemoteAudioAnalysis(stream);
      };

      // Handle local ICE candidates
      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketClient.send('webrtc:signal', {
            type: 'candidate',
            candidate: event.candidate,
          });
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        const state = this.pc?.iceConnectionState;
        console.log('[WebRTC] ICE Connection State:', state);
        if (state === 'failed') {
          console.warn('[WebRTC] ICE connection failed, restarting ICE');
          this.pc?.restartIce();
        } else if (state === 'connected' || state === 'completed') {
          this.resumeAudio();
        }
      };

      // 5. If we received an offer while microphone was initializing, process it now!
      if (this.pendingOffer) {
        const offerToProcess = this.pendingOffer;
        this.pendingOffer = null;
        await this.handleIncomingSignal(offerToProcess, options.isInitiator);
      }

      // 6. If Initiator, create & broadcast Offer immediately
      if (options.isInitiator && this.pc.signalingState === 'stable') {
        const offer = await this.pc.createOffer({
          offerToReceiveAudio: true,
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

      // 7. Setup Visualizers & Voice Activity Detection
      this.setupLocalAudioAnalysis(this.localStream);
      this.startAudioEnergyLoop();
    } catch (err: any) {
      console.error('Failed to initialize WebRTC audio call', err);
      if (options.onError) {
        options.onError(err);
      }
    }
  }

  private optimizeOpusSdp(sdp: string): string {
    // Locate Opus payload type in SDP (e.g. 111)
    const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
    if (!opusMatch) return sdp;
    const pt = opusMatch[1];

    const fmtpRegex = new RegExp(`a=fmtp:${pt} (.*)`, 'g');
    // Standard 20ms packetization prevents NetEQ jitter buffer time-stretching & robotic distortion
    const naturalVoiceFmtp = `a=fmtp:${pt} minptime=20;ptime=20;maxptime=40;useinbandfec=1;usedtx=1;stereo=0;sprop-stereo=0;maxaveragebitrate=32000`;

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

    // If peer connection isn't ready yet, buffer the signal
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
        // Handle glare / offer collision gracefully
        if (this.pc.signalingState !== 'stable') {
          if (!isInitiator) {
            try {
              await this.pc.setLocalDescription({ type: 'rollback' });
            } catch (e) {
              console.warn('[WebRTC] Rollback ignored', e);
            }
          } else {
            // Initiator ignores incoming offer collision
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
      if (this.remoteAudioSource) {
        try {
          this.remoteAudioSource.disconnect();
        } catch {}
      }
      // Clone stream so visual analysis does not resample or jitter the HTMLAudioElement playback
      const clonedStream = stream.clone();
      this.remoteAudioSource = ctx.createMediaStreamSource(clonedStream);
      this.remoteAnalyser = ctx.createAnalyser();
      this.remoteAnalyser.fftSize = 256;
      this.remoteAnalyser.smoothingTimeConstant = 0.4;
      // Connect ONLY to analyser node for visual waves (NEVER to destination to prevent echo)
      this.remoteAudioSource.connect(this.remoteAnalyser);
    } catch (err) {
      console.warn('Remote AudioContext analysis setup failed', err);
    }
  }

  private startAudioEnergyLoop() {
    const localData = new Uint8Array(128);
    const remoteData = new Uint8Array(128);

    const checkAudioLevels = () => {
      if (!this.isCalling) return;

      // Local Speaking Detection
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

      // Remote Peer Speaking Detection
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
      console.log('Audio input device switched successfully:', deviceId);
    } catch (err) {
      console.error('Failed to switch audio input device', err);
      throw err;
    }
  }

  public cleanup() {
    this.isCalling = false;
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
    this.remoteStream = null;
    this.iceCandidatesQueue = [];
    this.pendingOffer = null;
    this.isSettingRemote = false;

    if (this.onSpeakingChange) this.onSpeakingChange(false);
    if (this.onPeerSpeakingChange) this.onPeerSpeakingChange(false);
  }
}

export const webrtcEngine = new LuraWebRTCEngine();
