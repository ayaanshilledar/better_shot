import React, { useState, useEffect } from 'react'
import { Launcher } from './components/Launcher'
import { RecordingOverlay } from './components/RecordingOverlay'
import { recorderService, CaptureConfig } from './services/recorder'
import { APP_CONFIG } from './config/appConfig'

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>('launcher')

  // Source configuration states
  const [enableMic, setEnableMic] = useState<boolean>(true)
  const [enableSystemAudio, setEnableSystemAudio] = useState<boolean>(true)

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash === 'overlay') {
      setRoute('overlay')
    } else {
      setRoute('launcher')
    }
  }, [])

  const handleStartRecording = async (_mode: 'display' | 'area') => {
    let sourceId: string | null = null

    // Get primary display screen directly
    if (window.electronAPI?.getDesktopSources) {
      try {
        const sources = await window.electronAPI.getDesktopSources()
        const primaryScreen = sources.find((s) => s.isDisplay) || sources[0]
        if (primaryScreen) {
          sourceId = primaryScreen.id
        }
      } catch (err) {
        console.warn('Could not auto-fetch display source:', err)
      }
    }

    const config: CaptureConfig = {
      sourceId,
      isDisplay: true,
      enableCamera: false,
      enableMic,
      enableSystemAudio
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
        enableMic={enableMic}
        setEnableMic={setEnableMic}
        enableSystemAudio={enableSystemAudio}
        setEnableSystemAudio={setEnableSystemAudio}
      />
    </div>
  )
}
