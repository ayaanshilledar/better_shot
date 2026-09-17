import { DesktopSource, CropRegion, RecordedFile } from '../../electron/preload'

export {}

declare global {
  interface Window {
    electronAPI: {
      getDesktopSources: () => Promise<DesktopSource[]>
      startRecordingMode: () => Promise<boolean>
      stopRecordingMode: () => Promise<boolean>
      openAreaSelector: () => Promise<boolean>
      cancelAreaSelection: () => Promise<boolean>
      confirmAreaSelection: (cropRegion: CropRegion) => Promise<boolean>
      saveRecording: (buffer: ArrayBuffer, fileName?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      minimizeLauncher: () => void
      closeLauncher: () => void
      setOverlayDraggable: (draggable: boolean) => void
      setOverlayMode: (mode: 'countdown' | 'recording') => Promise<boolean>

      // State Relay
      sendTimerUpdate: (seconds: number) => void
      onTimerUpdate: (callback: (seconds: number) => void) => () => void
      sendAudioLevelUpdate: (level: number) => void
      onAudioLevelUpdate: (callback: (level: number) => void) => () => void
      sendPausedState: (isPaused: boolean) => void
      onPausedStateUpdate: (callback: (isPaused: boolean) => void) => () => void
      sendMutedState: (isMuted: boolean) => void
      onMutedStateUpdate: (callback: (isMuted: boolean) => void) => () => void
      sendCountdownUpdate: (val: number) => void
      onCountdownUpdate: (callback: (val: number) => void) => () => void

      // Controls Relay
      sendOverlayControl: (cmd: string) => void
      onLauncherControl: (callback: (cmd: string) => void) => () => void

      // Recordings Manager
      getRecordings: () => Promise<RecordedFile[]>
      deleteRecording: (filePath: string) => Promise<boolean>
      openRecordingFile: (filePath: string) => Promise<boolean>
      openRecordingsFolder: () => Promise<boolean>

      // Event listeners
      onRecordingStateChanged: (callback: (state: string) => void) => () => void
      onAreaSelected: (callback: (cropRegion: CropRegion) => void) => () => void
    }
  }
}
