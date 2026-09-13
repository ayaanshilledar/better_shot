import React, { useState, useEffect } from 'react';
import { Square, Pause, Play, Mic, MicOff, Trash2, GripVertical } from 'lucide-react';
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
        padding: '0 8px',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        cursor: 'grab'
      }}
    >
      <div
        data-tauri-drag-region
        onMouseDown={handleStartDrag}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px',
          borderRadius: 'var(--apple-rounded-pill)',
          background: 'rgba(20, 20, 22, 0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          userSelect: 'none',
          pointerEvents: 'auto',
          cursor: 'grab'
        }}
      >
        {/* Drag Grip */}
        <div
          data-tauri-drag-region
          onMouseDown={handleStartDrag}
          title="Drag to reposition"
          style={{
            display: 'flex',
            alignItems: 'center',
            opacity: 0.45,
            cursor: 'grab',
            padding: '2px',
            marginRight: -2
          }}
        >
          <GripVertical size={14} color="#ffffff" />
        </div>

        {countdownSeconds !== null && countdownSeconds > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px' }}>
            <span className="record-dot-animated" />
            <span style={{ fontFamily: 'var(--apple-font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
              {countdownSeconds}s
            </span>
          </div>
        ) : (
          <>
            {/* Timer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
              <span className="record-dot-animated" />
              <span style={{ fontFamily: 'var(--apple-font-mono)', fontSize: 12, fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
                {formatTime(seconds)}
              </span>
            </div>

            <div className="divider-vertical" style={{ height: 14, opacity: 0.3 }} />

            {/* Pause / Resume */}
            <button
              className="icon-btn"
              title={isPaused ? 'Resume' : 'Pause'}
              onClick={() => setIsPaused(!isPaused)}
              style={{ width: 26, height: 26, padding: 0 }}
            >
              {isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
            </button>

            {/* Mic Mute / Unmute */}
            <button
              className="icon-btn"
              title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
              onClick={() => setMicActive(!micActive)}
              style={{ width: 26, height: 26, padding: 0 }}
            >
              {micActive ? <Mic size={13} color="var(--apple-primary-on-dark)" /> : <MicOff size={13} color="var(--apple-ink-muted-48)" />}
            </button>

            <div className="divider-vertical" style={{ height: 14, opacity: 0.3 }} />

            {/* Minimal Stop & Save (Clean red circle with white square, no text) */}
            <button
              title="Stop & Save Recording"
              onClick={() => onStop(seconds)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--apple-system-red, #ff3b30)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255, 59, 48, 0.45)',
                transition: 'var(--apple-transition-micro)',
                flexShrink: 0
              }}
            >
              <Square size={9} fill="#ffffff" color="#ffffff" />
            </button>

            {/* Discard */}
            <button
              className="icon-btn"
              title="Discard Recording"
              onClick={onDiscard}
              style={{ width: 26, height: 26, padding: 0 }}
            >
              <Trash2 size={13} color="var(--apple-system-red)" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
