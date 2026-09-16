import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RegionOverlay } from './components/RegionOverlay';
import { RecordingModal } from './components/RecordingModal';
import { RecordingSessionBar } from './components/RecordingSessionBar';
import { VideoEditor } from './components/VideoEditor';
import { RecorderState, RecordingConfig, RecordingHistoryItem, Rect } from './types/recorder';
import './App.css';

export function App() {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState<boolean>(true);
  const [modalInitialView, setModalInitialView] = useState<'launcher' | 'history' | 'settings'>('launcher');
  const [recordedRegion, setRecordedRegion] = useState<Rect | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentEditingItem, setCurrentEditingItem] = useState<RecordingHistoryItem | null>(null);

  const [recordingConfig, setRecordingConfig] = useState<RecordingConfig>({
    mode: 'fullscreen',
    savePath: localStorage.getItem('bs_save_path') || 'C:\\Users\\Public\\Pictures',
    micEnabled: localStorage.getItem('bs_mic_enabled') !== 'false',
    systemAudioEnabled: localStorage.getItem('bs_system_audio_enabled') !== 'false',
    selectedMic: localStorage.getItem('bs_selected_mic') || 'Built-in Microphone'
  });

  const [recordingHistory, setRecordingHistory] = useState<RecordingHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('bs_recording_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Synchronize initial window state on startup
  useEffect(() => {
    invoke('set_window_mode', { mode: 'launcher' }).catch(() => {});
  }, []);

  // Health check polling during active recording to detect unexpected backend crashes
  useEffect(() => {
    if (recorderState !== 'recording') return;

    const interval = setInterval(async () => {
      try {
        const isAlive = await invoke<boolean>('check_recording_alive');
        if (!isAlive && recorderState === 'recording') {
          setRecorderState('error');
          setRecordedRegion(null);
          setModalInitialView('launcher');
          setIsRecordingModalOpen(true);
          await invoke('set_window_mode', { mode: 'launcher' }).catch(() => {});
          setToastMessage('Recording process terminated unexpectedly');
          setTimeout(() => setToastMessage(null), 6000);
        }
      } catch (err) {
        console.error('Health check error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [recorderState]);

  // Handle countdown interval and start recording when 0 is reached
  useEffect(() => {
    if (countdownSeconds === null) return;

    if (countdownSeconds <= 0) {
      setCountdownSeconds(null);
      launchRecordingEngine();
      return;
    }

    const timer = setTimeout(() => {
      setCountdownSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdownSeconds]);

  // Invokes native Windows screen recording engine
  const launchRecordingEngine = async () => {
    setRecorderState('recording');

    try {
      const region = recordedRegion;

      await invoke<string>('start_screen_recording', {
        x: region ? Math.round(region.x) : 0,
        y: region ? Math.round(region.y) : 0,
        width: region ? Math.round(region.width) : 0,
        height: region ? Math.round(region.height) : 0,
        savePath: recordingConfig.savePath,
        isFullscreen: !region,
        micEnabled: recordingConfig.micEnabled,
        systemAudioEnabled: recordingConfig.systemAudioEnabled,
        micName: recordingConfig.selectedMic
      });
    } catch (err) {
      console.error('Failed to start screen recording:', err);
      setRecorderState('error');
      setRecordedRegion(null);
      setModalInitialView('launcher');
      setIsRecordingModalOpen(true);
      await invoke('set_window_mode', { mode: 'launcher' }).catch(() => {});
      setToastMessage(`Recording start failed: ${err}`);
      setTimeout(() => setToastMessage(null), 7000);
    }
  };

  // Primary Start Recording action from Launcher modal
  const handleStartRecording = async (config: RecordingConfig) => {
    setRecordingConfig(config);
    setIsRecordingModalOpen(false);

    if (config.mode === 'region') {
      await invoke('set_window_mode', { mode: 'area_selection' }).catch(() => {});
      setRecorderState('area_selection');
    } else {
      setRecordedRegion(null);
      await invoke('set_window_mode', { mode: 'recording' }).catch(() => {});
      const countdownOn = localStorage.getItem('bs_countdown_enabled') !== 'false';
      if (countdownOn) {
        setRecorderState('countdown');
        setCountdownSeconds(3);
      } else {
        launchRecordingEngine();
      }
    }
  };

  // Area Selection Complete -> switch to compact recording bar
  const handleRegionComplete = async (rect: Rect) => {
    setRecordedRegion(rect);
    await invoke('set_window_mode', { mode: 'recording' }).catch(() => {});
    const countdownOn = localStorage.getItem('bs_countdown_enabled') !== 'false';
    if (countdownOn) {
      setRecorderState('countdown');
      setCountdownSeconds(3);
    } else {
      launchRecordingEngine();
    }
  };

  // Area Selection Cancelled -> restore launcher window
  const handleRegionCancel = async () => {
    setRecordedRegion(null);
    setRecorderState('idle');
    setModalInitialView('launcher');
    setIsRecordingModalOpen(true);
    await invoke('set_window_mode', { mode: 'launcher' }).catch(() => {});
  };

  // Stop Recording -> Finalize, save, and update history/editor
  const handleStopRecording = async (seconds: number) => {
    const currentRegion = recordedRegion;

    try {
      const outputPath = await invoke<string>('stop_screen_recording');
      if (outputPath) {
        const fileName = outputPath.split('\\').pop() || outputPath.split('/').pop() || 'Recording.mp4';
        
        let thumbUrl: string | undefined = undefined;
        try {
          thumbUrl = await invoke<string>('generate_video_thumbnail', { videoPath: outputPath });
        } catch (e) {
          console.warn('Async thumbnail extraction notice:', e);
        }

        const newHistoryItem: RecordingHistoryItem = {
          id: Date.now().toString(),
          filePath: outputPath,
          fileName,
          durationSeconds: seconds,
          timestamp: new Date().toISOString(),
          mode: currentRegion ? 'region' : 'fullscreen',
          width: currentRegion ? Math.round(currentRegion.width) : window.screen.width,
          height: currentRegion ? Math.round(currentRegion.height) : window.screen.height,
          thumbnailUrl: thumbUrl
        };

        setRecordingHistory((prev) => {
          const updated = [newHistoryItem, ...prev];
          try {
            localStorage.setItem('bs_recording_history', JSON.stringify(updated));
          } catch (e) {
            console.error('Failed to save history to localStorage', e);
          }
          return updated;
        });

        // Finish recording -> Redirect directly to Video Editor
        setRecordedRegion(null);
        setCurrentEditingItem(newHistoryItem);
        setIsRecordingModalOpen(false);
        setRecorderState('editor');
        await invoke('set_window_mode', { mode: 'editor' }).catch(() => {});
        return;
      }
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  };

  // Open Video Editor from History
  const handleOpenEditor = async (item: RecordingHistoryItem) => {
    setCurrentEditingItem(item);
    setIsRecordingModalOpen(false);
    setRecorderState('editor');
    await invoke('set_window_mode', { mode: 'editor' }).catch(() => {});
  };

  // Return from Video Editor to Launcher
  const handleCloseEditor = async () => {
    setCurrentEditingItem(null);
    setRecorderState('idle');
    setModalInitialView('history');
    setIsRecordingModalOpen(true);
    await invoke('set_window_mode', { mode: 'launcher' }).catch(() => {});
  };

  // Discard Recording -> return to launcher window
  const handleDiscardRecording = async () => {
    setRecorderState('idle');
    setRecordedRegion(null);

    try {
      await invoke<string>('stop_screen_recording');
    } catch (err) {
      console.error('Discard recording error:', err);
    }

    setModalInitialView('launcher');
    setIsRecordingModalOpen(true);
    await invoke('set_window_mode', { mode: 'launcher' }).catch(() => {});
  };

  // Delete Item from History
  const handleDeleteHistoryItem = async (id: string, filePath: string) => {
    try {
      await invoke('delete_file', { path: filePath });
    } catch (e) {
      console.error('Failed to delete file from disk:', e);
    }

    setRecordingHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('bs_recording_history', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update localStorage', e);
      }
      return updated;
    });

    setToastMessage('Recording deleted');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Clear All History
  const handleClearHistory = () => {
    setRecordingHistory([]);
    try {
      localStorage.removeItem('bs_recording_history');
    } catch (e) {
      console.error('Failed to clear history from localStorage', e);
    }
    setToastMessage('Recording history cleared');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className={`app-container ${recorderState === 'recording' || recorderState === 'countdown' ? 'recording-bar-active' : ''}`}>
      {/* 1. Fullscreen Region Selection (Only active during drag selection) */}
      {recorderState === 'area_selection' && (
        <RegionOverlay
          onComplete={handleRegionComplete}
          onCancel={handleRegionCancel}
        />
      )}

      {/* 2. Recording Setup & History Modal (Centered compact window) */}
      {isRecordingModalOpen && recorderState !== 'recording' && recorderState !== 'countdown' && recorderState !== 'area_selection' && recorderState !== 'editor' && (
        <RecordingModal
          isOpen={isRecordingModalOpen}
          onClose={async () => {
            try {
              await invoke('close_app_window');
            } catch {
              setIsRecordingModalOpen(false);
            }
          }}
          onStartRecord={handleStartRecording}
          history={recordingHistory}
          onDeleteHistoryItem={handleDeleteHistoryItem}
          onEditHistoryItem={handleOpenEditor}
          onClearHistory={handleClearHistory}
          initialView={modalInitialView}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      )}

      {/* 3. Compact Bottom-Pinned Recording Bar (Only 380x74px window) */}
      {(recorderState === 'recording' || recorderState === 'countdown') && (
        <RecordingSessionBar
          isRecording={recorderState === 'recording'}
          countdownSeconds={countdownSeconds}
          initialMicActive={recordingConfig.micEnabled}
          onStop={handleStopRecording}
          onDiscard={handleDiscardRecording}
        />
      )}

      {/* 4. Video Editor Page */}
      {recorderState === 'editor' && currentEditingItem && (
        <VideoEditor
          item={currentEditingItem}
          onBack={handleCloseEditor}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      )}

      {/* 5. Toast Notification Banner */}
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
