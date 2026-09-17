import React, { useState, useEffect } from 'react'
import { Launcher, CaptureMode } from './components/Launcher'
import { RecordingOverlay } from './components/RecordingOverlay'
import { SourcePickerModal } from './components/SourcePickerModal'
import { AreaSelectorOverlay } from './components/AreaSelectorOverlay'
import { recorderService, CaptureConfig } from './services/recorder'
import { APP_CONFIG } from './config/appConfig'
import { DesktopSource, CropRegion } from '../electron/preload'

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>('launcher')

  // Source configuration states
  const [enableMic, setEnableMic] = useState<boolean>(true)
  const [enableSystemAudio, setEnableSystemAudio] = useState<boolean>(true)
  const [enableCamera, setEnableCamera] = useState<boolean>(false)

  // Source Picker Modal states
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState<boolean>(false)
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null)

  useEffect(() => {
    const updateRoute = () => {
      const hash = window.location.hash.replace('#', '')
      console.log(`[BetterShot:App] Route hash updated: #${hash || 'launcher'}`)
      if (hash === 'overlay') {
        setRoute('overlay')
      } else if (hash === 'select-area') {
        setRoute('select-area')
      } else {
        setRoute('launcher')
      }
    }

    updateRoute()
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  // Auto-fetch primary display on startup if no source is selected yet
  useEffect(() => {
    if (window.electronAPI?.getDesktopSources) {
      window.electronAPI.getDesktopSources().then((sources) => {
        if (sources.length > 0 && !selectedSource) {
          const primaryDisplay = sources.find(s => s.isDisplay) || sources[0]
          console.log('[BetterShot:App] Auto-selected primary display source:', primaryDisplay.name, primaryDisplay.id)
          setSelectedSource(primaryDisplay)
        }
      }).catch(err => {
        console.warn('[BetterShot:App] Error fetching initial sources:', err)
      })
    }
  }, [])

  // Listen for area-selected event from main process when area selector confirms
  useEffect(() => {
    if (window.electronAPI?.onAreaSelected) {
      const unsubscribe = window.electronAPI.onAreaSelected((cropRegion: CropRegion) => {
        console.log('[BetterShot:App] Event onAreaSelected received:', cropRegion)
        startAreaRecordingWithRegion(cropRegion)
      })
      return () => {
        unsubscribe()
      }
    }
  }, [selectedSource, enableMic, enableSystemAudio])

  // Connect recorderService callbacks in launcher window to IPC state relay
  useEffect(() => {
    recorderService.setTimerCallback((sec) => {
      window.electronAPI?.sendTimerUpdate(sec)
    })
    recorderService.setAudioLevelCallback((level) => {
      window.electronAPI?.sendAudioLevelUpdate(level)
    })
  }, [])

  // Listen for incoming commands from overlayWindow in launcherWindow
  useEffect(() => {
    if (window.electronAPI?.onOverlayCommand) {
      const unsub = window.electronAPI.onOverlayCommand((cmd) => {
        console.log('[BetterShot:App] Received overlay command in launcherWindow:', cmd)
        if (cmd === 'stop') {
          handleStopRecording()
        } else if (cmd === 'cancel' || cmd === 'discard') {
          handleCancelRecording()
        } else if (cmd === 'pause') {
          recorderService.pauseRecording()
        } else if (cmd === 'resume') {
          recorderService.resumeRecording()
        } else if (cmd === 'mute-mic') {
          recorderService.toggleMicMute(true)
        } else if (cmd === 'unmute-mic') {
          recorderService.toggleMicMute(false)
        } else if (cmd === 'restart') {
          recorderService.restartRecording()
        }
      })
      return () => {
        unsub()
      }
    }
  }, [])

  const startAreaRecordingWithRegion = async (cropRegion: CropRegion) => {
    console.log('[BetterShot:App] Starting area recording with region:', cropRegion)
    let finalSourceId = selectedSource?.id || null
    if (!finalSourceId && window.electronAPI?.getDesktopSources) {
      try {
        const sources = await window.electronAPI.getDesktopSources()
        const primaryScreen = sources.find((s) => s.isDisplay) || sources[0]
        if (primaryScreen) {
          finalSourceId = primaryScreen.id
        }
      } catch (err) {
        console.warn('[BetterShot:App] Could not auto-fetch display source for area recording:', err)
      }
    }

    const config: CaptureConfig = {
      sourceId: finalSourceId,
      isDisplay: true,
      enableCamera: false,
      enableMic,
      enableSystemAudio,
      cropRegion
    }

    try {
      await recorderService.startRecording(config)
      if (window.electronAPI?.startRecordingMode) {
        await window.electronAPI.startRecordingMode()
      }
    } catch (err) {
      console.error('[BetterShot:App] Error starting area recording:', err)
      alert(`Could not start area recording: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleStartRecording = async (mode: CaptureMode, sourceId: string | null) => {
    console.log(`[BetterShot:App] handleStartRecording triggered for mode: ${mode}`)
    if (mode === 'area') {
      if (window.electronAPI?.openAreaSelector) {
        console.log('[BetterShot:App] Opening Area Selector window...')
        await window.electronAPI.openAreaSelector()
      }
      return
    }

    let finalSourceId = sourceId

    // Auto-fetch primary display source if none selected
    if (!finalSourceId) {
      if (window.electronAPI?.getDesktopSources) {
        try {
          const sources = await window.electronAPI.getDesktopSources()
          const primaryScreen = sources.find((s) => s.isDisplay) || sources[0]
          if (primaryScreen) {
            finalSourceId = primaryScreen.id
          }
        } catch (err) {
          console.warn('[BetterShot:App] Could not auto-fetch display source:', err)
        }
      }
    }

    const config: CaptureConfig = {
      sourceId: finalSourceId,
      isDisplay: true,
      enableCamera: false,
      enableMic,
      enableSystemAudio
    }

    try {
      await recorderService.startRecording(config)
      if (window.electronAPI?.startRecordingMode) {
        await window.electronAPI.startRecordingMode()
      }
    } catch (err) {
      console.error('[BetterShot:App] Error initiating recording:', err)
      alert(`Could not start recording: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleStopRecording = async () => {
    console.log('[BetterShot:App] handleStopRecording triggered...')
    try {
      const buffer = await recorderService.stopRecording()
      if (buffer && window.electronAPI?.saveRecording) {
        const defaultFileName = `${APP_CONFIG.outputFolder}_${Date.now()}.webm`
        console.log(`[BetterShot:App] Saving recording buffer (${buffer.byteLength} bytes)...`)
        const result = await window.electronAPI.saveRecording(buffer, defaultFileName)
        if (result.success) {
          console.log('[BetterShot:App] Recording saved successfully at:', result.filePath)
        }
      }
      if (window.electronAPI?.stopRecordingMode) {
        await window.electronAPI.stopRecordingMode()
      }
    } catch (err) {
      console.error('[BetterShot:App] Error stopping recording:', err)
    }
  }

  const handleCancelRecording = async () => {
    console.log('[BetterShot:App] handleCancelRecording triggered...')
    try {
      await recorderService.stopRecording()
      if (window.electronAPI?.stopRecordingMode) {
        await window.electronAPI.stopRecordingMode()
      }
    } catch (err) {
      console.error('[BetterShot:App] Error canceling recording:', err)
    }
  }

  if (route === 'overlay') {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-transparent">
        <RecordingOverlay onStop={handleStopRecording} onCancel={handleCancelRecording} />
      </div>
    )
  }

  if (route === 'select-area') {
    return <AreaSelectorOverlay />
  }

  return (
    <div className="w-screen h-screen p-2 bg-transparent overflow-hidden relative">
      <Launcher
        onStartRecording={handleStartRecording}
        enableMic={enableMic}
        setEnableMic={setEnableMic}
        enableSystemAudio={enableSystemAudio}
        setEnableSystemAudio={setEnableSystemAudio}
        selectedSource={selectedSource}
        onOpenSourcePicker={() => setIsSourcePickerOpen(true)}
      />

      {/* Source Picker Modal */}
      <SourcePickerModal
        isOpen={isSourcePickerOpen}
        onClose={() => setIsSourcePickerOpen(false)}
        onSelectSource={(source) => setSelectedSource(source)}
        selectedSourceId={selectedSource?.id || null}
      />
    </div>
  )
}
