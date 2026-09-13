import React, { useState, useEffect } from 'react';
import { Square, Pause, Play, Mic, MicOff, Trash2, GripVertical } from 'lucide-react';

interface RecordingSessionBarProps {
  isRecording: boolean;
  countdownSeconds?: number | null;
  initialMicActive?: boolean;
  onStop: (seconds: number) => void;
  onDiscard: () => void;
}

export const RecordingSessionBar: React.FC<RecordingSessionBarProps> = ({
  isRecording,
  countdownSeconds = null,
  initialMicActive = true,
  onStop,
  onDiscard
}) => {
  const [seconds, setSeconds] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [micActive, setMicActive] = useState<boolean>(initialMicActive);

  useEffect(() => {
    if (isRecording) {
      setMicActive(initialMicActive);
      setSeconds(0);
      setIsPaused(false);
    }
  }, [isRecording, initialMicActive]);

  useEffect(() => {
    let timer: any = null;
    if (isRecording && !isPaused && countdownSeconds === null) {
      timer = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, isPaused, countdownSeconds]);

  if (!isRecording && countdownSeconds === null) return null;

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 8px',
        boxSizing: 'border-box'
      }}
    >
      <div
        data-tauri-drag-region
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 16px',
          borderRadius: 'var(--apple-rounded-pill)',
          background: 'rgba(20, 20, 22, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          userSelect: 'none',
          pointerEvents: 'auto',
          cursor: 'grab'
        }}
      >
        <div
          data-tauri-drag-region
          title="Drag to reposition recording bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            opacity: 0.5,
            cursor: 'grab'
          }}
        >
          <GripVertical size={15} color="#ffffff" />
        </div>

        {countdownSeconds !== null && countdownSeconds > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 8px' }}>
            <span className="record-dot-animated" />
            <span style={{ fontFamily: 'var(--apple-font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
              Starting in {countdownSeconds}s...
            </span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="record-dot-animated" />
              <span style={{ fontFamily: 'var(--apple-font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
                {formatTime(seconds)}
              </span>
            </div>

            <div className="divider-vertical" />

            <button
              className="icon-btn"
              title={isPaused ? 'Resume' : 'Pause'}
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} />}
            </button>

            <button
              className="icon-btn"
              title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
              onClick={() => setMicActive(!micActive)}
            >
              {micActive ? <Mic size={14} color="var(--apple-primary-on-dark)" /> : <MicOff size={14} color="var(--apple-ink-muted-48)" />}
            </button>

            <div className="divider-vertical" />

            <button
              onClick={() => onStop(seconds)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 14px',
                borderRadius: 'var(--apple-rounded-pill)',
                background: 'var(--apple-system-red)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 12,
                fontFamily: 'var(--apple-font-text)',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255, 59, 48, 0.4)',
                transition: 'var(--apple-transition-micro)'
              }}
            >
              <Square size={10} fill="currentColor" />
              <span>Done</span>
            </button>

            <button className="icon-btn" title="Discard Recording" onClick={onDiscard}>
              <Trash2 size={13} color="var(--apple-system-red)" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
