import React, { useState, useEffect } from 'react'
import {
  Monitor,
  Crop,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Minus,
  X,
  Play,
  History,
  Settings,
  Video,
  VideoOff,
  Clipboard,
  FlipHorizontal,
  Circle as CircleIcon,
  Square as SquareIcon,
  RectangleHorizontal,
  Trash2,
  ChevronDown
} from 'lucide-react'
import logoImg from '../../public/Logo.png'
import { APP_CONFIG } from '../config/appConfig'
import { DesktopSource, RecordedFile } from '../../electron/preload'
import { SettingsModal } from './SettingsModal'
import { CameraOverlayConfig, CameraOverlayPosition } from '../types/editor'

export type CaptureMode = 'display' | 'area'
export type LauncherTab = 'recording' | 'screenshot'

interface LauncherProps {
  onStartRecording: (mode: CaptureMode, sourceId: string | null) => void
  onTakeScreenshot?: (mode: CaptureMode, sourceId: string | null, options?: { copyToClipboard: boolean; saveToFile: boolean }) => void
  enableMic: boolean
  setEnableMic: (val: boolean) => void
  enableSystemAudio: boolean
  setEnableSystemAudio: (val: boolean) => void
  enableCamera: boolean
  setEnableCamera: (val: boolean) => void
  cameraConfig: CameraOverlayConfig
  setCameraConfig: React.Dispatch<React.SetStateAction<CameraOverlayConfig>>
  selectedSource: DesktopSource | null
  onOpenSourcePicker: () => void
  autoOpenHistory?: boolean
}

