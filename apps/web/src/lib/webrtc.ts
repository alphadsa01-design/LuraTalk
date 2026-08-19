// AuraVoice Real-Time WebRTC Voice & Audio Engine

import { socketClient } from '@/lib/socket';

export interface WebRTCVoiceOptions {
  isInitiator: boolean;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onPeerSpeakingChange?: (isPeerSpeaking: boolean) => void;
  onError?: (err: Error) => void;
}

class AuraWebRTCEngine {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private unsubSignal: (() => void) | null = null;

  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];

  private onSpeakingChange?: (isSpeaking: boolean) => void;
  private onPeerSpeakingChange?: (isPeerSpeaking: boolean) => void;

  private ensureRemoteAudioElement(): HTMLAudioElement {
    if (typeof document !== 'undefined') {
      let el = document.getElementById('auravoice-remote-audio') as HTMLAudioElement;
      if (!el) {
        el = document.createElement('audio');
        el.id = 'auravoice-remote-audio';
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

  public async startCall(options: WebRTCVoiceOptions) {
    this.cleanup();
    this.iceCandidatesQueue = [];

    this.onSpeakingChange = options.onSpeakingChange;
    this.onPeerSpeakingChange = options.onPeerSpeakingChange;

    try {
      // 1. Get Local Microphone Stream with Noise Suppression & AutoGain
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      // 2. Prepare Remote Audio Receiver Element in DOM
      const remoteAudioEl = this.ensureRemoteAudioElement();

      // 3. Initialize RTCPeerConnection with Global High-Availability STUN Servers
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
        iceCandidatePoolSize: 10,
      });

      // Add bidirectional audio transceiver
      this.pc.addTransceiver('audio', { direction: 'sendrecv' });

      // Add local audio tracks to peer connection
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });

      // Handle incoming remote audio track
      this.pc.ontrack = (event) => {
        const stream =
          event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([event.track]);

        if (this.remoteAudio) {
          this.remoteAudio.srcObject = stream;
          this.remoteAudio.muted = this.isDeafened;
          this.remoteAudio
            .play()
            .then(() => {
              console.log('Remote audio playback started successfully');
            })
            .catch((err) => {
              console.warn('Autoplay prevented remote audio, attaching user gesture listener', err);
              const resume = () => {
                this.remoteAudio?.play().catch(() => {});
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                  this.audioCtx.resume().catch(() => {});
                }
                document.removeEventListener('click', resume);
                document.removeEventListener('touchstart', resume);
              };
              document.addEventListener('click', resume, { once: true });
              document.addEventListener('touchstart', resume, { once: true });
            });

          this.setupRemoteAudioAnalysis(stream);
        }
      };

      // Handle ICE Candidates
      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketClient.send('webrtc:signal', {
            type: 'candidate',
            candidate: event.candidate,
          });
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        console.log('WebRTC ICE Connection State:', this.pc?.iceConnectionState);
        if (this.pc?.iceConnectionState === 'failed') {
          this.pc.restartIce();
        }
      };

      // 4. Listen for Incoming WebRTC Signals from Peer
      this.unsubSignal = socketClient.on('webrtc:signal', async (payload: any) => {
        if (!this.pc) return;

        try {
          if (payload.type === 'offer') {
            const isOfferCollision =
              this.pc.signalingState !== 'stable' &&
              this.pc.signalingState !== 'have-remote-offer';

            if (isOfferCollision) {
              if (!options.isInitiator) {
                await this.pc.setLocalDescription({ type: 'rollback' } as any);
              } else {
                return;
              }
            }

            await this.pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            await this.flushQueuedIceCandidates();

            if (this.pc.signalingState === 'have-remote-offer') {
              const answer = await this.pc.createAnswer();
              await this.pc.setLocalDescription(answer);
              socketClient.send('webrtc:signal', {
                type: 'answer',
                answer: answer,
              });
            }
          } else if (payload.type === 'answer') {
            if (this.pc.signalingState === 'have-local-offer') {
              await this.pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
              await this.flushQueuedIceCandidates();
            }
          } else if (payload.type === 'candidate' && payload.candidate) {
            if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
              await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else {
              this.iceCandidatesQueue.push(payload.candidate);
            }
          }
        } catch (err) {
          console.warn('Handled WebRTC signal edge case', err);
        }
      });

      // 5. If Initiator, create & send Offer
      if (options.isInitiator && this.pc.signalingState === 'stable') {
        const offer = await this.pc.createOffer({
          offerToReceiveAudio: true,
        });
        await this.pc.setLocalDescription(offer);
        socketClient.send('webrtc:signal', {
          type: 'offer',
          offer: offer,
        });
      }

      // 6. Setup Audio Energy Analysis for Visualizers
      this.setupLocalAudioAnalysis(this.localStream);
      this.startAudioEnergyLoop();
    } catch (err: any) {
      console.error('Failed to initialize WebRTC audio call', err);
      if (options.onError) {
        options.onError(err);
      }
    }
  }

  private setupLocalAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.localAnalyser = this.audioCtx.createAnalyser();
      this.localAnalyser.fftSize = 256;
      source.connect(this.localAnalyser);
    } catch (err) {
      console.warn('Local AudioContext setup failed', err);
    }
  }

  private setupRemoteAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.remoteAnalyser = this.audioCtx.createAnalyser();
      this.remoteAnalyser.fftSize = 256;
      source.connect(this.remoteAnalyser);
    } catch (err) {
      console.warn('Remote AudioContext analysis setup failed', err);
    }
  }

  private startAudioEnergyLoop() {
    const localData = new Uint8Array(128);
    const remoteData = new Uint8Array(128);

    const checkAudioLevels = () => {
      // Local Speaking Detection
      if (this.localAnalyser && !this.isMuted) {
        this.localAnalyser.getByteFrequencyData(localData);
        let sum = 0;
        for (let i = 0; i < localData.length; i++) sum += localData[i];
        const average = sum / localData.length;
        const speaking = average > 12;
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
        const peerSpeaking = average > 12;
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
    if (this.remoteAudio) {
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
    deviceId?: string,
    options?: {
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
      autoGainControl?: boolean;
    }
  ) {
    const echoCancellation = options?.echoCancellation ?? true;
    const noiseSuppression = options?.noiseSuppression ?? true;
    const autoGainControl = options?.autoGainControl ?? true;

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation,
        noiseSuppression,
        autoGainControl,
      };

      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      const newAudioTrack = newStream.getAudioTracks()[0];
      newAudioTrack.enabled = !this.isMuted;

      if (this.pc) {
        const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newAudioTrack);
        }
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
      }
      this.localStream = newStream;
      this.setupLocalAudioAnalysis(newStream);

      return true;
    } catch (err) {
      console.warn('Failed to switch audio input device', err);
      return false;
    }
  }

  public cleanup() {
    this.iceCandidatesQueue = [];

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.unsubSignal) {
      this.unsubSignal();
      this.unsubSignal = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.localAnalyser = null;
    this.remoteAnalyser = null;
  }
}

export const webrtcEngine = new AuraWebRTCEngine();
