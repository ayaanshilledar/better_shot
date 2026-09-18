import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopSource {
  id: string
  name: string
  thumbnailUrl: string
  appIconUrl: string | null
  isDisplay: boolean
}

export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
  screenWidth: number
  screenHeight: number
}

export interface RecordedFile {
  name: string
  filePath: string
  size: number
  createdAt: number
}

const electronAPI = {
  getDesktopSources: (): Promise<DesktopSource[]> => ipcRenderer.invoke('get-desktop-sources'),
  startRecordingMode: (): Promise<boolean> => ipcRenderer.invoke('start-recording-mode'),
  stopRecordingMode: (): Promise<boolean> => ipcRenderer.invoke('stop-recording-mode'),
  openAreaSelector: (): Promise<boolean> => ipcRenderer.invoke('open-area-selector'),
  cancelAreaSelection: (): Promise<boolean> => ipcRenderer.invoke('cancel-area-selection'),
  confirmAreaSelection: (cropRegion: CropRegion): Promise<boolean> =>
    ipcRenderer.invoke('confirm-area-selection', cropRegion),
  saveRecording: (buffer: ArrayBuffer, fileName?: string): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('save-recording', buffer, fileName),
  minimizeLauncher: () => {
    try {
      ipcRenderer.send('minimize-launcher')
    } catch (e) {
      console.error('Error minimizing launcher:', e)
    }
  },
  closeLauncher: () => {
    try {
      ipcRenderer.send('close-launcher')
    } catch (e) {
      console.error('Error closing launcher:', e)
    }
  },
  closeEditorWindow: () => {
    try {
      ipcRenderer.send('close-editor-window')
    } catch (e) {
      console.error('Error closing editor window:', e)
    }
  },
  toggleMaximizeWindow: () => {
    try {
      ipcRenderer.send('toggle-maximize-window')
    } catch (e) {
      console.error('Error toggling maximize window:', e)
    }
  },
  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke('is-window-maximized'),
  setOverlayDraggable: (draggable: boolean) => ipcRenderer.send('set-overlay-draggable', draggable),

  // Overlay Window Bounds Mode
  setOverlayMode: (mode: 'countdown' | 'recording'): Promise<boolean> =>
    ipcRenderer.invoke('set-overlay-mode', mode),

  // Status Relay (Launcher -> Overlay)
  sendTimerUpdate: (seconds: number) => ipcRenderer.send('relay-timer-update', seconds),
  onTimerUpdate: (callback: (seconds: number) => void): (() => void) => {
    const subscription = (_event: any, val: number) => callback(val)
    ipcRenderer.on('recording-timer-update', subscription)
    return () => {
      ipcRenderer.removeListener('recording-timer-update', subscription)
    }
  },
  sendAudioLevelUpdate: (level: number) => ipcRenderer.send('relay-audio-level', level),
  onAudioLevelUpdate: (callback: (level: number) => void): (() => void) => {
    const subscription = (_event: any, val: number) => callback(val)
    ipcRenderer.on('recording-audio-level-update', subscription)
    return () => {
      ipcRenderer.removeListener('recording-audio-level-update', subscription)
    }
  },
  sendPausedState: (isPaused: boolean) => ipcRenderer.send('relay-paused-state', isPaused),
  onPausedStateUpdate: (callback: (isPaused: boolean) => void): (() => void) => {
    const subscription = (_event: any, val: boolean) => callback(val)
    ipcRenderer.on('recording-paused-update', subscription)
    return () => {
      ipcRenderer.removeListener('recording-paused-update', subscription)
    }
  },
  sendMutedState: (isMuted: boolean) => ipcRenderer.send('relay-muted-state', isMuted),
  onMutedStateUpdate: (callback: (isMuted: boolean) => void): (() => void) => {
    const subscription = (_event: any, val: boolean) => callback(val)
    ipcRenderer.on('recording-muted-update', subscription)
    return () => {
      ipcRenderer.removeListener('recording-muted-update', subscription)
    }
  },
  sendCountdownUpdate: (val: number) => ipcRenderer.send('relay-countdown-update', val),
  onCountdownUpdate: (callback: (val: number) => void): (() => void) => {
    const subscription = (_event: any, val: number) => callback(val)
    ipcRenderer.on('recording-countdown-update', subscription)
    return () => {
      ipcRenderer.removeListener('recording-countdown-update', subscription)
    }
  },

  // Controls Relay (Overlay -> Launcher)
  sendOverlayControl: (cmd: string) => ipcRenderer.send('relay-overlay-control', cmd),
  onLauncherControl: (callback: (cmd: string) => void): (() => void) => {
    const subscription = (_event: any, cmd: string) => callback(cmd)
    ipcRenderer.on('launcher-control-command', subscription)
    return () => {
      ipcRenderer.removeListener('launcher-control-command', subscription)
    }
  },

  // Recordings Manager & Studio Editor
  getRecordings: (): Promise<RecordedFile[]> => ipcRenderer.invoke('get-recordings'),
  deleteRecording: (filePath: string): Promise<boolean> => ipcRenderer.invoke('delete-recording', filePath),
  openRecordingFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke('open-recording-file', filePath),
  openRecordingsFolder: (): Promise<boolean> => ipcRenderer.invoke('open-recordings-folder'),
  openEditorWindow: (filePath?: string): Promise<boolean> => ipcRenderer.invoke('open-editor-window', filePath),
  saveExportedVideo: (
    buffer: ArrayBuffer,
    fileName?: string,
    targetPath?: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('save-exported-video', buffer, fileName, targetPath),
  showSaveDialog: (
    defaultName: string,
    format: string
  ): Promise<{ canceled: boolean; filePath?: string }> =>
    ipcRenderer.invoke('show-save-dialog', defaultName, format),
  showItemInFolder: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('show-item-in-folder', filePath),

  // Event listeners
  onRecordingStateChanged: (callback: (state: string) => void): (() => void) => {
    const subscription = (_event: any, value: string) => callback(value)
    ipcRenderer.on('recording-state-changed', subscription)
    return () => {
      ipcRenderer.removeListener('recording-state-changed', subscription)
    }
  },
  onAreaSelected: (callback: (cropRegion: CropRegion) => void): (() => void) => {
    const subscription = (_event: any, value: CropRegion) => callback(value)
    ipcRenderer.on('area-selected', subscription)
    return () => {
      ipcRenderer.removeListener('area-selected', subscription)
    }
  },
  onLoadEditorMedia: (callback: (filePath: string) => void): (() => void) => {
    const subscription = (_event: any, value: string) => callback(value)
    ipcRenderer.on('load-editor-media', subscription)
    return () => {
      ipcRenderer.removeListener('load-editor-media', subscription)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
