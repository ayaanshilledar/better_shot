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
  Film
} from 'lucide-react'
import { APP_CONFIG } from '../config/appConfig'
import { DesktopSource, RecordedFile } from '../../electron/preload'

export type CaptureMode = 'display' | 'area'

interface LauncherProps {
  onStartRecording: (mode: CaptureMode, sourceId: string | null) => void
  enableMic: boolean
  setEnableMic: (val: boolean) => void
  enableSystemAudio: boolean
  setEnableSystemAudio: (val: boolean) => void
  selectedSource: DesktopSource | null
  onOpenSourcePicker: () => void
  autoOpenHistory?: boolean
}

export const Launcher: React.FC<LauncherProps> = ({
  onStartRecording,
  enableMic,
  setEnableMic,
  enableSystemAudio,
  setEnableSystemAudio,
  selectedSource,
  onOpenSourcePicker,
  autoOpenHistory = false
}) => {
  const [activeCaptureMode, setActiveCaptureMode] = useState<CaptureMode>('display')
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)
  const [recordings, setRecordings] = useState<RecordedFile[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false)

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
    <div className="w-full h-full bg-[#101216] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl select-none font-sans relative">
      {/* Window Drag Header */}
      <header className="h-10 bg-[#12141a]/95 px-3 flex items-center justify-between select-none z-10 drag-region cursor-default shrink-0">
        <div className="flex items-center gap-2 no-drag">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1a1d26] rounded-lg border border-white/5 shadow-sm">
            <Film className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold tracking-tight text-white">
              {APP_CONFIG.appName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* History Icon */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleOpenHistory()
            }}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Recording History"
          >
            <History className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-white/10" />

          {/* Window controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('[BetterShot:Launcher] Minimize button clicked')
                window.electronAPI?.minimizeLauncher()
              }}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
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
              className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-md transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="px-3.5 pb-3.5 pt-2 flex-1 flex flex-col justify-between gap-2 overflow-hidden">
        {/* 2-Column Capture Mode Grid: Display & Area */}
        <div className="grid grid-cols-2 gap-2">
          {/* Display option */}
          <button
            onClick={() => handleModeClick('display')}
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${
              activeCaptureMode === 'display'
                ? 'bg-blue-600/20 border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg text-white'
                : 'bg-[#181b22] border-white/5 text-gray-400 hover:text-white hover:bg-[#20242e]'
            }`}
          >
            <Monitor className={`w-4 h-4 ${activeCaptureMode === 'display' ? 'text-blue-400' : 'text-gray-400'}`} />
            <span className="text-xs font-bold">Display</span>
          </button>

          {/* Area option */}
          <button
            onClick={() => handleModeClick('area')}
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${
              activeCaptureMode === 'area'
                ? 'bg-blue-600/20 border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg text-white'
                : 'bg-[#181b22] border-white/5 text-gray-400 hover:text-white hover:bg-[#20242e]'
            }`}
          >
            <Crop className={`w-4 h-4 ${activeCaptureMode === 'area' ? 'text-blue-400' : 'text-gray-400'}`} />
            <span className="text-xs font-bold">Area</span>
          </button>
        </div>

        {/* Audio Source Toggles */}
        <div className="flex flex-col gap-1.5">
          {/* Microphone toggle */}
          <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-[#181b22] border border-white/5">
            <div className="flex items-center gap-2">
              {enableMic ? (
                <Mic className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <MicOff className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className="text-xs font-semibold text-white">Microphone</span>
            </div>
            <button
              onClick={() => {
                const nextVal = !enableMic
                console.log(`[BetterShot:Launcher] Microphone toggle changed to: ${nextVal ? 'ON' : 'OFF'}`)
                setEnableMic(nextVal)
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                enableMic
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-[#2a2e38] text-gray-400 hover:text-white'
              }`}
            >
              {enableMic ? 'On' : 'Off'}
            </button>
          </div>

          {/* System Audio toggle */}
          <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-[#181b22] border border-white/5">
            <div className="flex items-center gap-2">
              {enableSystemAudio ? (
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className="text-xs font-semibold text-white">System Audio</span>
            </div>
            <button
              onClick={() => {
                const nextVal = !enableSystemAudio
                console.log(`[BetterShot:Launcher] System Audio toggle changed to: ${nextVal ? 'ON' : 'OFF'}`)
                setEnableSystemAudio(nextVal)
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                enableSystemAudio
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-[#2a2e38] text-gray-400 hover:text-white'
              }`}
            >
              {enableSystemAudio ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Start Recording CTA */}
        <button
          onClick={() => {
            console.log(`[BetterShot:Launcher] Start Recording clicked with mode: ${activeCaptureMode}, sourceId: ${selectedSource?.id}`)
            onStartRecording(activeCaptureMode, selectedSource?.id || null)
          }}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all cursor-pointer"
        >
          Start Recording
        </button>
      </div>

      {/* Recording History Modal Overlay */}
      {isHistoryOpen && (
        <div className="absolute inset-0 bg-[#101216]/95 backdrop-blur-md z-30 flex flex-col p-3 overflow-hidden animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 mb-2">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-blue-400" />
              Recorded Videos
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {recordings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs py-8">
                <Film className="w-8 h-8 mb-2 opacity-40 text-gray-400" />
                No recorded videos yet
              </div>
            ) : (
              recordings.map((rec) => {
                const videoUri = `file:///${rec.filePath.replace(/\\/g, '/')}#t=0.5`
                return (
                  <div
                    key={rec.filePath}
                    onClick={() => handleEditRecording(rec.filePath)}
                    className="p-2 rounded-xl bg-[#181b22] border border-white/5 hover:border-blue-500/30 hover:bg-[#1f242e] transition-all flex items-center gap-2.5 cursor-pointer group"
                    title="Open in Studio Editor"
                  >
                    {/* Video Thumbnail Preview */}
                    <div className="relative w-12 h-9 rounded-lg overflow-hidden bg-black/80 border border-white/10 shrink-0 flex items-center justify-center group-hover:border-blue-500/40 transition-colors shadow-inner">
                      <video
                        src={videoUri}
                        className="w-full h-full object-cover pointer-events-none"
                        preload="metadata"
                        muted
                      />
                    </div>

                    {/* Metadata details */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                        {rec.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5 truncate">
                        <span className="truncate">{formatDate(rec.createdAt)}</span>
                        <span className="text-gray-600 shrink-0">•</span>
                        <span className="shrink-0">{formatFileSize(rec.size)}</span>
                      </div>
                    </div>

                    {/* Single Action Button (Play) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePlayRecording(rec.filePath)
                      }}
                      className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm cursor-pointer shrink-0"
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
