import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RegionOverlay } from './components/RegionOverlay';
import { RecordingModal } from './components/RecordingModal';
import { RecordingSessionBar } from './components/RecordingSessionBar';
import { CountdownOverlay } from './components/CountdownOverlay';
import { RecorderState, RecordingConfig, RecordingHistoryItem, Rect } from './types/recorder';
import './App.css';

export function App() {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState<boolean>(true);
  const [modalInitialView, setModalInitialView] = useState<'launcher' | 'history'>('launcher');
  const [recordedRegion, setRecordedRegion] = useState<Rect | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
          setToastMessage('Recording process terminated unexpectedly');
          setTimeout(() => setToastMessage(null), 6000);
        }
      } catch (err) {
        console.error('Health check error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [recorderState]);

  // Primary Start Recording action from Launcher modal
  const handleStartRecording = (config: RecordingConfig) => {
    setRecordingConfig(config);
    setIsRecordingModalOpen(false);

    if (config.mode === 'region') {
      setRecorderState('area_selection');
    } else {
      setRecordedRegion(null);
      setRecorderState('countdown');
    }
  };

  // Area Selection Complete
  const handleRegionComplete = (rect: Rect) => {
    setRecordedRegion(rect);
    setRecorderState('countdown');
  };

  // Area Selection Cancelled
  const handleRegionCancel = () => {
    setRecordedRegion(null);
    setRecorderState('idle');
    setModalInitialView('launcher');
    setIsRecordingModalOpen(true);
  };

  // Countdown Complete -> Launch Native Backend Engine with Zero Start Latency
  const handleCountdownFinish = async () => {
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
      setToastMessage(`Recording start failed: ${err}`);
      setTimeout(() => setToastMessage(null), 7000);
    }
  };

  // Stop Recording -> Finalize and Save to History (Async Thumbnail Extraction)
  const handleStopRecording = async (seconds: number) => {
    const currentRegion = recordedRegion;
    setRecorderState('saving');

    try {
      const outputPath = await invoke<string>('stop_screen_recording');
      if (outputPath) {
        const fileName = outputPath.split('\\').pop() || outputPath.split('/').pop() || 'Recording.mp4';
        
        // Generate crisp thumbnail asynchronously from video without blocking
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

        setToastMessage(`Saved to: ${outputPath}`);
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error('Stop recording error:', err);
      setToastMessage(`Recording save error: ${err}`);
      setTimeout(() => setToastMessage(null), 6000);
    }

    setRecordedRegion(null);
    setRecorderState('saved');
    setModalInitialView('history');
    setIsRecordingModalOpen(true);
  };

  // Discard Recording
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
    <div className="app-container">
      {/* 1. Countdown Overlay */}
      {recorderState === 'countdown' && (
        <CountdownOverlay initialCount={3} onFinish={handleCountdownFinish} />
      )}

      {/* 2. Area Selection Overlay */}
      {recorderState === 'area_selection' && (
        <RegionOverlay
          onComplete={handleRegionComplete}
          onCancel={handleRegionCancel}
        />
      )}

      {/* 3. Saving State Indicator */}
      {recorderState === 'saving' && (
        <div className="saving-overlay">
          <div className="saving-card">
            <div className="saving-spinner" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
              Saving recording...
            </span>
            <span style={{ fontSize: 12, color: 'var(--apple-ink-muted-48)' }}>
              Finalizing MP4 file
            </span>
          </div>
        </div>
      )}

      {/* 4. Recording Setup & History Modal */}
      <RecordingModal
        isOpen={isRecordingModalOpen && recorderState !== 'recording' && recorderState !== 'countdown' && recorderState !== 'area_selection' && recorderState !== 'saving'}
        onClose={() => setIsRecordingModalOpen(false)}
        onStartRecord={handleStartRecording}
        history={recordingHistory}
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onClearHistory={handleClearHistory}
        initialView={modalInitialView}
        onToast={(msg) => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* 5. Live Recording Session Bar & Bounds Indicator */}
      {recorderState === 'recording' && (
        <>
          <RecordingSessionBar
            isRecording={true}
            initialMicActive={recordingConfig.micEnabled}
            onStop={handleStopRecording}
            onDiscard={handleDiscardRecording}
          />

          {recordedRegion ? (
            <div
              className="recording-frame-overlay"
              style={{
                left: recordedRegion.x,
                top: recordedRegion.y,
                width: recordedRegion.width,
                height: recordedRegion.height
              }}
            >
              <div className="recording-frame-badge">
                <span className="record-dot-animated" style={{ width: 8, height: 8 }} />
                <span>REC • {Math.round(recordedRegion.width)} × {Math.round(recordedRegion.height)} PX</span>
              </div>
            </div>
          ) : (
            <div
              className="recording-frame-overlay"
              style={{
                left: 0,
                top: 0,
                width: '100vw',
                height: '100vh',
                borderRadius: 0
              }}
            >
              <div className="recording-frame-badge" style={{ top: 12, left: 16, borderRadius: 'var(--apple-rounded-xs)' }}>
                <span className="record-dot-animated" style={{ width: 8, height: 8 }} />
                <span>REC • FULLSCREEN</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* 6. Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <span style={{ fontSize: 15 }}>
            {toastMessage.includes('failed') || toastMessage.includes('error') || toastMessage.includes('terminated') ? '⚠️' : '⚡'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontWeight: 600,
              fontSize: 12,
              color: toastMessage.includes('failed') || toastMessage.includes('error') || toastMessage.includes('terminated')
                ? 'var(--apple-system-red)'
                : 'var(--apple-primary-on-dark)'
            }}>
              {toastMessage.includes('failed') || toastMessage.includes('error') || toastMessage.includes('terminated')
                ? 'System Alert'
                : 'BetterShot'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--apple-ink-muted-48)', fontFamily: 'var(--apple-font-mono)', wordBreak: 'break-all' }}>
              {toastMessage.replace('Auto-saved to: ', '').replace('Saved to: ', '')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
