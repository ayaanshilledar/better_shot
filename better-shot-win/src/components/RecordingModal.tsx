import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Monitor,
  Crop,
  Play,
  X,
  Clock,
  Video,
  FolderOpen,
  Trash2,
  Copy,
  Mic,
  Volume2,
  ChevronRight,
  ChevronDown,
  Check,
  ArrowLeft,
  Circle,
  Settings,
  Scissors
} from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { CaptureSource, RecordingConfig, RecordingHistoryItem } from '../types/recorder';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecord: (config: RecordingConfig) => void;
  history: RecordingHistoryItem[];
  onDeleteHistoryItem: (id: string, filePath: string) => void;
  onClearHistory: () => void;
  onToast: (msg: string) => void;
  onOpenInEditor?: (item: RecordingHistoryItem) => void;
  initialView?: 'launcher' | 'history' | 'settings';
}

export const RecordingModal: React.FC<RecordingModalProps> = ({
  isOpen,
  onClose,
  onStartRecord,
  history,
  onDeleteHistoryItem,
  onClearHistory,
  onToast,
  onOpenInEditor,
  initialView = 'launcher'
}) => {
  const [view, setView] = useState<'launcher' | 'history' | 'settings'>(initialView);
  const [source, setSource] = useState<CaptureSource>('fullscreen');
  const [savePath, setSavePath] = useState<string>(() => {
    return localStorage.getItem('bs_save_path') || 'C:\\Users\\Public\\Pictures';
  });

  const [micEnabled, setMicEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('bs_mic_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [systemAudioEnabled, setSystemAudioEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('bs_system_audio_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [selectedMic, setSelectedMic] = useState<string>(() => {
    return localStorage.getItem('bs_selected_mic') || 'Built-in Microphone';
  });

  const [countdownEnabled, setCountdownEnabled] = useState<boolean>(() => {
    return localStorage.getItem('bs_countdown_enabled') !== 'false';
  });

  const [availableMics, setAvailableMics] = useState<string[]>([
    'Built-in Microphone',
    'External Microphone (Realtek Audio)',
    'Headset Microphone',
    'Default System Audio Device'
  ]);
  const [isMicPickerOpen, setIsMicPickerOpen] = useState<boolean>(false);

  const handleSetView = (nextView: 'launcher' | 'history' | 'settings') => {
    setView(nextView);
    invoke('set_window_mode', { mode: nextView }).catch(() => {});
  };

  const handleToggleCountdown = () => {
    const next = !countdownEnabled;
    setCountdownEnabled(next);
    localStorage.setItem('bs_countdown_enabled', String(next));
    onToast(next ? 'Countdown enabled (3s)' : 'Countdown disabled (starts immediately)');
  };

  const handleChangeFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_folder');
      if (selected) {
        setSavePath(selected);
        localStorage.setItem('bs_save_path', selected);
        onToast(`Save destination: ${selected}`);
      }
    } catch (e) {
      console.error('Folder selection error:', e);
    }
  };

  useEffect(() => {
    setView(initialView);
    invoke('set_window_mode', { mode: initialView }).catch(() => {});
  }, [initialView, isOpen]);

  // Query actual microphone device names when available
  useEffect(() => {
    async function enumerateAudioDevices() {
      try {
        if (navigator?.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const mics = devices
            .filter((d) => d.kind === 'audioinput' && d.label)
            .map((d) => d.label);
          if (mics.length > 0) {
            const unique = Array.from(new Set(mics));
            setAvailableMics((prev) => Array.from(new Set([...unique, ...prev])));
          }
        }
      } catch (err) {
        console.warn('Audio device enumeration note:', err);
      }
    }
    enumerateAudioDevices();
  }, []);

  // Keyboard navigation: Enter to start, Escape to close/back
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMicPickerOpen) {
          setIsMicPickerOpen(false);
        } else if (view !== 'launcher') {
          handleSetView('launcher');
        } else {
          onClose();
        }
      } else if (e.key === 'Enter' && view === 'launcher' && !isMicPickerOpen) {
        handleStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, isMicPickerOpen, source, micEnabled, systemAudioEnabled, selectedMic, savePath]);

  if (!isOpen) return null;

  const handleToggleMic = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = !micEnabled;
    setMicEnabled(next);
    localStorage.setItem('bs_mic_enabled', String(next));
    if (!next) {
      setIsMicPickerOpen(false);
    }
  };

  const handleToggleSystemAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = !systemAudioEnabled;
    setSystemAudioEnabled(next);
    localStorage.setItem('bs_system_audio_enabled', String(next));
  };

  const handleSelectMic = (micName: string) => {
    setSelectedMic(micName);
    localStorage.setItem('bs_selected_mic', micName);
    setIsMicPickerOpen(false);
    onToast(`Microphone: ${micName}`);
  };

  const handleStart = () => {
    localStorage.setItem('bs_save_path', savePath);
    localStorage.setItem('bs_mic_enabled', String(micEnabled));
    localStorage.setItem('bs_system_audio_enabled', String(systemAudioEnabled));
    localStorage.setItem('bs_selected_mic', selectedMic);
    onStartRecord({
      mode: source,
      savePath,
      micEnabled,
      systemAudioEnabled,
      selectedMic
    });
  };

  const handlePlayRecording = async (path: string) => {
    try {
      await invoke('open_file', { path });
    } catch (err) {
      console.error('Failed to open video:', err);
      onToast(`Failed to open video: ${err}`);
    }
  };

  const handleShowInFolder = async (path: string) => {
    try {
      await invoke('show_in_folder', { path });
    } catch (err) {
      console.error('Failed to reveal folder:', err);
      onToast(`Failed to reveal folder: ${err}`);
    }
  };

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      onToast('File path copied');
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  const formatResolution = (item: RecordingHistoryItem) => {
    if (item.width && item.height) {
      return `${item.width} × ${item.height} px`;
    }
    if (item.mode === 'fullscreen') {
      return 'Full Screen';
    }
    return 'Custom Region';
  };

  return (
    <div
      className="recording-modal-frame"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '16px 20px',
        background: 'var(--apple-surface-tile-1)',
        backdropFilter: 'var(--apple-backdrop-blur)',
        WebkitBackdropFilter: 'var(--apple-backdrop-blur)',
        border: '1px solid var(--apple-hairline-dark)',
        borderRadius: 'var(--apple-rounded-lg)',
        boxShadow: 'var(--apple-modal-shadow)',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div
        className="modal-header"
        data-tauri-drag-region
        onMouseDown={async (e) => {
          if (e.button === 0 && !(e.target as HTMLElement).closest('button, input, a')) {
            try {
              await invoke('drag_window');
            } catch {
              try {
                await getCurrentWindow().startDragging();
              } catch {}
            }
          }
        }}
        style={{ cursor: 'grab' }}
      >
        {view !== 'launcher' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="action-btn"
              onClick={() => handleSetView('launcher')}
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {view === 'history' ? 'Recording History' : 'Settings'}
            </span>
          </div>
        ) : (
          <div className="modal-title" data-tauri-drag-region>
            <span className="record-dot-animated" />
            <h3 data-tauri-drag-region>BetterShot</h3>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {view === 'launcher' && (
            <>
              <button
                className="icon-btn"
                onClick={() => handleSetView('history')}
                title={`Recording History (${history.length})`}
                style={{ position: 'relative' }}
              >
                <Clock size={15} />
                {history.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: 'var(--apple-primary, #0071e3)',
                    }}
                  />
                )}
              </button>

              <button
                className="icon-btn"
                onClick={() => handleSetView('settings')}
                title="Settings"
              >
                <Settings size={15} />
              </button>
            </>
          )}

          {view === 'history' && (
            <button
              className="icon-btn"
              onClick={() => handleSetView('settings')}
              title="Settings"
            >
              <Settings size={15} />
            </button>
          )}

          {view === 'settings' && (
            <button
              className="icon-btn"
              onClick={() => handleSetView('history')}
              title={`Recording History (${history.length})`}
              style={{ position: 'relative' }}
            >
              <Clock size={15} />
              {history.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'var(--apple-primary, #0071e3)',
                  }}
                />
              )}
            </button>
          )}

          <button className="icon-btn" onClick={onClose} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>
      </div>

        {/* ─── LAUNCHER VIEW ─────────────────────────────────────────────── */}
        {view === 'launcher' && (
          <div className="launcher-container">
            {/* Hero Message */}
            <div className="launcher-hero">
              <h2 className="launcher-heading">Ready to record?</h2>
              <p className="launcher-subheading">Capture your screen in seconds.</p>
            </div>

            {/* Source Selection */}
            <div className="modal-section">
              <label className="section-label">Capture</label>
              <div className="launcher-source-grid">
                <button
                  type="button"
                  className={`launcher-source-btn ${source === 'fullscreen' ? 'active' : ''}`}
                  onClick={() => setSource('fullscreen')}
                >
                  <Monitor size={18} color={source === 'fullscreen' ? 'var(--apple-primary-on-dark)' : 'currentColor'} />
                  <span>Full Screen</span>
                </button>

                <button
                  type="button"
                  className={`launcher-source-btn ${source === 'region' ? 'active' : ''}`}
                  onClick={() => setSource('region')}
                >
                  <Crop size={18} color={source === 'region' ? 'var(--apple-primary-on-dark)' : 'currentColor'} />
                  <span>Select Area</span>
                </button>
              </div>
            </div>

            {/* Audio Settings */}
            <div className="modal-section">
              <label className="section-label">Audio</label>
              <div className="audio-card">
                {/* Microphone Row */}
                <div
                  className={`audio-row ${micEnabled ? 'active' : ''}`}
                  onClick={() => handleToggleMic()}
                >
                  <div className="audio-row-left">
                    <div className={`audio-icon-wrapper ${micEnabled ? 'active' : ''}`}>
                      <Mic size={15} color={micEnabled ? 'var(--apple-primary-on-dark)' : 'var(--apple-ink-muted-48)'} />
                    </div>
                    <span className="audio-label">Microphone</span>
                  </div>

                  <div className="audio-row-right" onClick={(e) => e.stopPropagation()}>
                    <AudioVisualizer enabled={micEnabled} />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={micEnabled}
                      className={`apple-toggle-switch ${micEnabled ? 'checked' : ''}`}
                      onClick={handleToggleMic}
                      title={micEnabled ? 'Disable Microphone' : 'Enable Microphone'}
                      style={{ marginLeft: 8 }}
                    >
                      <span className="apple-toggle-thumb" />
                    </button>
                  </div>
                </div>

                {/* Microphone Device Picker sub-row when ON */}
                {micEnabled && (
                  <div className="mic-device-container">
                    <div
                      className={`mic-device-row ${isMicPickerOpen ? 'open' : ''}`}
                      onClick={() => setIsMicPickerOpen((prev) => !prev)}
                      title="Select input microphone"
                    >
                      <div className="mic-device-info">
                        <span className="mic-device-name">{selectedMic}</span>
                      </div>
                      <div className="mic-device-arrow">
                        {isMicPickerOpen ? (
                          <ChevronDown size={14} color="var(--apple-ink-muted-48)" />
                        ) : (
                          <ChevronRight size={14} color="var(--apple-ink-muted-48)" />
                        )}
                      </div>
                    </div>

                    {isMicPickerOpen && (
                      <div className="mic-picker-dropdown">
                        <div className="mic-picker-header">Input Devices</div>
                        {availableMics.map((mic) => (
                          <div
                            key={mic}
                            className={`mic-picker-item ${selectedMic === mic ? 'selected' : ''}`}
                            onClick={() => handleSelectMic(mic)}
                          >
                            <span className="mic-picker-item-name">{mic}</span>
                            {selectedMic === mic && (
                              <Check size={14} color="var(--apple-primary-on-dark)" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="audio-divider" />

                {/* System Audio Row */}
                <div
                  className={`audio-row ${systemAudioEnabled ? 'active' : ''}`}
                  onClick={() => handleToggleSystemAudio()}
                >
                  <div className="audio-row-left">
                    <div className={`audio-icon-wrapper ${systemAudioEnabled ? 'active' : ''}`}>
                      <Volume2 size={15} color={systemAudioEnabled ? 'var(--apple-primary-on-dark)' : 'var(--apple-ink-muted-48)'} />
                    </div>
                    <span className="audio-label">System Audio</span>
                  </div>

                  <div className="audio-row-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={systemAudioEnabled}
                      className={`apple-toggle-switch ${systemAudioEnabled ? 'checked' : ''}`}
                      onClick={handleToggleSystemAudio}
                      title={systemAudioEnabled ? 'Disable System Audio' : 'Enable System Audio'}
                    >
                      <span className="apple-toggle-thumb" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dominant Primary CTA Button */}
            <div className="launcher-action-container">
              <button
                type="button"
                className="dominant-start-btn"
                onClick={handleStart}
                autoFocus
              >
                <Circle size={10} fill="currentColor" />
                <span>Start Recording</span>
              </button>
            </div>

            {/* Footer Navigation: History & Settings */}
            <div className="launcher-footer">
              <button
                type="button"
                className="history-link-btn"
                onClick={() => handleSetView('history')}
                title="View recording history"
              >
                <Clock size={13} />
                <span>History {history.length > 0 ? `(${history.length})` : ''}</span>
              </button>
              <span className="launcher-footer-dot">•</span>
              <button
                type="button"
                className="history-link-btn"
                onClick={() => handleSetView('settings')}
                title="Open settings"
              >
                <Settings size={13} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── HISTORY VIEW ─────────────────────────────────────────────── */}
        {view === 'history' && (
          <div className="history-view-container">
            <div className="modal-section">
              {history.length === 0 ? (
                <div className="history-empty">
                  <Video size={36} opacity={0.3} />
                  <span>No recordings yet</span>
                  <p>Your screen recordings will appear here.</p>
                  <button
                    type="button"
                    className="action-btn primary"
                    onClick={() => handleSetView('launcher')}
                    style={{ marginTop: 8 }}
                  >
                    Start Recording
                  </button>
                </div>
              ) : (
                <div className="history-list">
                  {history.map((item) => (
                    <div key={item.id} className="rec-card">
                      {/* 1. Thumbnail with Play Button Overlay & Duration */}
                      <div
                        className="rec-thumbnail-container"
                        onClick={() => handlePlayRecording(item.filePath)}
                        title="Click to play recording"
                      >
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.fileName}
                            className="rec-thumbnail-img"
                          />
                        ) : (
                          <div className="rec-thumbnail-placeholder">
                            <Video size={20} opacity={0.6} />
                          </div>
                        )}
                        <div className="rec-thumbnail-play-overlay">
                          <div className="rec-play-circle">
                            <Play size={11} fill="#ffffff" color="#ffffff" style={{ marginLeft: 2 }} />
                          </div>
                        </div>
                        <span className="rec-thumbnail-duration">
                          {item.durationSeconds > 0 ? formatDuration(item.durationSeconds) : '00:00'}
                        </span>
                      </div>

                      {/* 2. Recording Info (Name, Date/time, Resolution) */}
                      <div className="rec-card-content">
                        <div className="rec-card-title-row">
                          <span className="rec-card-title" title={item.filePath}>
                            {item.fileName}
                          </span>
                        </div>

                        <div className="rec-card-meta-row">
                          <span className="rec-card-date">{formatDate(item.timestamp)}</span>
                          <span className="rec-card-dot">•</span>
                          <span className="rec-card-resolution">{formatResolution(item)}</span>
                        </div>
                      </div>

                      {/* 3. Actions (Play/Open, Reveal in Explorer, Copy path, Delete) */}
                      <div className="rec-card-actions">
                        <button
                          className="icon-btn rec-action-btn"
                          title="Play / Open"
                          onClick={() => handlePlayRecording(item.filePath)}
                        >
                          <Play size={13} fill="currentColor" />
                        </button>
                        {onOpenInEditor && (
                          <button
                            className="icon-btn rec-action-btn"
                            title="Open in Video Editor"
                            onClick={() => onOpenInEditor(item)}
                          >
                            <Scissors size={13} />
                          </button>
                        )}
                        <button
                          className="icon-btn rec-action-btn"
                          title="Reveal in Explorer"
                          onClick={() => handleShowInFolder(item.filePath)}
                        >
                          <FolderOpen size={13} />
                        </button>
                        <button
                          className="icon-btn rec-action-btn"
                          title="Copy Path"
                          onClick={() => handleCopyPath(item.filePath)}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          className="icon-btn rec-action-btn delete-btn"
                          title="Delete"
                          onClick={() => onDeleteHistoryItem(item.id, item.filePath)}
                        >
                          <Trash2 size={13} color="var(--apple-system-red)" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              {history.length > 0 ? (
                <button
                  className="action-btn"
                  onClick={onClearHistory}
                  style={{ color: 'var(--apple-system-red)', borderColor: 'rgba(255, 59, 48, 0.2)' }}
                >
                  Clear History
                </button>
              ) : <div />}

              <button
                className="action-btn primary"
                onClick={() => handleSetView('launcher')}
              >
                New Recording
              </button>
            </div>
          </div>
        )}

        {/* ─── SETTINGS VIEW ─────────────────────────────────────────────── */}
        {view === 'settings' && (
          <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4, marginTop: 4 }}>
            {/* Storage Section */}
            <div className="modal-section">
              <label className="section-label">Save Destination</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--apple-hairline-dark)',
                  borderRadius: 'var(--apple-rounded-md)',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 10, color: 'var(--apple-ink-muted-48)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Folder</span>
                  <span style={{ fontSize: 12, color: 'var(--apple-body-on-dark)', fontFamily: 'var(--apple-font-mono)', wordBreak: 'break-all' }}>
                    {savePath}
                  </span>
                </div>
                <button
                  type="button"
                  className="action-btn"
                  onClick={handleChangeFolder}
                  style={{ flexShrink: 0, padding: '5px 12px', fontSize: 11 }}
                >
                  <FolderOpen size={13} />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {/* Preferences Section */}
            <div className="modal-section">
              <label className="section-label">Preferences</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--apple-hairline-dark)',
                  borderRadius: 'var(--apple-rounded-md)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--apple-body-on-dark)', fontWeight: 500 }}>
                    3-Second Countdown
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--apple-ink-muted-48)' }}>
                    {countdownEnabled ? 'Brief countdown before recording starts' : 'Recording starts immediately'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={countdownEnabled}
                  className={`apple-toggle-switch ${countdownEnabled ? 'checked' : ''}`}
                  onClick={handleToggleCountdown}
                  title={countdownEnabled ? 'Disable countdown' : 'Enable 3s countdown'}
                >
                  <span className="apple-toggle-thumb" />
                </button>
              </div>
            </div>

            {/* Hardware & Pipeline Info */}
            <div className="modal-section">
              <label className="section-label">Recording Engine</label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--apple-hairline-dark)',
                  borderRadius: 'var(--apple-rounded-md)',
                  padding: '10px 12px',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--apple-body-muted)' }}>Hardware Acceleration</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--apple-font-mono)', color: 'var(--apple-system-green, #34c759)', fontWeight: 600 }}>
                    Active (H.264 MFT)
                  </span>
                </div>
                <div style={{ height: 1, background: 'var(--apple-divider-dark)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--apple-body-muted)' }}>Framerate</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--apple-font-mono)', color: 'var(--apple-body-on-dark)' }}>
                    30 FPS (Fluid Deadline)
                  </span>
                </div>
                <div style={{ height: 1, background: 'var(--apple-divider-dark)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--apple-body-muted)' }}>Capture Pipeline</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--apple-font-mono)', color: 'var(--apple-body-on-dark)' }}>
                    GDI + CAPTUREBLT
                  </span>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="modal-section">
              <label className="section-label">Shortcuts</label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--apple-hairline-dark)',
                  borderRadius: 'var(--apple-rounded-md)',
                  padding: '10px 12px',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--apple-body-muted)' }}>Start Recording</span>
                  <span className="shortcut-tag">Enter</span>
                </div>
                <div style={{ height: 1, background: 'var(--apple-divider-dark)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--apple-body-muted)' }}>Cancel / Back / Close</span>
                  <span className="shortcut-tag">Esc</span>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                className="action-btn primary"
                onClick={() => handleSetView('launcher')}
              >
                Done
              </button>
            </div>
          </div>
        )}
    </div>
  );
};
