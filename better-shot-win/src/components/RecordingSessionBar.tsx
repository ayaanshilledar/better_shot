import React, { useState, useEffect } from 'react';
import { Square, Pause, Play, Mic, MicOff, Trash2, GripVertical } from 'lucide-react';

interface RecordingSessionBarProps {
  isRecording: boolean;
  initialMicActive?: boolean;
  onStop: (seconds: number) => void;
  onDiscard: () => void;
}

export const RecordingSessionBar: React.FC<RecordingSessionBarProps> = ({
  isRecording,
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

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    let timer: any = null;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, isPaused]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  if (!isRecording) return null;

  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--apple-space-sm)',
        padding: '8px 18px',
        borderRadius: 'var(--apple-rounded-pill)',
        background: 'rgba(22, 22, 24, 0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        zIndex: 2000,
        userSelect: 'none',
        animation: 'appleSlideUpToast 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div
        onMouseDown={handleDragHandleMouseDown}
        title="Drag to reposition bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          padding: '4px',
          borderRadius: 'var(--apple-rounded-xs)',
          opacity: 0.6,
          transition: 'var(--apple-transition-micro)'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
      >
        <GripVertical size={16} color="#ffffff" />
      </div>

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
        {isPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}
      </button>

      <button
        className="icon-btn"
        title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
        onClick={() => setMicActive(!micActive)}
      >
        {micActive ? <Mic size={15} color="var(--apple-primary-on-dark)" /> : <MicOff size={15} color="var(--apple-ink-muted-48)" />}
      </button>

      <div className="divider-vertical" />

      <button
        onClick={() => onStop(seconds)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 16px',
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
        <Square size={11} fill="currentColor" />
        <span>Done</span>
      </button>

      <button className="icon-btn" title="Discard Recording" onClick={onDiscard}>
        <Trash2 size={14} color="var(--apple-system-red)" />
      </button>
    </div>
  );
};
