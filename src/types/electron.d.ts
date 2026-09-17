import { DesktopSource } from '../../electron/preload'

export {}

declare global {
  interface Window {
    electronAPI: {
      getDesktopSources: () => Promise<DesktopSource[]>
      startRecordingMode: () => Promise<boolean>
      stopRecordingMode: () => Promise<boolean>
      saveRecording: (buffer: ArrayBuffer, fileName?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      minimizeLauncher: () => void
      closeLauncher: () => void
      setOverlayDraggable: (draggable: boolean) => void
      onRecordingStateChanged: (callback: (state: string) => void) => () => void
    }
  }
}
