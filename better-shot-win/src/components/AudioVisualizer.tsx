import React, { useEffect, useState, useRef } from 'react';

interface AudioVisualizerProps {
  enabled: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ enabled }) => {
  const [level, setLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          if (!isMounted || !streamRef.current) return;
          analyser.getByteFrequencyData(buffer);

          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
          }
          const avg = sum / buffer.length;
          // Normalize to 0..1 scale with sensitivity curve
          const norm = Math.min(1, Math.pow(avg / 128, 1.2));
          setLevel(norm);

          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (e) {
        // Fallback or permission dismissed - graceful fallback
        if (isMounted) setLevel(0);
      }
    }

    initAudio();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  // 4 Level bars representing mic volume
  const bars = [0.15, 0.35, 0.65, 0.9];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 14,
        padding: '0 2px'
      }}
      title="Live Microphone Level"
    >
      {bars.map((threshold, idx) => {
        const isActive = level >= threshold;
        const heightPercent = 25 + idx * 25;
        return (
          <div
            key={idx}
            style={{
              width: 3,
              height: `${heightPercent}%`,
              borderRadius: 1,
              backgroundColor: isActive
                ? idx === 3
                  ? 'var(--apple-system-orange, #ff9500)'
                  : 'var(--apple-system-green, #34c759)'
                : 'rgba(255, 255, 255, 0.15)',
              boxShadow: isActive ? '0 0 4px rgba(52, 199, 89, 0.4)' : 'none',
              transition: 'background-color 0.08s ease, height 0.08s ease'
            }}
          />
        );
      })}
    </div>
  );
};
