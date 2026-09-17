import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopSource {
  id: string
  name: string
  thumbnailUrl: string
  appIconUrl: string | null
  isDisplay: boolean
}

const electronAPI = {
  getDesktopSources: (): Promise<DesktopSource[]> => ipcRenderer.invoke('get-desktop-sources'),
  startRecordingMode: (): Promise<boolean> => ipcRenderer.invoke('start-recording-mode'),
  stopRecordingMode: (): Promise<boolean> => ipcRenderer.invoke('stop-recording-mode'),
  saveRecording: (buffer: ArrayBuffer, fileName?: string): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('save-recording', buffer, fileName),
  minimizeLauncher: () => {
    try {
      ipcRenderer.send('minimize-launcher')
      ipcRenderer.invoke('minimize-launcher').catch(() => {})
    } catch (e) {
      console.error('Error minimizing launcher:', e)
    }
  },
  closeLauncher: () => {
    try {
      ipcRenderer.send('close-launcher')
      ipcRenderer.invoke('close-launcher').catch(() => {})
    } catch (e) {
      console.error('Error closing launcher:', e)
    }
  },
  setOverlayDraggable: (draggable: boolean) => ipcRenderer.send('set-overlay-draggable', draggable),

  // Event listeners
  onRecordingStateChanged: (callback: (state: string) => void) => {
    const subscription = (_event: any, value: string) => callback(value)
    ipcRenderer.on('recording-state-changed', subscription)
    return () => ipcRenderer.removeListener('recording-state-changed', subscription)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
