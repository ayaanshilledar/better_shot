import React, { useState, useEffect, useRef } from 'react'
import { Launcher, CaptureMode } from './components/Launcher'
import { RecordingOverlay } from './components/RecordingOverlay'
import { SourcePickerModal } from './components/SourcePickerModal'
import { AreaSelectorOverlay } from './components/AreaSelectorOverlay'
import { CameraBubbleOverlay } from './components/CameraBubbleOverlay'
import { StudioEditor } from './components/editor/StudioEditor'
import { EditorErrorBoundary } from './components/editor/ErrorBoundary'
import { recorderService, CaptureConfig } from './services/recorder'
import { APP_CONFIG } from './config/appConfig'
import { DesktopSource, CropRegion } from '../electron/preload'
import { CameraOverlayConfig, DEFAULT_CAMERA_CONFIG } from './types/editor'

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>('launcher')
  const [editorPath, setEditorPath] = useState<string>('')

  // Source configuration states
  const [enableMic, setEnableMic] = useState<boolean>(true)
  const [enableSystemAudio, setEnableSystemAudio] = useState<boolean>(true)
  const [enableCamera, setEnableCamera] = useState<boolean>(false)
  const [cameraConfig, setCameraConfig] = useState<CameraOverlayConfig>(DEFAULT_CAMERA_CONFIG)

  // Source Picker Modal states
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState<boolean>(false)
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null)

  const areaPurposeRef = useRef<'recording' | 'screenshot'>('recording')
  const screenshotOptionsRef = useRef<{ copyToClipboard: boolean; saveToFile: boolean }>({
    copyToClipboard: true,
    saveToFile: true
  })

  useEffect(() => {
    const updateRoute = () => {
      const fullUrl = window.location.href
      const hashRaw = window.location.hash.replace('#', '')
      const [hashName, queryStr] = hashRaw.split('?')
      console.log(`[BetterShot:App] Full window URL: ${fullUrl}`)
      console.log(`[BetterShot:App] Parsed route hashName: "${hashName}", queryStr: "${queryStr || ''}"`)

      if (hashName === 'editor') {
        console.log('[BetterShot:App] Setting active route to "editor"')
        setRoute('editor')
        if (queryStr) {
          const params = new URLSearchParams(queryStr)
          const p = params.get('path')
          if (p) {
            const decoded = decodeURIComponent(p)
            console.log('[BetterShot:App] Extracted editorPath from query params:', decoded)
            setEditorPath(decoded)
          }
        }
      } else if (hashName === 'overlay') {
        console.log('[BetterShot:App] Setting active route to "overlay"')
        setRoute('overlay')
      } else if (hashName === 'camera-bubble') {
        console.log('[BetterShot:App] Setting active route to "camera-bubble"')
        setRoute('camera-bubble')
      } else if (hashName === 'select-area') {
        console.log('[BetterShot:App] Setting active route to "select-area"')
        setRoute('select-area')
      } else {
        console.log('[BetterShot:App] Defaulting active route to "launcher"')
        setRoute('launcher')
      }
    }

    updateRoute()
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  // Listen for direct IPC load-editor-media events
  useEffect(() => {
    if (window.electronAPI?.onLoadEditorMedia) {
      const unsubscribe = window.electronAPI.onLoadEditorMedia((mediaPath: string) => {
        console.log('[BetterShot:App] IPC onLoadEditorMedia received path:', mediaPath)
        setEditorPath(mediaPath)
        setRoute('editor')
      })
      return () => unsubscribe()
    }
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
      const unsubscribe = window.electronAPI.onAreaSelected(async (cropRegion: CropRegion) => {
        console.log('[BetterShot:App] Event onAreaSelected received:', cropRegion, 'Purpose:', areaPurposeRef.current)
        if (areaPurposeRef.current === 'screenshot') {
          if (window.electronAPI?.captureScreenshot) {
            const res = await window.electronAPI.captureScreenshot({
              cropRegion,
              copyToClipboard: screenshotOptionsRef.current.copyToClipboard
            })
            if (res?.success && res.filePath && window.electronAPI?.openEditorWindow) {
              window.electronAPI.openEditorWindow(res.filePath)
            }
          }
        } else {
          startAreaRecordingWithRegion(cropRegion)
        }
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

  // Listen for incoming control commands from overlayWindow in launcherWindow
  useEffect(() => {
    if (window.electronAPI?.onLauncherControl) {
      const unsub = window.electronAPI.onLauncherControl(async (cmd) => {
        console.log('[BetterShot:App] Received overlay control command in launcherWindow:', cmd)
        if (cmd === 'stop') {
          await handleStopRecording()
        } else if (cmd === 'cancel' || cmd === 'discard') {
          await handleCancelRecording()
        } else if (cmd === 'pause') {
          recorderService.pauseRecording()
          window.electronAPI?.sendPausedState(true)
        } else if (cmd === 'resume') {
          recorderService.resumeRecording()
          window.electronAPI?.sendPausedState(false)
        } else if (cmd === 'mute-mic') {
          recorderService.toggleMicMute(true)
          window.electronAPI?.sendMutedState(true)
        } else if (cmd === 'unmute-mic') {
          recorderService.toggleMicMute(false)
          window.electronAPI?.sendMutedState(false)
        } else if (cmd === 'mute-camera') {
          recorderService.toggleCameraMute(true)
        } else if (cmd === 'unmute-camera') {
          recorderService.toggleCameraMute(false)
        } else if (cmd === 'restart') {
          await recorderService.restartRecording()
          window.electronAPI?.sendPausedState(false)
          window.electronAPI?.sendTimerUpdate(0)
        }
      })
      return () => {
        unsub()
      }
    }
  }, [])

  // Sync camera config updates from camera bubble or settings
  useEffect(() => {
    if (window.electronAPI?.onCameraConfigUpdate) {
      const unsub = window.electronAPI.onCameraConfigUpdate((updates: any) => {
        setCameraConfig((prev) => ({ ...prev, ...updates }))
        recorderService.updateCameraConfig(updates)
      })
      return () => unsub()
    }
  }, [])

  // Sync camera toggle updates
  useEffect(() => {
    if (window.electronAPI?.onCameraToggleUpdate) {
      const unsub = window.electronAPI.onCameraToggleUpdate((enabled: boolean) => {
        recorderService.toggleCameraMute(!enabled)
      })
      return () => unsub()
    }
  }, [])

  useEffect(() => {
    // Only manage window lifecycle from the primary Launcher window
    // Check hash to avoid secondary windows hiding themselves before their route updates
    const isActuallyLauncher = window.location.hash === '' || window.location.hash === '#launcher' || window.location.hash.includes('launcher')
    if (route === 'launcher' && isActuallyLauncher) {
      if (enableCamera) {
        console.log('[BetterShot:App] Camera ON -> Showing real floating camera bubble on desktop:', cameraConfig)
        window.electronAPI?.startCameraBubble?.(cameraConfig)
      } else {
        console.log('[BetterShot:App] Camera OFF -> Hiding floating camera bubble')
        window.electronAPI?.stopCameraBubble?.()
      }
    }
  }, [enableCamera, route])

  useEffect(() => {
    if (route === 'launcher' && enableCamera) {
      console.log('[BetterShot:App] Relaying live camera config to real desktop bubble:', cameraConfig)
      window.electronAPI?.sendCameraConfig?.(cameraConfig)
      recorderService.updateCameraConfig(cameraConfig)
    }
  }, [cameraConfig, enableCamera, route])

  const runCountdownSequence = async (): Promise<boolean> => {
    if (window.electronAPI?.startRecordingMode) {
      await window.electronAPI.startRecordingMode()
    }
    if (enableCamera && window.electronAPI?.startCameraBubble) {
      await window.electronAPI.startCameraBubble(cameraConfig)
    }
    if (window.electronAPI?.setOverlayMode) {
      await window.electronAPI.setOverlayMode('countdown')
    }

    // Minimal 3 -> 2 -> 1 centered countdown
    for (let count = 3; count >= 1; count--) {
      console.log(`[BetterShot:App] Countdown step: ${count}`)
      window.electronAPI?.sendCountdownUpdate(count)
      await new Promise((res) => setTimeout(res, 1000))
    }

    window.electronAPI?.sendCountdownUpdate(0)
    if (window.electronAPI?.setOverlayMode) {
      await window.electronAPI.setOverlayMode('recording')
    }
    return true
  }

  const startAreaRecordingWithRegion = async (cropRegion: CropRegion) => {
    console.log('[BetterShot:App] Starting area recording with region:', cropRegion)
    let finalSourceId = (selectedSource && selectedSource.isDisplay) ? selectedSource.id : null
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
      enableCamera,
      cameraConfig,
      cameraId: cameraConfig.deviceId,
      enableMic,
      enableSystemAudio,
      cropRegion
    }

    try {
      window.electronAPI?.sendMutedState(!enableMic)
      await runCountdownSequence()
      await recorderService.startRecording(config)
    } catch (err) {
      console.error('[BetterShot:App] Error starting area recording:', err)
      alert(`Could not start area recording: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleStartRecording = async (mode: CaptureMode, sourceId: string | null) => {
    console.log(`[BetterShot:App] handleStartRecording triggered for mode: ${mode}`)
    areaPurposeRef.current = 'recording'
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
      enableCamera,
      cameraConfig,
      cameraId: cameraConfig.deviceId,
      enableMic,
      enableSystemAudio
    }

    try {
      window.electronAPI?.sendMutedState(!enableMic)
      await runCountdownSequence()
      await recorderService.startRecording(config)
    } catch (err) {
      console.error('[BetterShot:App] Error initiating recording:', err)
      alert(`Could not start recording: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const [autoOpenHistory, setAutoOpenHistory] = useState<boolean>(false)

  const handleStopRecording = async () => {
    console.log('[BetterShot:App] handleStopRecording triggered...')
    try {
      if (window.electronAPI?.stopCameraBubble) {
        await window.electronAPI.stopCameraBubble()
      }
      const buffer = await recorderService.stopRecording()
      if (buffer && window.electronAPI?.saveRecording) {
        const defaultFileName = `${APP_CONFIG.outputFolder}_${Date.now()}.webm`
        console.log(`[BetterShot:App] Saving recording buffer (${buffer.byteLength} bytes)...`)
        const result = await window.electronAPI.saveRecording(buffer, defaultFileName)
        if (result.success) {
          console.log('[BetterShot:App] Recording saved successfully at:', result.filePath)
          setAutoOpenHistory(true)
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
      if (window.electronAPI?.stopCameraBubble) {
        await window.electronAPI.stopCameraBubble()
      }
      await recorderService.stopRecording()
      if (window.electronAPI?.stopRecordingMode) {
        await window.electronAPI.stopRecordingMode()
      }
    } catch (err) {
      console.error('[BetterShot:App] Error canceling recording:', err)
    }
  }

  if (route === 'editor') {
    return (
      <EditorErrorBoundary>
        <StudioEditor recordingFilePath={editorPath} />
      </EditorErrorBoundary>
    )
  }

  if (route === 'overlay') {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-transparent">
        <RecordingOverlay onStop={handleStopRecording} onCancel={handleCancelRecording} />
      </div>
    )
  }

  if (route === 'camera-bubble') {
    return <CameraBubbleOverlay />
  }

  if (route === 'select-area') {
    return <AreaSelectorOverlay />
  }

  const handleTakeScreenshot = async (
    mode: CaptureMode,
    _sourceId: string | null,
    options?: { copyToClipboard: boolean; saveToFile: boolean }
  ) => {
    console.log(`[BetterShot:App] handleTakeScreenshot called with mode: ${mode}, options:`, options)
    if (options) {
      screenshotOptionsRef.current = options
    }
    if (mode === 'area') {
      areaPurposeRef.current = 'screenshot'
      if (window.electronAPI?.openAreaSelector) {
        await window.electronAPI.openAreaSelector()
      }
    } else {
      if (window.electronAPI?.captureScreenshot) {
        const res = await window.electronAPI.captureScreenshot({
          copyToClipboard: options?.copyToClipboard ?? true
        })
        if (res?.success && res.filePath && window.electronAPI?.openEditorWindow) {
          window.electronAPI.openEditorWindow(res.filePath)
        }
      }
    }
  }

  return (
    <div className="w-full h-full p-2 bg-transparent overflow-hidden relative flex flex-col items-stretch">
      <Launcher
        onStartRecording={(mode, sourceId) => {
          setAutoOpenHistory(false)
          handleStartRecording(mode, sourceId)
        }}
        onTakeScreenshot={handleTakeScreenshot}
        enableMic={enableMic}
        setEnableMic={setEnableMic}
        enableSystemAudio={enableSystemAudio}
        setEnableSystemAudio={setEnableSystemAudio}
        enableCamera={enableCamera}
        setEnableCamera={setEnableCamera}
        cameraConfig={cameraConfig}
        setCameraConfig={setCameraConfig}
        selectedSource={selectedSource}
        onOpenSourcePicker={() => setIsSourcePickerOpen(true)}
        autoOpenHistory={autoOpenHistory}
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
