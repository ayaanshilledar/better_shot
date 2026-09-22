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
      setLauncherHeight: (height: number) => void
      closeEditorWindow: () => void
      openEditorWindow: (filePath?: string) => Promise<boolean>
      toggleMaximizeWindow: () => void
      isWindowMaximized: () => Promise<boolean>
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

      // Camera Overlay Controls & Relay
      startCameraBubble: (config?: any) => Promise<boolean>
      stopCameraBubble: () => Promise<boolean>
      setCameraBubblePosition: (position: string) => Promise<boolean>
      sendCameraToggle: (enabled: boolean) => void
      onCameraToggleUpdate: (callback: (enabled: boolean) => void) => () => void
      sendCameraConfig: (config: any) => void
      onCameraConfigUpdate: (callback: (config: any) => void) => () => void

      // Controls Relay
      sendOverlayControl: (cmd: string) => void
      onLauncherControl: (callback: (cmd: string) => void) => () => void

      // Recordings Manager
      getRecordings: () => Promise<RecordedFile[]>
      deleteRecording: (filePath: string) => Promise<boolean>
      openRecordingFile: (filePath: string) => Promise<boolean>
      openRecordingsFolder: () => Promise<boolean>
      saveExportedVideo: (
        buffer: ArrayBuffer,
        fileName?: string,
        targetPath?: string
      ) => Promise<{ success: boolean; filePath?: string; error?: string }>
      saveExportedImage: (
        buffer: ArrayBuffer,
        fileName?: string,
        targetPath?: string
      ) => Promise<{ success: boolean; filePath?: string; error?: string }>
      copyImageToClipboard: (buffer: ArrayBuffer) => Promise<boolean>
      captureScreenshot: (options?: {
        cropRegion?: CropRegion
        copyToClipboard?: boolean
      }) => Promise<{ success: boolean; filePath?: string; error?: string }>
      showSaveDialog: (
        defaultName: string,
        format: string
      ) => Promise<{ canceled: boolean; filePath?: string }>
      showItemInFolder: (filePath: string) => Promise<boolean>

      // Event listeners
      onRecordingStateChanged: (callback: (state: string) => void) => () => void
      onAreaSelected: (callback: (cropRegion: CropRegion) => void) => () => void
      onLoadEditorMedia: (callback: (filePath: string) => void) => () => void
    }
  }
}
