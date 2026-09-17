import React, { useState, useEffect } from 'react'
import { Launcher } from './components/Launcher'
import { RecordingOverlay } from './components/RecordingOverlay'
import { SourcePickerModal } from './components/SourcePickerModal'
import { DesktopSource } from '../electron/preload'
import { recorderService, CaptureConfig } from './services/recorder'
import { useMediaDevices } from './hooks/useMediaDevices'
import { APP_CONFIG } from './config/appConfig'

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>('launcher')
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null)
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState<boolean>(false)

  // Device hooks
  const {
    cameras,
    mics,
    selectedCameraId,
    setSelectedCameraId,
    selectedMicId,
    setSelectedMicId
  } = useMediaDevices()

  // Source configuration states
  const [enableCamera, setEnableCamera] = useState<boolean>(false)
  const [enableMic, setEnableMic] = useState<boolean>(true)
  const [enableSystemAudio, setEnableSystemAudio] = useState<boolean>(true)

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash === 'overlay') {
      setRoute('overlay')
    } else {
      setRoute('launcher')
      // Auto-load primary screen source
      if (window.electronAPI?.getDesktopSources) {
        window.electronAPI.getDesktopSources().then((sources) => {
          const primaryScreen = sources.find((s) => s.isDisplay) || sources[0]
          if (primaryScreen) {
            setSelectedSource(primaryScreen)
          }
        })
      }
    }
  }, [])

  const handleStartRecording = async (mode: 'display' | 'window' | 'area' | 'camera') => {
    const config: CaptureConfig = {
      sourceId: selectedSource ? selectedSource.id : null,
      isDisplay: selectedSource ? selectedSource.isDisplay : true,
      enableCamera: mode === 'camera' || enableCamera,
      enableMic,
      enableSystemAudio,
      cameraId: selectedCameraId,
      micId: selectedMicId
    }

    try {
      if (window.electronAPI?.startRecordingMode) {
        await window.electronAPI.startRecordingMode()
      }
      await recorderService.startRecording(config)
    } catch (err) {
      console.error('Error initiating recording:', err)
    }
  }

  const handleStopRecording = async () => {
    try {
      const buffer = await recorderService.stopRecording()
      if (buffer && window.electronAPI?.saveRecording) {
        const defaultFileName = `${APP_CONFIG.outputFolder}_${Date.now()}.webm`
        const result = await window.electronAPI.saveRecording(buffer, defaultFileName)
        if (result.success) {
          console.log('Recording saved successfully at:', result.filePath)
        }
      }
      if (window.electronAPI?.stopRecordingMode) {
        await window.electronAPI.stopRecordingMode()
      }
    } catch (err) {
      console.error('Error stopping recording:', err)
    }
  }

  const handleCancelRecording = async () => {
    try {
      await recorderService.stopRecording()
      if (window.electronAPI?.stopRecordingMode) {
        await window.electronAPI.stopRecordingMode()
      }
    } catch (err) {
      console.error('Error canceling recording:', err)
    }
  }

  if (route === 'overlay') {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-transparent">
        <RecordingOverlay onStop={handleStopRecording} onCancel={handleCancelRecording} />
      </div>
    )
  }

  return (
    <div className="w-screen h-screen p-2 bg-transparent overflow-hidden">
      <Launcher
        onStartRecording={handleStartRecording}
        onOpenSourcePicker={() => setIsSourcePickerOpen(true)}
        selectedSource={selectedSource}
        enableCamera={enableCamera}
        setEnableCamera={setEnableCamera}
        enableMic={enableMic}
        setEnableMic={setEnableMic}
        enableSystemAudio={enableSystemAudio}
        setEnableSystemAudio={setEnableSystemAudio}
        cameras={cameras}
        mics={mics}
        selectedCameraId={selectedCameraId}
        setSelectedCameraId={setSelectedCameraId}
        selectedMicId={selectedMicId}
        setSelectedMicId={setSelectedMicId}
      />

      <SourcePickerModal
        isOpen={isSourcePickerOpen}
        onClose={() => setIsSourcePickerOpen(false)}
        onSelectSource={(source) => setSelectedSource(source)}
        selectedSourceId={selectedSource?.id || null}
      />
    </div>
  )
}