export const Launcher: React.FC<LauncherProps> = ({
  onStartRecording,
  onTakeScreenshot,
  enableMic,
  setEnableMic,
  enableSystemAudio,
  setEnableSystemAudio,
  enableCamera,
  setEnableCamera,
  cameraConfig,
  setCameraConfig,
  selectedSource,
  onOpenSourcePicker,
  autoOpenHistory = false
}) => {
  const [activeTab, setActiveTab] = useState<LauncherTab>('recording')
  const [activeCaptureMode, setActiveCaptureMode] = useState<CaptureMode>('display')
  const [copyToClipboard, setCopyToClipboard] = useState<boolean>(true)
  const [saveToFile, setSaveToFile] = useState<boolean>(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)
  const [showAllRecordings, setShowAllRecordings] = useState<boolean>(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [recordings, setRecordings] = useState<RecordedFile[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false)
  const [isCameraOptionsOpen, setIsCameraOptionsOpen] = useState<boolean>(false)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const previewVideoRef = React.useRef<HTMLVideoElement | null>(null)
  const previewStreamRef = React.useRef<MediaStream | null>(null)

  // Enumerate cameras when camera is enabled
  useEffect(() => {
    if (enableCamera) {
      const refreshCameras = async () => {
        try {

          const initStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          initStream.getTracks().forEach((t) => t.stop())
        } catch (e) {
          console.warn('[BetterShot:Launcher] Initial camera permission request warning:', e)
        }
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const cams = devices.filter((d) => d.kind === 'videoinput')
          console.log('[BetterShot:Launcher] Enumerated camera devices:', cams)
          setAvailableCameras(cams)
          if (cams.length > 0 && !cameraConfig.deviceId) {
            setCameraConfig((prev) => ({ ...prev, deviceId: cams[0].deviceId }))
          }
        } catch (err) {
          console.warn('[BetterShot:Launcher] Camera enumeration error:', err)
        }
      }
      refreshCameras()
    }
  }, [enableCamera])

  // Mini live camera preview in launcher options
  useEffect(() => {
    let active = true
    if (enableCamera && isCameraOptionsOpen) {
      navigator.mediaDevices.getUserMedia({
        video: cameraConfig.deviceId ? { deviceId: { ideal: cameraConfig.deviceId } } : true,
        audio: false
      }).then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        previewStreamRef.current = stream
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream
        }
      }).catch((err) => {
        console.warn('[BetterShot:Launcher] Mini preview error:', err)
      })
    } else {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop())
        previewStreamRef.current = null
      }
    }
    return () => {
      active = false
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop())
        previewStreamRef.current = null
      }
    }
  }, [enableCamera, isCameraOptionsOpen, cameraConfig.deviceId])


  const cardRef = React.useRef<HTMLDivElement | null>(null)
  const lastHeightRef = React.useRef<number>(0)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const updateHeight = () => {
      if (!cardRef.current) return
      // Measure true unconstrained scrollHeight of launcher content
      const contentHeight = Math.max(cardRef.current.scrollHeight, cardRef.current.offsetHeight)
      // Account for 16px vertical padding in App.tsx wrapper (8px top + 8px bottom)
      // Minimum window height 350px ensures record button is never clipped
      const targetWindowHeight = Math.max(350, Math.min(650, contentHeight + 16))

      if (Math.abs(lastHeightRef.current - targetWindowHeight) >= 2) {
        lastHeightRef.current = targetWindowHeight
        console.log(`[BetterShot:Launcher] Dynamically updating launcher height to: ${targetWindowHeight}px (scrollHeight: ${contentHeight}px)`)
        window.electronAPI?.setLauncherHeight?.(targetWindowHeight)
      }
    }

    updateHeight()

    const observer = new ResizeObserver(() => {
      updateHeight()
    })
    observer.observe(el)

    const timer = setTimeout(updateHeight, 50)

    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [isSettingsOpen, isHistoryOpen, activeTab, enableCamera, isCameraOptionsOpen, availableCameras.length, recordings.length, showAllRecordings])

  useEffect(() => {
    if (autoOpenHistory) {
      console.log('[BetterShot:Launcher] Auto-opening history modal post-recording')
      handleOpenHistory()
    }
  }, [autoOpenHistory])

  // Auto-refresh recordings list every 2 seconds while history modal is open
  useEffect(() => {
    if (!isHistoryOpen) return
    loadRecordings()
    const interval = setInterval(() => {
      loadRecordings()
    }, 2000)
    return () => clearInterval(interval)
  }, [isHistoryOpen])

  const handleModeClick = (mode: CaptureMode) => {
    console.log(`[BetterShot:Launcher] Capture mode changed to: ${mode}`)
    setActiveCaptureMode(mode)
  }

  const loadRecordings = async () => {
    setIsLoadingHistory(true)
    try {
      if (window.electronAPI?.getRecordings) {
        const files = await window.electronAPI.getRecordings()
        setRecordings(files)
      }
    } catch (err) {
      console.error('[BetterShot:Launcher] Error fetching recordings history:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleOpenHistory = () => {
    setIsHistoryOpen(true)
    loadRecordings()
  }

  const handlePlayRecording = async (filePath: string) => {
    console.log('[BetterShot:Launcher] Playing raw recording file:', filePath)
    if (window.electronAPI?.openRecordingFile) {
      await window.electronAPI.openRecordingFile(filePath)
    }
  }

  const handleEditRecording = async (filePath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    console.log('[BetterShot:Launcher] Opening Studio Editor for:', filePath)
    if (window.electronAPI?.openEditorWindow) {
      await window.electronAPI.openEditorWindow(filePath)
    }
  }

  const handleDeleteRecording = async (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation()
    console.log('[BetterShot:Launcher] Deleting recording file:', filePath)
    if (window.electronAPI?.deleteRecording) {
      const success = await window.electronAPI.deleteRecording(filePath)
      if (success) {
        loadRecordings()
      }
    }
  }

  const handleOpenFolder = async () => {
    console.log('[BetterShot:Launcher] Opening recordings folder')
    if (window.electronAPI?.openRecordingsFolder) {
      await window.electronAPI.openRecordingsFolder()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp)
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${d.getMonth() + 1}/${d.getDate()}, ${timeStr}`
  }

  return (
    <div ref={cardRef} className="w-full h-fit bg-[#1a1a1a] rounded-2xl flex flex-col overflow-hidden shadow-2xl select-none font-sans relative text-white">
      {isSettingsOpen ? (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      ) : isHistoryOpen ? (
        <div className="w-full h-fit bg-[#1a1a1a] z-30 flex flex-col overflow-hidden animate-in fade-in duration-150 rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <img
                src={logoImg}
                alt={APP_CONFIG.appName}
                className="w-5 h-5 object-contain"
              />
              <h3 className="text-[13px] font-semibold text-white/90">
                Recordings
              </h3>
            </div>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-1.5 text-white/40 hover:text-white/70 rounded-md transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Container */}
          <div className="max-h-[480px] overflow-y-auto px-4 py-3 shrink-0 flex flex-col gap-2.5 custom-scrollbar">
            {recordings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/30 text-[13px] py-8">
                No recorded videos yet
              </div>
            ) : showAllRecordings ? (
              // Expanded 2-Column Card Container View for all recordings
              <div className="grid grid-cols-2 gap-2.5">
                {recordings.map((rec) => {
                  const videoUri = `file:///${rec.filePath.replace(/\\/g, '/')}#t=0.5`
                  return (
                    <div
                      key={rec.filePath}
                      onClick={() => handleEditRecording(rec.filePath)}
                      className="bg-[#252525] border border-white/[0.06] hover:border-white/20 rounded-xl p-2 flex flex-col gap-1.5 cursor-pointer group transition-all shadow-sm"
                      title="Open in Studio Editor"
                    >
                      {/* Top Thumbnail (16:9 Aspect Video) */}
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border border-white/10 shrink-0 group-hover:border-white/20 transition-colors">
                        <video
                          src={videoUri}
                          className="w-full h-full object-cover pointer-events-none"
                          preload="metadata"
                          muted
                        />
                        {/* Center Hover Play Button */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePlayRecording(rec.filePath)
                            }}
                            className="w-8 h-8 rounded-full bg-[#2373F4] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                            title="Play Raw Video"
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Details Below Thumbnail */}
                      <div className="flex flex-col gap-1 min-w-0 px-0.5">
                        <span className="text-[11px] font-semibold text-white/90 truncate group-hover:text-white transition-colors" title={rec.name}>
                          {rec.name}
                        </span>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] text-white/40 truncate">
                            <span>{formatDate(rec.createdAt)}</span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleEditRecording(rec.filePath, e)}
                              className="px-2 py-0.5 rounded-md bg-[#2373F4]/20 hover:bg-[#2373F4]/30 text-[#2373F4] text-[10px] font-semibold transition-colors cursor-pointer"
                              title="Open in Studio Editor"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRecording(e, rec.filePath)}
                              className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete Recording"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Default Compact Horizontal Rows (up to 4 items)
              recordings.slice(0, 4).map((rec) => {
                const videoUri = `file:///${rec.filePath.replace(/\\/g, '/')}#t=0.5`
                return (
                  <div
                    key={rec.filePath}
                    onClick={() => handleEditRecording(rec.filePath)}
                    className="p-2.5 rounded-xl bg-[#252525] border border-white/[0.06] hover:border-white/20 hover:bg-[#2a2a2a] transition-all flex items-center gap-3 cursor-pointer group shadow-sm"
                    title="Open in Studio Editor"
                  >
                    {/* Video Thumbnail Preview */}
                    <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0 flex items-center justify-center group-hover:border-white/30 transition-colors">
                      <video
                        src={videoUri}
                        className="w-full h-full object-cover pointer-events-none"
                        preload="metadata"
                        muted
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-3.5 h-3.5 text-white fill-current" />
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[12px] font-semibold text-white/90 truncate group-hover:text-white transition-colors" title={rec.name}>
                        {rec.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-white/40 mt-0.5 truncate">
                        <span className="truncate">{formatDate(rec.createdAt)}</span>
                        <span className="text-white/20 shrink-0">•</span>
                        <span className="shrink-0">{formatFileSize(rec.size)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditRecording(rec.filePath, e)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#2373F4]/20 hover:bg-[#2373F4]/30 text-[#2373F4] text-[11px] font-semibold transition-colors cursor-pointer"
                        title="Open in Studio Editor"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRecording(e, rec.filePath)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete Recording"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Show More / Show Less Footer */}
          {recordings.length > 4 && (
            <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-center shrink-0">
              <button
                type="button"
                onClick={() => setShowAllRecordings((prev) => !prev)}
                className="w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white/80 font-medium text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>{showAllRecordings ? 'Show Less' : `Show More (${recordings.length - 4} more)`}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllRecordings ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Window Drag Header */}
          <header className="h-11 bg-[#1a1a1a] px-3.5 flex items-center justify-between select-none z-10 drag-region cursor-default shrink-0 border-b border-white/[0.04]">
            <div className="flex items-center gap-2 no-drag">
              <img
                src={logoImg}
                alt={APP_CONFIG.appName}
                className="w-6 h-6 object-contain shrink-0"
              />
              <span className="text-sm font-bold tracking-tight text-white">
                {APP_CONFIG.appName}
              </span>
            </div>

            <div className="flex items-center gap-1 no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {/* Settings Icon */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsSettingsOpen(true)
                }}
                className="p-1.5 text-white/40 hover:text-white/70 rounded-md transition-colors cursor-pointer"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* History Icon */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleOpenHistory()
                }}
                className="p-1.5 text-white/40 hover:text-white/70 rounded-md transition-colors cursor-pointer"
                title="Recording History"
              >
                <History className="w-4 h-4" />
              </button>

              {/* Window controls */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('[BetterShot:Launcher] Minimize button clicked')
                  window.electronAPI?.minimizeLauncher()
                }}
                className="p-1.5 text-white/40 hover:text-white/70 rounded-md transition-colors cursor-pointer"
                title="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('[BetterShot:Launcher] Close button clicked')
                  window.electronAPI?.closeLauncher()
                }}
                className="p-1.5 text-white/40 hover:text-white/70 rounded-md transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Main Content Body */}
          <div className="px-4 pb-4 pt-1 flex flex-col gap-3 shrink-0">
            {/* Segmented Tab Switcher */}
            <div className="grid grid-cols-2 p-[3px] bg-[#252525] rounded-xl relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  console.log('[BetterShot:Launcher] Tab switched to: recording')
                  setActiveTab('recording')
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium rounded-[10px] transition-all cursor-pointer ${activeTab === 'recording'
                  ? 'bg-[#2373F4] text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
                  }`}
              >
                <span>Recording</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  console.log('[BetterShot:Launcher] Tab switched to: screenshot')
                  setActiveTab('screenshot')
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium rounded-[10px] transition-all cursor-pointer ${activeTab === 'screenshot'
                  ? 'bg-[#2373F4] text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
                  }`}
              >
                <span>Screenshot</span>
              </button>
            </div>

            {/* 2-Column Capture Mode Grid */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              {/* Display option */}
              <button
                onClick={() => handleModeClick('display')}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl border transition-all cursor-pointer ${activeCaptureMode === 'display'
                  ? 'bg-white/[0.06] border-white/20 text-white'
                  : 'bg-transparent border-white/[0.08] text-white/50 hover:text-white/70 hover:border-white/15'
                  }`}
              >
                <Monitor className="w-5 h-5" />
                <span className="text-[13px] font-medium">Display</span>
              </button>

              {/* Area option */}
              <button
                onClick={() => handleModeClick('area')}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl border transition-all cursor-pointer ${activeCaptureMode === 'area'
                  ? 'bg-white/[0.06] border-white/20 text-white'
                  : 'bg-transparent border-white/[0.08] text-white/50 hover:text-white/70 hover:border-white/15'
                  }`}
              >
                <Crop className="w-5 h-5" />
                <span className="text-[13px] font-medium">Area</span>
              </button>
            </div>

            {/* Toggle Rows */}
            {activeTab === 'recording' ? (
              <div className="flex flex-col shrink-0">
                {/* Camera toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !enableCamera
                    console.log(`[BetterShot:Launcher] Camera toggle changed to: ${nextVal ? 'ON' : 'OFF'}`)
                    setEnableCamera(nextVal)
                    if (nextVal) setIsCameraOptionsOpen(true)
                  }}
                  className="flex items-center justify-between py-3 px-1 border-b border-white/[0.06] cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enableCamera ? 'bg-white/10' : 'bg-white/[0.04]'}`}>
                      {enableCamera ? (
                        <Video className="w-4 h-4 text-white/80" />
                      ) : (
                        <VideoOff className="w-4 h-4 text-white/30" />
                      )}
                    </div>
                    <span className={`text-[13px] font-medium ${enableCamera ? 'text-white/90' : 'text-white/50'}`}>
                      {enableCamera ? 'Camera' : 'No Camera'}
                    </span>
                  </div>
                  <span className={`text-[12px] font-medium px-2.5 py-0.5 rounded-md ${enableCamera
                    ? 'bg-white/10 text-white/70'
                    : 'bg-white/[0.04] text-white/30'
                    }`}>
                    {enableCamera ? 'On' : 'Off'}
                  </span>
                </button>

                {/* Camera Options Drawer */}
                {enableCamera && isCameraOptionsOpen && (
                  <div className="py-2.5 px-1 border-b border-white/[0.06] flex flex-col gap-2.5">
                    {/* Multi-camera device selector */}
                    {availableCameras.length > 1 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-white/40 font-medium">Camera Device</span>
                        <select
                          value={cameraConfig.deviceId || ''}
                          onChange={(e) => setCameraConfig(prev => ({ ...prev, deviceId: e.target.value }))}
                          className="text-[11px] bg-[#252525] border border-white/10 rounded-lg px-2 py-1 text-white/80 truncate max-w-[180px] outline-none"
                        >
                          {availableCameras.map((cam, idx) => (
                            <option key={cam.deviceId || idx} value={cam.deviceId}>
                              {cam.label || `Camera ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Camera Control Toolbar */}
                    <div className="flex items-center justify-between gap-1">
                      {/* Shape Selector */}
                      <div className="flex items-center gap-0.5 bg-[#252525] p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setCameraConfig(prev => ({ ...prev, shape: 'circle' }))}
                          title="Circle Bubble"
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${cameraConfig.shape === 'circle'
                            ? 'bg-[#2373F4] text-white shadow-sm'
                            : 'text-white/30 hover:text-white/60'
                            }`}
                        >
                          <CircleIcon className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCameraConfig(prev => ({ ...prev, shape: 'rect' }))}
                          title="Square"
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${cameraConfig.shape === 'rect'
                            ? 'bg-[#2373F4] text-white shadow-sm'
                            : 'text-white/30 hover:text-white/60'
                            }`}
                        >
                          <SquareIcon className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCameraConfig(prev => ({ ...prev, shape: '16:9' }))}
                          title="16:9 Wide"
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${cameraConfig.shape === '16:9'
                            ? 'bg-[#2373F4] text-white shadow-sm'
                            : 'text-white/30 hover:text-white/60'
                            }`}
                        >
                          <RectangleHorizontal className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Position Corner Selector */}
                      <div className="flex items-center gap-0.5 bg-[#252525] p-0.5 rounded-lg text-[10px] font-medium">
                        {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => {
                          const label = pos === 'bottom-right' ? 'BR' : pos === 'bottom-left' ? 'BL' : pos === 'top-right' ? 'TR' : 'TL'
                          const isSelected = cameraConfig.position === pos
                          return (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => setCameraConfig(prev => ({ ...prev, position: pos }))}
                              title={`Corner: ${pos}`}
                              className={`px-1.5 py-1 rounded-md transition-all cursor-pointer ${isSelected
                                ? 'bg-[#2373F4] text-white font-semibold shadow-sm'
                                : 'text-white/30 hover:text-white/60'
                                }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Size Selector */}
                      <div className="flex items-center gap-0.5 bg-[#252525] p-0.5 rounded-lg text-[10px] font-medium">
                        {(['small', 'medium', 'large'] as const).map((sz) => {
                          const label = sz === 'small' ? 'S' : sz === 'medium' ? 'M' : 'L'
                          const isSelected = cameraConfig.size === sz
                          return (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setCameraConfig(prev => ({ ...prev, size: sz }))}
                              title={`Size: ${sz}`}
                              className={`px-1.5 py-1 rounded-md transition-all cursor-pointer ${isSelected
                                ? 'bg-[#2373F4] text-white font-semibold shadow-sm'
                                : 'text-white/30 hover:text-white/60'
                                }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Mirror Toggle */}
                      <button
                        type="button"
                        onClick={() => setCameraConfig(prev => ({ ...prev, mirror: !prev.mirror }))}
                        title={cameraConfig.mirror ? 'Mirror Mode (On)' : 'Mirror Mode (Off)'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${cameraConfig.mirror
                          ? 'bg-[#2373F4] text-white shadow-sm'
                          : 'bg-[#252525] text-white/30 hover:text-white/60'
                          }`}
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Microphone toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !enableMic
                    console.log(`[BetterShot:Launcher] Microphone toggle changed to: ${nextVal ? 'ON' : 'OFF'}`)
                    setEnableMic(nextVal)
                  }}
                  className="flex items-center justify-between py-3 px-1 border-b border-white/[0.06] cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enableMic ? 'bg-white/10' : 'bg-white/[0.04]'}`}>
                      {enableMic ? (
                        <Mic className="w-4 h-4 text-white/80" />
                      ) : (
                        <MicOff className="w-4 h-4 text-white/30" />
                      )}
                    </div>
                    <span className={`text-[13px] font-medium ${enableMic ? 'text-white/90' : 'text-white/50'}`}>
                      {enableMic ? 'Microphone' : 'No Microphone'}
                    </span>
                  </div>
                  <span className={`text-[12px] font-medium px-2.5 py-0.5 rounded-md ${enableMic
                    ? 'bg-white/10 text-white/70'
                    : 'bg-white/[0.04] text-white/30'
                    }`}>
                    {enableMic ? 'On' : 'Off'}
                  </span>
                </button>

                {/* System Audio toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !enableSystemAudio
                    console.log(`[BetterShot:Launcher] System Audio toggle changed to: ${nextVal ? 'ON' : 'OFF'}`)
                    setEnableSystemAudio(nextVal)
                  }}
                  className="flex items-center justify-between py-3 px-1 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enableSystemAudio ? 'bg-white/10' : 'bg-white/[0.04]'}`}>
                      {enableSystemAudio ? (
                        <Volume2 className="w-4 h-4 text-white/80" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-white/30" />
                      )}
                    </div>
                    <span className={`text-[13px] font-medium ${enableSystemAudio ? 'text-white/90' : 'text-white/50'}`}>
                      {enableSystemAudio ? 'System Audio' : 'No System Audio'}
                    </span>
                  </div>
                  <span className={`text-[12px] font-medium px-2.5 py-0.5 rounded-md ${enableSystemAudio
                    ? 'bg-white/10 text-white/70'
                    : 'bg-white/[0.04] text-white/30'
                    }`}>
                    {enableSystemAudio ? 'On' : 'Off'}
                  </span>
                </button>
              </div>
            ) : (
              /* Screenshot Preferences */
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !copyToClipboard
                    console.log(`[BetterShot:Launcher] Copy to clipboard toggle: ${nextVal ? 'ON' : 'OFF'}`)
                    setCopyToClipboard(nextVal)
                  }}
                  className="flex items-center justify-between py-3 px-1 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${copyToClipboard ? 'bg-white/10' : 'bg-white/[0.04]'}`}>
                      <Clipboard className={`w-4 h-4 ${copyToClipboard ? 'text-white/80' : 'text-white/30'}`} />
                    </div>
                    <span className={`text-[13px] font-medium ${copyToClipboard ? 'text-white/90' : 'text-white/50'}`}>
                      Copy to Clipboard
                    </span>
                  </div>
                  <span className={`text-[12px] font-medium px-2.5 py-0.5 rounded-md ${copyToClipboard
                    ? 'bg-white/10 text-white/70'
                    : 'bg-white/[0.04] text-white/30'
                    }`}>
                    {copyToClipboard ? 'On' : 'Off'}
                  </span>
                </button>
              </div>
            )}

            {/* Start Button */}
            <div className="pt-1 shrink-0">
              {activeTab === 'recording' ? (
                <button
                  onClick={() => {
                    console.log(`[BetterShot:Launcher] Start Recording clicked with mode: ${activeCaptureMode}, sourceId: ${selectedSource?.id}`)
                    onStartRecording(activeCaptureMode, selectedSource?.id || null)
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#2373F4] text-white font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-[#2373F4]/90 active:scale-[0.98] transition-all cursor-pointer shadow-md"
                >
                  <span>Start Recording</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    console.log(`[BetterShot:Launcher] Capture Screenshot clicked with mode: ${activeCaptureMode}, sourceId: ${selectedSource?.id}`)
                    if (onTakeScreenshot) {
                      onTakeScreenshot(activeCaptureMode, selectedSource?.id || null, { copyToClipboard, saveToFile })
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#2373F4] text-white font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-[#2373F4]/90 active:scale-[0.98] transition-all cursor-pointer shadow-md"
                >
                  <span>Capture Screenshot</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
