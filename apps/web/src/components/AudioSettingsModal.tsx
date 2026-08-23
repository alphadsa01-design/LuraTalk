'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Sliders,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { webrtcEngine } from '@/lib/webrtc';
import { sounds } from '@/lib/sounds';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AudioSettingsModal({ isOpen, onClose }: AudioSettingsModalProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);
  const [soundFxEnabled, setSoundFxEnabled] = useState(true);
  const [micVolume, setMicVolume] = useState(0);

  const testStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Load available audio devices
  const loadDevices = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
      setDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Failed to enumerate audio devices', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDevices();
      startMicTest();
    } else {
      stopMicTest();
    }
    return () => {
      stopMicTest();
    };
  }, [isOpen, selectedDeviceId]);

  // Live microphone level test meter
  const startMicTest = async () => {
    stopMicTest();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });
      testStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicVolume(Math.min(100, Math.round((average / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch {
      // Permission or device not available for test
    }
  };

  const stopMicTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    setMicVolume(0);
  };

  const handleDeviceChange = async (deviceId: string) => {
    sounds.playClick();
    setSelectedDeviceId(deviceId);
    await webrtcEngine.switchAudioInput(deviceId, {
      echoCancellation,
      noiseSuppression,
      autoGainControl,
    });
  };

  const handleToggleNoiseSuppression = async () => {
    sounds.playClick();
    const nextVal = !noiseSuppression;
    setNoiseSuppression(nextVal);
    await webrtcEngine.switchAudioInput(selectedDeviceId, {
      echoCancellation,
      noiseSuppression: nextVal,
      autoGainControl,
    });
  };

  const handleToggleEchoCancellation = async () => {
    sounds.playClick();
    const nextVal = !echoCancellation;
    setEchoCancellation(nextVal);
    await webrtcEngine.switchAudioInput(selectedDeviceId, {
      echoCancellation: nextVal,
      noiseSuppression,
      autoGainControl,
    });
  };

  const handleToggleAutoGain = async () => {
    sounds.playClick();
    const nextVal = !autoGainControl;
    setAutoGainControl(nextVal);
    await webrtcEngine.switchAudioInput(selectedDeviceId, {
      echoCancellation,
      noiseSuppression,
      autoGainControl: nextVal,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md glass-panel-glow border border-primary/40 rounded-3xl p-5 sm:p-6 shadow-2xl bg-surface/95 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 flex items-center justify-center shadow-md">
                <Sliders className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Audio &amp; Voice Settings</h3>
                <p className="text-[11px] text-gray-400">Microphone and signal processing</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-surfaceLight hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Input Device Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-secondary" />
                <span>Microphone Device</span>
              </span>
              <button
                onClick={loadDevices}
                className="text-[10px] text-secondary hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Refresh</span>
              </button>
            </label>

            {devices.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Default system microphone</p>
            ) : (
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-surfaceLight border border-white/10 text-white text-xs font-semibold focus:border-secondary outline-none transition-colors"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId} className="bg-slate-900 text-white">
                    {device.label || `Microphone ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}

            {/* Live Mic Test Meter */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>Input Level Test:</span>
                <span>{micVolume}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/50 border border-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-400 via-secondary to-accent-pink"
                  style={{ width: `${micVolume}%` }}
                  transition={{ ease: 'easeOut', duration: 0.05 }}
                />
              </div>
            </div>
          </div>

          {/* 2. Signal Processing Toggles */}
          <div className="space-y-2.5 pt-1">
            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
              Audio Enhancements
            </label>

            {/* AI Noise Suppression */}
            <button
              onClick={handleToggleNoiseSuppression}
              className={`w-full p-3 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all bg-transparent ${
                noiseSuppression
                  ? 'border-white text-white'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-white">AI Noise Suppression</div>
                  <div className="text-[10px] text-gray-400">Eliminates background fan &amp; room noise</div>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  noiseSuppression ? 'border-white text-white' : 'border-white/20'
                }`}
              >
                {noiseSuppression && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>

            {/* Echo Cancellation */}
            <button
              onClick={handleToggleEchoCancellation}
              className={`w-full p-3 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all bg-transparent ${
                echoCancellation
                  ? 'border-white text-white'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <Volume2 className="w-4 h-4 text-white flex-shrink-0" />
                <div>
                  <div className="font-bold text-white">Echo Cancellation</div>
                  <div className="text-[10px] text-gray-400">Prevents audio feedback when on speaker</div>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  echoCancellation ? 'border-white text-white' : 'border-white/20'
                }`}
              >
                {echoCancellation && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>

            {/* Auto Gain Control */}
            <button
              onClick={handleToggleAutoGain}
              className={`w-full p-3 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all bg-transparent ${
                autoGainControl
                  ? 'border-white text-white'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <Sparkles className="w-4 h-4 text-white flex-shrink-0" />
                <div>
                  <div className="font-bold text-white">Auto Volume Leveling</div>
                  <div className="text-[10px] text-gray-400">Automatically normalizes quiet speech</div>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  autoGainControl ? 'border-white text-white' : 'border-white/20'
                }`}
              >
                {autoGainControl && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>
          </div>

          {/* Close Action */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-6 py-2.5 rounded-xl bg-transparent hover:bg-white/10 text-white text-xs font-bold border border-white/40 hover:border-white active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
