import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RegionOverlay } from './components/RegionOverlay';
import { CaptureDeck, CaptureItem } from './components/CaptureDeck';
import { ImageEditor } from './components/ImageEditor';
import { RecordingModal, RecordingConfig, RecordingHistoryItem } from './components/RecordingModal';
import { RecordingSessionBar } from './components/RecordingSessionBar';
import { CountdownOverlay } from './components/CountdownOverlay';
import './App.css';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function App() {
  const [activeMode, setActiveMode] = useState<string>('idle');
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState<boolean>(true);
  const [isRecordingActive, setIsRecordingActive] = useState<boolean>(false);
  const [isPendingRecording, setIsPendingRecording] = useState<boolean>(false);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [recordedRegion, setRecordedRegion] = useState<Rect | null>(null);
  const [saveLocation, setSaveLocation] = useState<string>(() => {
    return localStorage.getItem('bs_save_path') || 'C:\\Users\\Public\\Pictures';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [captureItems, setCaptureItems] = useState<CaptureItem[]>([]);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<CaptureItem | null>(null);

  const [recordingHistory, setRecordingHistory] = useState<RecordingHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('bs_recording_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!isRecordingActive) return;

    const interval = setInterval(async () => {
      try {
        const isAlive = await invoke<boolean>('check_recording_alive');
        if (!isAlive && isRecordingActive) {
          setIsRecordingActive(false);
          setRecordedRegion(null);
          setIsRecordingModalOpen(true);
          setToastMessage('Recording process terminated unexpectedly');
          setTimeout(() => setToastMessage(null), 6000);
        }
      } catch (err) {
        console.error('Health check error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isRecordingActive]);

  const handleRegionComplete = async (rect: Rect) => {
    setActiveMode('idle');
    if (isPendingRecording) {
      setIsPendingRecording(false);
      setRecordedRegion(rect);
      setIsCountingDown(true);
      return;
    }

    try {
      const dataUrl = await invoke<string>('capture_region', {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
      const newItem: CaptureItem = {
        id: Date.now().toString(),
        dataUrl,
        timestamp: new Date()
      };
      setCaptureItems((prev) => [newItem, ...prev]);
      setToastMessage('Region captured to deck');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Region capture error:', err);
      setToastMessage(`Capture error: ${err}`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleCopy = async (item: CaptureItem | string) => {
    const dataUrl = typeof item === 'string' ? item : item.dataUrl;
    try {
      await invoke('copy_image_to_clipboard', { base64Data: dataUrl });
      setToastMessage('Copied to clipboard');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
      setToastMessage(`Clipboard error: ${err}`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleSave = async (item: CaptureItem | string) => {
    const dataUrl = typeof item === 'string' ? item : item.dataUrl;
    try {
      const cleanDir = saveLocation.endsWith('\\') || saveLocation.endsWith('/')
        ? saveLocation.slice(0, -1)
        : saveLocation;
      const targetPath = `${cleanDir}\\BetterShot_${Date.now()}.png`;
      await invoke('save_image_to_disk', { base64Data: dataUrl, targetPath });
      setToastMessage(`Saved to: ${targetPath}`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      console.error('Save error:', err);
      setToastMessage(`Save error: ${err}`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleEdit = (item: CaptureItem) => {
    setSelectedItemForEdit(item);
    setActiveMode('editor');
  };

  const [recordingConfig, setRecordingConfig] = useState<RecordingConfig>({
    mode: 'fullscreen',
    savePath: localStorage.getItem('bs_save_path') || 'C:\\Users\\Public\\Pictures',
    micEnabled: localStorage.getItem('bs_mic_enabled') !== 'false',
    systemAudioEnabled: localStorage.getItem('bs_system_audio_enabled') !== 'false',
    selectedMic: localStorage.getItem('bs_selected_mic') || 'Built-in Microphone'
  });

  const handleDismiss = (id: string) => {
    setCaptureItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleStartRecording = (config: RecordingConfig) => {
    setIsRecordingModalOpen(false);
    setSaveLocation(config.savePath);
    setRecordingConfig(config);
    if (config.mode === 'region') {
      setIsPendingRecording(true);
      setActiveMode('region');
    } else {
      setRecordedRegion(null);
      setIsCountingDown(true);
    }
  };

  const [recordingThumbnail, setRecordingThumbnail] = useState<string | null>(null);

  const handleCountdownFinish = async () => {
    setIsCountingDown(false);

    try {
      const region = recordedRegion;

      // Capture a crisp initial frame for the recording history thumbnail
      try {
        let thumbUrl: string;
        if (region) {
          thumbUrl = await invoke<string>('capture_region', {
            x: Math.round(region.x),
            y: Math.round(region.y),
            width: Math.round(region.width),
            height: Math.round(region.height)
          });
        } else {
          thumbUrl = await invoke<string>('capture_fullscreen');
        }
        setRecordingThumbnail(thumbUrl);
      } catch (e) {
        console.warn('Initial frame capture notice:', e);
      }

      await invoke<string>('start_screen_recording', {
        x: region ? Math.round(region.x) : 0,
        y: region ? Math.round(region.y) : 0,
        width: region ? Math.round(region.width) : 0,
        height: region ? Math.round(region.height) : 0,
        savePath: saveLocation,
        isFullscreen: !region
      });
      setIsRecordingActive(true);
    } catch (err) {
      console.error('Failed to start screen recording:', err);
      setIsRecordingActive(false);
      setRecordedRegion(null);
      setIsRecordingModalOpen(true);
      setToastMessage(`Recording failed: ${err}`);
      setTimeout(() => setToastMessage(null), 7000);
    }
  };

  const handleStopRecording = async (seconds: number) => {
    const currentRegion = recordedRegion;
    const thumbToSave = recordingThumbnail;
    setIsRecordingActive(false);
    setRecordedRegion(null);
    setRecordingThumbnail(null);
    setActiveMode('idle');

    try {
      const outputPath = await invoke<string>('stop_screen_recording');
      if (outputPath) {
        const fileName = outputPath.split('\\').pop() || outputPath.split('/').pop() || 'Recording.mp4';
        const newHistoryItem: RecordingHistoryItem = {
          id: Date.now().toString(),
          filePath: outputPath,
          fileName,
          durationSeconds: seconds,
          timestamp: new Date().toISOString(),
          mode: currentRegion ? 'region' : 'fullscreen',
          width: currentRegion ? Math.round(currentRegion.width) : window.screen.width,
          height: currentRegion ? Math.round(currentRegion.height) : window.screen.height,
          thumbnailUrl: thumbToSave || undefined
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

        setToastMessage(`Auto-saved to: ${outputPath}`);
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error('Stop recording error:', err);
      setToastMessage(`Recording error: ${err}`);
      setTimeout(() => setToastMessage(null), 6000);
    }

    setIsRecordingModalOpen(true);
  };

  const handleDiscardRecording = async () => {
    setIsRecordingActive(false);
    setRecordedRegion(null);
    setActiveMode('idle');

    try {
      await invoke<string>('stop_screen_recording');
    } catch (err) {
      console.error('Discard recording error:', err);
    }

    setIsRecordingModalOpen(true);
  };

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

    setToastMessage('Recording removed');
    setTimeout(() => setToastMessage(null), 3000);
  };

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
      <div className="workspace">
        {activeMode === 'editor' && selectedItemForEdit && (
          <ImageEditor
            imageSrc={selectedItemForEdit.dataUrl}
            onCopy={(editedUrl) => handleCopy(editedUrl)}
            onSave={(editedUrl) => handleSave(editedUrl)}
            onClose={() => setActiveMode('idle')}
          />
        )}
      </div>

      {isCountingDown && (
        <CountdownOverlay initialCount={3} onFinish={handleCountdownFinish} />
      )}

      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        onStartRecord={handleStartRecording}
        history={recordingHistory}
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onClearHistory={handleClearHistory}
        onToast={(msg) => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {isRecordingActive && (
        <>
          <RecordingSessionBar
            isRecording={isRecordingActive}
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

      {activeMode !== 'editor' && !isRecordingActive && (
        <CaptureDeck
          items={captureItems}
          onCopy={handleCopy}
          onSave={handleSave}
          onEdit={handleEdit}
          onDismiss={handleDismiss}
        />
      )}

      {activeMode === 'region' && (
        <RegionOverlay
          onComplete={handleRegionComplete}
          onCancel={() => {
            setActiveMode('idle');
            setIsPendingRecording(false);
          }}
        />
      )}

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
                : 'BetterShot Action'}
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
