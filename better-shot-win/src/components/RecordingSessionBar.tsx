import React, { useState, useEffect } from 'react';
import { Square, Pause, Play, Mic, MicOff, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

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

  const handleStartDrag = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) {
      return;
    }

    try {
      await invoke('drag_window');
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.startDragging();
      } catch (err) {
        console.warn('Native drag error:', err);
      }
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleStartDrag}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        cursor: 'grab'
      }}
    >
      <div
        data-tauri-drag-region
        onMouseDown={handleStartDrag}
        className="recording-session-bar"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 14px',
          borderRadius: '9999px',
          background: '#161618',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          userSelect: 'none',
          pointerEvents: 'auto',
          cursor: 'grab'
        }}
      >
        {countdownSeconds !== null && countdownSeconds > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 8px' }}>
            <span className="record-dot-animated" />
            <span style={{ fontFamily: 'var(--apple-font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
              {countdownSeconds}
            </span>
          </div>
        ) : (
          <>
            {/* Live Recording Dot & Monospace Timer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
              <span className="record-dot-animated" />
              <span style={{ fontFamily: 'var(--apple-font-mono)', fontSize: 13, fontWeight: 600, color: '#ffffff', letterSpacing: '0.04em' }}>
                {formatTime(seconds)}
              </span>
            </div>

            <div style={{ width: 1, height: 14, background: 'var(--apple-divider-dark)', margin: '0 2px' }} />

            {/* Pause / Resume Button */}
            <button
              type="button"
              className="icon-btn"
              title={isPaused ? 'Resume' : 'Pause'}
              onClick={() => setIsPaused(!isPaused)}
              style={{ width: 28, height: 28, borderRadius: '50%' }}
            >
              {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
            </button>

            {/* Mic Toggle Button */}
            <button
              type="button"
              className="icon-btn"
              title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
              onClick={() => setMicActive(!micActive)}
              style={{ width: 28, height: 28, borderRadius: '50%' }}
            >
              {micActive ? <Mic size={13} color="var(--apple-primary-on-dark)" /> : <MicOff size={13} color="var(--apple-ink-muted-48)" />}
            </button>

            {/* Stop & Save Action Button */}
            <button
              type="button"
              title="Stop & Save Recording"
              onClick={() => onStop(seconds)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--apple-system-red)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(255, 59, 48, 0.45)',
                transition: 'var(--apple-transition-micro)',
                flexShrink: 0,
                marginLeft: 2
              }}
            >
              <Square size={10} fill="#ffffff" color="#ffffff" />
            </button>

            {/* Discard / Delete Action Button */}
            <button
              type="button"
              className="icon-btn"
              title="Discard Recording"
              onClick={onDiscard}
              style={{ width: 28, height: 28, borderRadius: '50%' }}
            >
              <Trash2 size={13} color="var(--apple-system-red)" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
