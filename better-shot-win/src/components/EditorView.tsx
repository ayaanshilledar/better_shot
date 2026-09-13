import React, { useState, useRef, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ArrowLeft,
  X,
  Play,
  Pause,
  FolderOpen,
  Copy,
  ExternalLink,
  Sliders,
  Volume2,
  VolumeX,
  Video,
  Layers,
  Scissors,
  Download
} from 'lucide-react';
import { RecordingHistoryItem } from '../types/recorder';

interface EditorViewProps {
  item: RecordingHistoryItem;
  onBack: () => void;
  onRevealInExplorer: (path: string) => void;
  onPlayNative: (path: string) => void;
  onToast: (msg: string) => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  item,
  onBack,
  onRevealInExplorer,
  onPlayNative,
  onToast
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(item.durationSeconds || 0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'inspector' | 'canvas' | 'audio' | 'trim'>('inspector');

  const videoSrc = convertFileSrc(item.filePath);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      } else if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || item.durationSeconds || 0);
    }
  };

  const handleSeek = (newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(item.filePath);
    onToast('File path copied to clipboard');
  };

  const handleHeaderMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) {
      return;
    }
    try {
      await invoke('drag_window');
    } catch {
      try {
        await getCurrentWindow().startDragging();
      } catch {}
    }
  };

  const formatTimecode = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="editor-window">
      {/* ─── Top Header ─────────────────────────────────────────────── */}
      <div
        className="editor-header"
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
      >
        {/* Left: Back to Launcher & Title */}
        <div className="editor-header-left">
          <button
            type="button"
            className="action-btn"
            onClick={onBack}
            title="Return to Launcher (Esc)"
          >
            <ArrowLeft size={13} />
            <span>Launcher</span>
          </button>

          <div className="editor-title-group" data-tauri-drag-region>
            <span className="record-dot-animated" />
            <span className="editor-brand-name">BetterShot</span>
            <span className="editor-title-divider">/</span>
            <span className="editor-file-name" title={item.filePath}>
              {item.fileName}
            </span>
            {item.width && item.height && (
              <span className="editor-badge">
                {item.width}×{item.height}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions & Close */}
        <div className="editor-header-right">
          <button
            type="button"
            className="icon-btn"
            onClick={() => onRevealInExplorer(item.filePath)}
            title="Reveal in Explorer"
          >
            <FolderOpen size={14} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => onPlayNative(item.filePath)}
            title="Open in default video player"
          >
            <ExternalLink size={14} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={handleCopyPath}
            title="Copy path"
          >
            <Copy size={14} />
          </button>

          <button
            type="button"
            className="action-btn primary editor-export-btn"
            onClick={() => onToast(`Export ready for ${item.fileName}`)}
            title="Export Video"
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={async () => {
              try {
                await invoke('close_app_window');
              } catch {
                onBack();
              }
            }}
            title="Close Window"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ─── Main Workspace: Left Sidebar + Center Preview Canvas ────── */}
      <div className="editor-workspace">
        {/* Left Side Component (Sidebar) */}
        <aside className="editor-sidebar">
          {/* Sidebar Navigation Tabs */}
          <div className="editor-sidebar-tabs">
            <button
              type="button"
              className={`editor-tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
              onClick={() => setActiveTab('inspector')}
              title="Inspector"
            >
              <Sliders size={13} />
              <span>Inspector</span>
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${activeTab === 'canvas' ? 'active' : ''}`}
              onClick={() => setActiveTab('canvas')}
              title="Canvas Settings"
            >
              <Layers size={13} />
              <span>Canvas</span>
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
              onClick={() => setActiveTab('audio')}
              title="Audio"
            >
              <Volume2 size={13} />
              <span>Audio</span>
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${activeTab === 'trim' ? 'active' : ''}`}
              onClick={() => setActiveTab('trim')}
              title="Trim / Cuts"
            >
              <Scissors size={13} />
              <span>Trim</span>
            </button>
          </div>

          {/* Sidebar Body - Kept clean / empty for now per request */}
          <div className="editor-sidebar-content">
            <div className="editor-placeholder-box">
              <Sliders size={28} opacity={0.3} />
              <span className="editor-placeholder-title">
                {activeTab === 'inspector' && 'Clip Inspector'}
                {activeTab === 'canvas' && 'Canvas & Ratio'}
                {activeTab === 'audio' && 'Audio Levels'}
                {activeTab === 'trim' && 'Trim & Cut Points'}
              </span>
              <p className="editor-placeholder-desc">
                Tools and parameter adjustments will appear here.
              </p>

              {/* Minimal structural parameters ready for future feature hookups */}
              <div className="editor-sidebar-empty-card">
                <div className="editor-prop-row">
                  <span className="editor-prop-label">Duration</span>
                  <span className="editor-prop-val">{item.durationSeconds > 0 ? `${item.durationSeconds}s` : '00:00'}</span>
                </div>
                <div className="editor-prop-row">
                  <span className="editor-prop-label">Resolution</span>
                  <span className="editor-prop-val">{item.width ? `${item.width} × ${item.height}` : 'Native'}</span>
                </div>
                <div className="editor-prop-row">
                  <span className="editor-prop-label">Speed</span>
                  <span className="editor-prop-val">1.0×</span>
                </div>
                <div className="editor-prop-row">
                  <span className="editor-prop-label">Volume</span>
                  <span className="editor-prop-val">100%</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Preview Canvas */}
        <main className="editor-canvas">
          <div className="editor-canvas-stage">
            <video
              ref={videoRef}
              src={videoSrc}
              className="editor-video-element"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={togglePlay}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Play Overlay if Paused */}
            {!isPlaying && (
              <div className="editor-play-overlay" onClick={togglePlay}>
                <div className="editor-play-badge">
                  <Play size={20} fill="#ffffff" color="#ffffff" style={{ marginLeft: 3 }} />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ─── Bottom Timeline Component (Kept empty for now per request) ── */}
      <div className="editor-timeline">
        {/* Timeline Controls & Timecode Bar */}
        <div className="editor-timeline-toolbar">
          <div className="editor-timeline-playback">
            <button
              type="button"
              className="icon-btn editor-playback-btn"
              onClick={togglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            <div className="editor-timecode-display">
              <span className="timecode-current">{formatTimecode(currentTime)}</span>
              <span className="timecode-divider">/</span>
              <span className="timecode-duration">{formatTimecode(duration)}</span>
            </div>
          </div>

          <div className="editor-timeline-zoom">
            <span style={{ fontSize: 11, color: 'var(--apple-ink-muted-48)', fontFamily: 'var(--apple-font-mono)' }}>
              100% Zoom
            </span>
          </div>
        </div>

        {/* Timeline Tracks Area (Clean empty track ready for edits) */}
        <div className="editor-timeline-tracks-container">
          {/* Timeline Ruler Header with Playhead Marker */}
          <div
            className="editor-timeline-ruler"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              handleSeek(ratio * duration);
            }}
          >
            <div
              className="editor-timeline-playhead-line"
              style={{ left: `${progressPercent}%` }}
            >
              <div className="editor-playhead-handle" />
            </div>

            <div className="editor-ruler-ticks">
              <span>00:00</span>
              <span>{formatTimecode(duration * 0.25).slice(0, 5)}</span>
              <span>{formatTimecode(duration * 0.5).slice(0, 5)}</span>
              <span>{formatTimecode(duration * 0.75).slice(0, 5)}</span>
              <span>{formatTimecode(duration).slice(0, 5)}</span>
            </div>
          </div>

          {/* Timeline Track Rows */}
          <div className="editor-tracks-scroll">
            <div className="editor-track-row">
              <div className="editor-track-header">
                <Video size={13} color="var(--apple-primary, #0071e3)" />
                <span className="editor-track-name">Track 1</span>
              </div>
              <div
                className="editor-track-lane"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  handleSeek(ratio * duration);
                }}
              >
                {/* Active Clip Preview Strip */}
                <div
                  className="editor-track-clip"
                  style={{
                    width: '100%',
                    left: 0
                  }}
                >
                  <span className="editor-clip-label">{item.fileName}</span>
                </div>

                {/* Vertical Playhead Cursor across track */}
                <div
                  className="editor-track-playhead-cursor"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Secondary Empty Track Placeholder for edits */}
            <div className="editor-track-row empty-track">
              <div className="editor-track-header">
                <Layers size={13} opacity={0.4} />
                <span className="editor-track-name" style={{ opacity: 0.4 }}>Track 2</span>
              </div>
              <div className="editor-track-lane empty-lane">
                <span className="editor-empty-track-msg">Timeline track ready for overlay / audio edits</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
