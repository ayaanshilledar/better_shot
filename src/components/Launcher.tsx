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
  Film,
  Settings,
  Camera,
  Video,
  VideoOff,
  Clipboard,
  ChevronDown,
  ChevronUp,
  FlipHorizontal,
  Circle as CircleIcon,
  Square as SquareIcon
} from 'lucide-react'
import { APP_CONFIG } from '../config/appConfig'
import { DesktopSource, RecordedFile } from '../../electron/preload'
import { SettingsModal } from './SettingsModal'
import { CameraOverlayConfig } from '../types/editor'

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
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const cams = devices.filter((d) => d.kind === 'videoinput')
        setAvailableCameras(cams)
        if (cams.length > 0 && !cameraConfig.deviceId) {
          setCameraConfig((prev) => ({ ...prev, deviceId: cams[0].deviceId }))
        }
      }).catch((err) => {
        console.warn('[BetterShot:Launcher] Camera enumeration error:', err)
      })
    }
  }, [enableCamera])

  // Mini live camera preview in launcher options
  useEffect(() => {
    let active = true
    if (enableCamera && isCameraOptionsOpen) {
      navigator.mediaDevices.getUserMedia({
        video: cameraConfig.deviceId ? { deviceId: { exact: cameraConfig.deviceId } } : true,
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


  useEffect(() => {
    if (isSettingsOpen) {
      window.electronAPI?.setLauncherHeight?.(500)
    } else if (isHistoryOpen) {
      window.electronAPI?.setLauncherHeight?.(440)
    } else if (activeTab === 'screenshot') {
      window.electronAPI?.setLauncherHeight?.(240)
    } else if (enableCamera && isCameraOptionsOpen) {
      window.electronAPI?.setLauncherHeight?.(availableCameras.length > 1 ? 366 : 336)
    } else {
      window.electronAPI?.setLauncherHeight?.(296)
    }
  }, [isSettingsOpen, isHistoryOpen, activeTab, enableCamera, isCameraOptionsOpen, availableCameras.length])

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
    <div className="w-full h-full bg-slate-50 dark:bg-[#101216] border border-slate-300/80 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl select-none font-sans relative text-slate-900 dark:text-white">
      {/* Window Drag Header */}
      <header className="h-9 bg-slate-100/90 dark:bg-[#12141a]/95 px-3 flex items-center justify-between select-none z-10 drag-region cursor-default shrink-0 border-b border-black/5 dark:border-transparent">
        <div className="flex items-center gap-2 no-drag">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-[#1a1d26] rounded-lg border border-black/5 dark:border-white/5 shadow-sm">
            <Film className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold tracking-tight text-slate-800 dark:text-white">
              {APP_CONFIG.appName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* History Icon */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleOpenHistory()
            }}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Recording History"
          >
            <History className="w-3.5 h-3.5" />
          </button>

          {/* Settings Icon */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsSettingsOpen(true)
            }}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-white/10" />

          {/* Window controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('[BetterShot:Launcher] Minimize button clicked')
                window.electronAPI?.minimizeLauncher()
              }}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('[BetterShot:Launcher] Close button clicked')
                window.electronAPI?.closeLauncher()
              }}
              className="p-1 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/20 rounded-md transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="p-3 flex-1 flex flex-col gap-1.5 overflow-hidden">
        {/* Segmented Tab Switcher: Recording vs Screenshot */}
        <div className="grid grid-cols-2 p-0.5 bg-slate-200/70 dark:bg-[#181b22] rounded-xl border border-black/5 dark:border-white/5 relative shrink-0">
          <button
            type="button"
            onClick={() => {
              console.log('[BetterShot:Launcher] Tab switched to: recording')
              setActiveTab('recording')
            }}
            className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'recording'
                ? 'bg-white dark:bg-[#222734] text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Recording</span>
          </button>

          <button
            type="button"
            onClick={() => {
              console.log('[BetterShot:Launcher] Tab switched to: screenshot')
              setActiveTab('screenshot')
            }}
            className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'screenshot'
                ? 'bg-white dark:bg-[#222734] text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Screenshot</span>
          </button>
        </div>

        {/* 2-Column Capture Mode Grid: Display & Area */}
        <div className="grid grid-cols-2 gap-1.5 shrink-0">
          {/* Display option */}
          <button
            onClick={() => handleModeClick('display')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border transition-all cursor-pointer ${activeCaptureMode === 'display'
                ? 'bg-blue-600/10 dark:bg-blue-600/20 border-blue-600/60 dark:border-blue-500/60 ring-1 ring-blue-600/30 dark:ring-blue-500/40 shadow-sm text-blue-600 dark:text-white font-bold'
                : 'bg-white dark:bg-[#181b22] border-slate-200/80 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#20242e]'
              }`}
          >
            <Monitor className={`w-3.5 h-3.5 ${activeCaptureMode === 'display' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400'}`} />
            <span className="text-xs font-bold">Display</span>
          </button>

          {/* Area option */}
          <button
            onClick={() => handleModeClick('area')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border transition-all cursor-pointer ${activeCaptureMode === 'area'
                ? 'bg-blue-600/10 dark:bg-blue-600/20 border-blue-600/60 dark:border-blue-500/60 ring-1 ring-blue-600/30 dark:ring-blue-500/40 shadow-sm text-blue-600 dark:text-white font-bold'
                : 'bg-white dark:bg-[#181b22] border-slate-200/80 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#20242e]'
              }`}
          >
            <Crop className={`w-3.5 h-3.5 ${activeCaptureMode === 'area' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400'}`} />
            <span className="text-xs font-bold">Area</span>
          </button>
        </div>

        {/* Dynamic Contextual Middle Section */}
        {activeTab === 'recording' ? (
          /* Audio Source Toggles */
          <div className="flex flex-col gap-1 shrink-0">
            {/* Microphone toggle */}
            <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-white dark:bg-[#181b22] border border-slate-200/80 dark:border-white/5 shadow-xs">
              <div className="flex items-center gap-2">
                {enableMic ? (
                  <Mic className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-slate-400 dark:text-gray-400" />
                )}
                <span className="text-[11px] font-semibold text-slate-800 dark:text-white">Microphone</span>
              </div>
              <button
                onClick={() => {
                  const nextVal = !enableMic
                  console.log(`[BetterShot:Launcher] Microphone toggle changed to: ${nextVal ? 'ON' : 'OFF'}`)
                  setEnableMic(nextVal)
                }}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer ${enableMic
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-slate-200 dark:bg-[#2a2e38] text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {enableMic ? 'On' : 'Off'}
              </button>
            </div>

            {/* System Audio toggle */}
            <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-white dark:bg-[#181b22] border border-slate-200/80 dark:border-white/5 shadow-xs">
              <div className="flex items-center gap-2">
                {enableSystemAudio ? (
                  <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400 dark:text-gray-400" />
                )}
                <span className="text-[11px] font-semibold text-slate-800 dark:text-white">System Audio</span>
              </div>
              <button
                onClick={() => {
                  const nextVal = !enableSystemAudio
                  console.log(`[BetterShot:Launcher] System Audio toggle changed to: ${nextVal ? 'ON' : 'OFF'}`)
                  setEnableSystemAudio(nextVal)
                }}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer ${enableSystemAudio
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-slate-200 dark:bg-[#2a2e38] text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {enableSystemAudio ? 'On' : 'Off'}
              </button>
            </div>

            {/* Camera Overlay toggle */}
            <div className="flex flex-col rounded-xl bg-white dark:bg-[#181b22] border border-slate-200/80 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <div className="flex items-center justify-between py-1 px-2.5">
                <div className="flex items-center gap-2">
                  {enableCamera ? (
                    <Video className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <VideoOff className="w-3.5 h-3.5 text-slate-400 dark:text-gray-400" />
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-white">Camera</span>
                    {enableCamera && (
                      <button
                        type="button"
                        onClick={() => setIsCameraOptionsOpen(!isCameraOptionsOpen)}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title={isCameraOptionsOpen ? 'Collapse Camera Options' : 'Expand Camera Options'}
                      >
                        {isCameraOptionsOpen ? (
                          <ChevronUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !enableCamera
                    console.log(`[BetterShot:Launcher] Camera toggle changed to: ${nextVal ? 'ON' : 'OFF'}`)
                    setEnableCamera(nextVal)
                    if (nextVal) {
                      setIsCameraOptionsOpen(true)
                    }
                  }}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer ${enableCamera
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : 'bg-slate-200 dark:bg-[#2a2e38] text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {enableCamera ? 'On' : 'Off'}
                </button>
              </div>

              {/* Expandable Camera Options Drawer */}
              {enableCamera && isCameraOptionsOpen && (
                <div className="px-2.5 pb-1.5 pt-1 border-t border-slate-100 dark:border-white/5 flex flex-col gap-1.5 bg-slate-50/50 dark:bg-[#15171e]/50 animate-in fade-in duration-150">
                  {/* Camera Device Selector if multiple cameras exist */}
                  {availableCameras.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 font-medium shrink-0">Device</span>
                      <select
                        value={cameraConfig.deviceId || ''}
                        onChange={(e) => setCameraConfig(prev => ({ ...prev, deviceId: e.target.value }))}
                        className="text-[10px] bg-white dark:bg-[#1e222b] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-0.5 text-slate-800 dark:text-white truncate max-w-[170px] outline-none"
                      >
                        {availableCameras.map((cam, idx) => (
                          <option key={cam.deviceId || idx} value={cam.deviceId}>
                            {cam.label || `Camera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Controls row: Shape, Position, Mirror, Mini Preview */}
                  <div className="flex items-center justify-between gap-1.5">
                    {/* Shape Selector */}
                    <div className="flex items-center gap-0.5 bg-white dark:bg-[#1a1d25] p-0.5 rounded-lg border border-slate-200/80 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => setCameraConfig(prev => ({ ...prev, shape: 'circle' }))}
                        title="Circle Bubble"
                        className={`p-1 rounded-md transition-colors cursor-pointer ${cameraConfig.shape === 'circle'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <CircleIcon className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCameraConfig(prev => ({ ...prev, shape: 'rect' }))}
                        title="Rounded Rectangle"
                        className={`p-1 rounded-md transition-colors cursor-pointer ${cameraConfig.shape === 'rect'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <SquareIcon className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Corner Position Selector */}
                    <div className="flex items-center gap-0.5 bg-white dark:bg-[#1a1d25] p-0.5 rounded-lg border border-slate-200/80 dark:border-white/5 text-[9px] font-bold">
                      {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map((pos) => {
                        const label = pos === 'bottom-right' ? 'BR' : pos === 'bottom-left' ? 'BL' : pos === 'top-right' ? 'TR' : 'TL'
                        const isSelected = cameraConfig.position === pos
                        return (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setCameraConfig(prev => ({ ...prev, position: pos }))}
                            title={`Corner: ${pos}`}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
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
                      className={`p-1 rounded-lg border transition-colors cursor-pointer ${cameraConfig.mirror
                          ? 'bg-blue-600/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                          : 'bg-white dark:bg-[#1a1d25] border-slate-200/80 dark:border-white/5 text-slate-400'
                        }`}
                    >
                      <FlipHorizontal className="w-3 h-3" />
                    </button>

                    {/* Mini live preview avatar */}
                    <div
                      className={`w-5 h-5 shrink-0 overflow-hidden border border-blue-500/40 shadow-xs bg-slate-900 ${cameraConfig.shape === 'circle' ? 'rounded-full' : 'rounded-md'
                        }`}
                      title="Camera Live Preview"
                    >
                      <video
                        ref={previewVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover pointer-events-none ${cameraConfig.mirror ? 'scale-x-[-1]' : ''}`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Screenshot Preferences */
          <div className="flex flex-col gap-1 shrink-0">
            {/* Copy to Clipboard toggle */}
            <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-white dark:bg-[#181b22] border border-slate-200/80 dark:border-white/5 shadow-xs">
              <div className="flex items-center gap-2">
                <Clipboard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-[11px] font-semibold text-slate-800 dark:text-white">Copy to Clipboard</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !copyToClipboard
                  console.log(`[BetterShot:Launcher] Copy to clipboard toggle: ${nextVal ? 'ON' : 'OFF'}`)
                  setCopyToClipboard(nextVal)
                }}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer ${copyToClipboard
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-slate-200 dark:bg-[#2a2e38] text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {copyToClipboard ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Primary CTA */}
        <div className="mt-2 shrink-0">
          {activeTab === 'recording' ? (
            <button
              onClick={() => {
                console.log(`[BetterShot:Launcher] Start Recording clicked with mode: ${activeCaptureMode}, sourceId: ${selectedSource?.id}`)
                onStartRecording(activeCaptureMode, selectedSource?.id || null)
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
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
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture Screenshot</span>
            </button>
          )}
        </div>
      </div>

      {/* Settings Modal Overlay */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Recording History Modal Overlay */}
      {isHistoryOpen && (
        <div className="absolute inset-0 bg-white/95 dark:bg-[#101216]/95 backdrop-blur-md z-30 flex flex-col p-3 overflow-hidden animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5 dark:border-white/10">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Recorded Videos
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {recordings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 text-xs py-8">
                <Film className="w-8 h-8 mb-2 opacity-40 text-slate-400 dark:text-gray-400" />
                No recorded videos yet
              </div>
            ) : (
              recordings.map((rec) => {
                const videoUri = `file:///${rec.filePath.replace(/\\/g, '/')}#t=0.5`
                return (
                  <div
                    key={rec.filePath}
                    onClick={() => handleEditRecording(rec.filePath)}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-[#181b22] border border-slate-200 dark:border-white/5 hover:border-blue-500/30 hover:bg-slate-100 dark:hover:bg-[#1f242e] transition-all flex items-center gap-2.5 cursor-pointer group"
                    title="Open in Studio Editor"
                  >
                    {/* Video Thumbnail Preview */}
                    <div className="relative w-12 h-9 rounded-lg overflow-hidden bg-slate-900 border border-slate-300 dark:border-white/10 shrink-0 flex items-center justify-center group-hover:border-blue-500/40 transition-colors shadow-inner">
                      <video
                        src={videoUri}
                        className="w-full h-full object-cover pointer-events-none"
                        preload="metadata"
                        muted
                      />
                    </div>

                    {/* Metadata details */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-medium text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {rec.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 truncate">
                        <span className="truncate">{formatDate(rec.createdAt)}</span>
                        <span className="text-slate-300 dark:text-gray-600 shrink-0">•</span>
                        <span className="shrink-0">{formatFileSize(rec.size)}</span>
                      </div>
                    </div>

                    {/* Single Action Button (Play) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePlayRecording(rec.filePath)
                      }}
                      className="w-6 h-6 rounded-lg bg-blue-600/15 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm cursor-pointer shrink-0"
                      title="Play Video"
                    >
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
