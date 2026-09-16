import React, { useEffect, useState, useRef } from 'react';

interface CountdownOverlayProps {
  initialCount?: number;
  onFinish: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  initialCount = 3,
  onFinish
}) => {
  const [count, setCount] = useState<number>(initialCount);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTickSound = (isFinal: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFinal ? 1040 : 720, ctx.currentTime);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isFinal ? 0.22 : 0.14));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + (isFinal ? 0.22 : 0.14));
    } catch {
      // Ignore audio context autoplay restrictions gracefully
    }
  };

  useEffect(() => {
    if (count > 0) {
      playTickSound(false);
    } else if (count === 0) {
      playTickSound(true);
      onFinish();
      return;
    }

    const timer = setInterval(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [count, onFinish]);

  return (
    <div className="countdown-overlay">
      <div key={count} className="countdown-number">
        {count > 0 ? count : ''}
      </div>
    </div>
  );
};
