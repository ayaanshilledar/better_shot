import React, { useState, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Scissors, 
  RotateCcw, 
  Sparkles, 
  Download, 
  Film, 
  Clock, 
  Check
} from 'lucide-react';
import { RecordingHistoryItem, VideoEditConfig } from '../types/recorder';

interface VideoEditorProps {
  item: RecordingHistoryItem;
  onBack: () => void;
  onToast: (msg: string) => void;
}

export const VideoEditor: React.FC<VideoEditorProps> = ({ item, onBack, onToast }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Convert OS local file path to Tauri Webview asset URL safely
  const normalizedPath = item.filePath ? item.filePath.replace(/\\/g, '/') : '';
  const videoSrc = convertFileSrc(normalizedPath);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(item.durationSeconds || 0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume] = useState<number>(1);

  // Video edit configuration state
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(item.durationSeconds || 0);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Initialize duration and trim end when video metadata is loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDuration = videoRef.current.duration;
      if (vidDuration && !isNaN(vidDuration)) {
        setDuration(vidDuration);
        if (trimEnd === 0 || trimEnd > vidDuration) {
          setTrimEnd(vidDuration);
        }
      }
    }
  };

  // Enforce playback inside trim bounds
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    // If playhead reaches or exceeds trimEnd, loop back to trimStart
    if (time >= trimEnd) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Ensure playing starts inside trim range
      if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    onToast(nextMuted ? 'Video audio muted' : 'Video audio unmuted');
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  };

  const handleSetTrimStartToCurrent = () => {
    if (currentTime < trimEnd) {
      setTrimStart(currentTime);
      onToast(`Trim start set to ${formatTime(currentTime)}`);
    } else {
      onToast('Trim start must be before trim end');
    }
  };

  const handleSetTrimEndToCurrent = () => {
    if (currentTime > trimStart) {
      setTrimEnd(currentTime);
      onToast(`Trim end set to ${formatTime(currentTime)}`);
    } else {
      onToast('Trim end must be after trim start');
    }
  };

  const handleNudgeTrimStart = (delta: number) => {
    const next = Math.max(0, Math.min(trimStart + delta, trimEnd - 0.2));
    setTrimStart(next);
    if (videoRef.current) {
      videoRef.current.currentTime = next;
    }
  };

  const handleNudgeTrimEnd = (delta: number) => {
    const next = Math.min(duration, Math.max(trimEnd + delta, trimStart + 0.2));
    setTrimEnd(next);
    if (videoRef.current) {
      videoRef.current.currentTime = next;
    }
  };

  const handleResetTrim = () => {
    setTrimStart(0);
    setTrimEnd(duration);
    setIsMuted(false);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.currentTime = 0;
    }
    onToast('Video edits reset to original');
  };

  const handleSaveEdits = () => {
    setIsSaved(true);
    const config: VideoEditConfig = {
      isMuted,
      trimStartSeconds: trimStart,
      trimEndSeconds: trimEnd,
      durationSeconds: duration,
      volume
    };
    localStorage.setItem(`bs_edits_${item.id}`, JSON.stringify(config));
    onToast('Video edits saved as draft');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const formatTime = (sec: number): string => {
    if (isNaN(sec) || sec < 0) return '00:00.0';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const trimmedDuration = Math.max(0, trimEnd - trimStart);
  const isTrimmed = trimStart > 0 || (duration > 0 && trimEnd < duration - 0.05);

  return (
    <div className="video-editor-container">
      {/* 1. Header Bar */}
      <div className="editor-header">
        <div className="editor-header-left">
          <button className="editor-btn-secondary" onClick={onBack} title="Back to Launcher">
            <ArrowLeft size={16} />
            <span>Launcher</span>
          </button>
          <div className="editor-title-group">
            <h2 className="editor-filename" title={item.fileName}>{item.fileName}</h2>
            <div className="editor-meta-badges">
              <span className="editor-badge">
                <Film size={12} />
                {item.mode === 'fullscreen' ? 'Full Screen' : 'Region'}
              </span>
              {item.width && item.height && (
                <span className="editor-badge">{item.width} × {item.height}</span>
              )}
              {isTrimmed && (
                <span className="editor-badge badge-active">
                  <Scissors size={12} />
                  Trimmed ({formatTime(trimmedDuration)})
                </span>
              )}
              {isMuted && (
                <span className="editor-badge badge-muted">
                  <VolumeX size={12} />
                  Muted
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="editor-header-actions">
          <button 
            className={`editor-btn-primary ${isSaved ? 'btn-success' : ''}`}
            onClick={handleSaveEdits}
          >
            {isSaved ? <Check size={16} /> : <Sparkles size={16} />}
            <span>{isSaved ? 'Edits Saved' : 'Save Edits'}</span>
          </button>

          <div className="export-btn-wrapper">
            <button className="editor-btn-export" disabled title="Export engine coming in Phase 2">
              <Download size={16} />
              <span>Export Video</span>
            </button>
            <span className="export-phase-badge">Phase 2</span>
          </div>
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      <div className="editor-main-layout">
        {/* Left / Center: Video Preview Player */}
        <div className="editor-player-card">
          <div className="video-preview-wrapper">
            <video
              ref={videoRef}
              src={videoSrc}
              className="video-element"
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              onError={(e) => console.error('Video player load error:', e, 'videoSrc:', videoSrc)}
              onClick={togglePlay}
            />

            {!isPlaying && (
              <button className="video-overlay-play-btn" onClick={togglePlay} aria-label="Play Video">
                <Play size={32} fill="white" />
              </button>
            )}

            {isMuted && (
              <div className="video-muted-overlay-indicator">
                <VolumeX size={18} />
                <span>Audio Muted</span>
              </div>
            )}
          </div>

          {/* Player Transport Bar */}
          <div className="player-transport-bar">
            <button className="transport-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button className={`transport-btn ${isMuted ? 'active-mute' : ''}`} onClick={toggleMute} title="Toggle Audio Mute">
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <div className="transport-time-display">
              <Clock size={14} />
              <span>{formatTime(currentTime)}</span>
              <span className="time-divider">/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Custom Seekbar Slider */}
            <div className="seekbar-container">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.05}
                value={currentTime}
                onChange={handleSeek}
                className="seekbar-range"
              />
              {/* Highlight active trim region on seekbar track */}
              <div
                className="seekbar-trim-highlight"
                style={{
                  left: `${(trimStart / (duration || 1)) * 100}%`,
                  width: `${((trimEnd - trimStart) / (duration || 1)) * 100}%`
                }}
              />
            </div>

            <button className="transport-btn" onClick={handleResetTrim} title="Reset Edits">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Right Side: Editing Options Sidebar */}
        <div className="editor-sidebar-panel">
          {/* Option A: Mute Audio Control */}
          <div className="editor-panel-card">
            <div className="card-header-row">
              <div className="card-title-group">
                {isMuted ? <VolumeX className="icon-muted" size={18} /> : <Volume2 className="icon-active" size={18} />}
                <h3>Audio Options</h3>
              </div>
              <label className="toggle-switch-wrapper">
                <input
                  type="checkbox"
                  checked={isMuted}
                  onChange={toggleMute}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <p className="card-description">
              {isMuted 
                ? 'Video audio is muted. Exported video will contain no sound track.' 
                : 'Original audio track (microphone & system sound) is active.'}
            </p>

            <div className="audio-status-pill">
              <span className={`status-dot ${isMuted ? 'dot-red' : 'dot-green'}`} />
              <span>{isMuted ? 'Audio Track Muted' : 'Audio Track Active'}</span>
            </div>
          </div>

          {/* Option B: Video Trimmer / Frame Cutter */}
          <div className="editor-panel-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <Scissors className="icon-accent" size={18} />
                <h3>Cut & Trim Frame</h3>
              </div>
              {isTrimmed && (
                <button className="btn-text-reset" onClick={handleResetTrim}>
                  Reset
                </button>
              )}
            </div>

            <p className="card-description">
              Trim unwanted start/end frames of the video recording.
            </p>

            {/* Start Cut Control */}
            <div className="trim-point-box">
              <div className="point-label-row">
                <span className="point-name">Start Frame</span>
                <span className="point-val">{formatTime(trimStart)}</span>
              </div>
              <div className="point-actions">
                <button className="btn-nudge" onClick={() => handleNudgeTrimStart(-0.1)}>-0.1s</button>
                <button className="btn-nudge" onClick={() => handleNudgeTrimStart(0.1)}>+0.1s</button>
                <button className="btn-set-current" onClick={handleSetTrimStartToCurrent}>
                  Set to Playhead
                </button>
              </div>
            </div>

            {/* End Cut Control */}
            <div className="trim-point-box">
              <div className="point-label-row">
                <span className="point-name">End Frame</span>
                <span className="point-val">{formatTime(trimEnd)}</span>
              </div>
              <div className="point-actions">
                <button className="btn-nudge" onClick={() => handleNudgeTrimEnd(-0.1)}>-0.1s</button>
                <button className="btn-nudge" onClick={() => handleNudgeTrimEnd(0.1)}>+0.1s</button>
                <button className="btn-set-current" onClick={handleSetTrimEndToCurrent}>
                  Set to Playhead
                </button>
              </div>
            </div>

            {/* Summary Box */}
            <div className="trim-summary-box">
              <div className="summary-row">
                <span>Original Duration:</span>
                <span className="summary-val">{formatTime(duration)}</span>
              </div>
              <div className="summary-row summary-bold">
                <span>Trimmed Clip:</span>
                <span className="summary-val-highlight">{formatTime(trimmedDuration)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
