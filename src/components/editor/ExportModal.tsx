import React, { useRef, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  AlertCircle,
  Folder,
  Play,
  Copy,
  Check,
  Film,
  Sparkles,
  Loader2
} from 'lucide-react'
import { ExportProgress, StudioProject, ExportSettings } from '../../types/editor'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onCancel: () => void
  progress: ExportProgress
  project: StudioProject
  settings: ExportSettings
  previewCanvasRef?: React.RefObject<HTMLCanvasElement | null>
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  progress,
  project,
  settings,
  previewCanvasRef
}) => {
  const [copied, setCopied] = React.useState(false)
  const miniCanvasRef = useRef<HTMLCanvasElement>(null)

  // Sync frame preview from the export service into our modal's canvas
  useEffect(() => {
    if (!isOpen) return

    const updatePreview = () => {
      const sourceCanvas = previewCanvasRef?.current
      const targetCanvas = miniCanvasRef.current
      if (sourceCanvas && targetCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
        if (targetCanvas.width !== sourceCanvas.width || targetCanvas.height !== sourceCanvas.height) {
          targetCanvas.width = sourceCanvas.width
          targetCanvas.height = sourceCanvas.height
        }
        const targetCtx = targetCanvas.getContext('2d')
        if (targetCtx) {
          targetCtx.drawImage(sourceCanvas, 0, 0)
        }
      }
    }

    const interval = setInterval(updatePreview, 66)
    return () => clearInterval(interval)
  }, [isOpen, previewCanvasRef])

  if (!isOpen) return null

  const isExporting =
    progress.phase === 'preparing' ||
    progress.phase === 'rendering' ||
    progress.phase === 'encoding' ||
    progress.phase === 'saving'

  const isCompleted = progress.phase === 'completed'
  const isError = progress.phase === 'error'

  const handleCopyPath = () => {
    if (progress.filePath) {
      navigator.clipboard.writeText(progress.filePath)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenVideo = () => {
    if (progress.filePath && window.electronAPI?.openRecordingFile) {
      window.electronAPI.openRecordingFile(progress.filePath)
    }
  }

  const handleShowInFolder = () => {
    if (progress.filePath && window.electronAPI?.showItemInFolder) {
      window.electronAPI.showItemInFolder(progress.filePath)
    } else if (window.electronAPI?.openRecordingsFolder) {
      window.electronAPI.openRecordingsFolder()
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    const mb = bytes / (1024 * 1024)
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(1)} MB`
  }

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#161924]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/20">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                {isCompleted
                  ? 'Export Complete'
                  : isError
                  ? 'Export Failed'
                  : 'Exporting Studio Video'}
              </h3>
              <p className="text-[11px] text-gray-400">
                {project.title} • {settings.resolution.toUpperCase()} ({settings.fps} FPS)
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-5">
          {/* Active Exporting State */}
          {isExporting && (
            <div className="flex flex-col gap-4">
              {/* Mini Preview Box */}
              <div className="relative w-full aspect-video bg-black/60 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center shadow-inner">
                <canvas
                  ref={miniCanvasRef}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono font-semibold text-blue-300 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE ENCODER STREAM
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-gray-300">
                  {formatTime(progress.currentTime)} / {formatTime(progress.totalDuration)}
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    {progress.phase === 'preparing' && 'Preparing studio timeline assets...'}
                    {progress.phase === 'rendering' && 'Rendering canvas frames & audio...'}
                    {progress.phase === 'encoding' && 'Finalizing container stream encoding...'}
                    {progress.phase === 'saving' && 'Saving video to disk...'}
                  </span>
                  <span className="font-mono font-bold text-blue-400 text-sm">
                    {progress.progress}%
                  </span>
                </div>

                <div className="h-2 w-full bg-[#1c202e] rounded-full overflow-hidden p-0.5 border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-200 shadow-lg shadow-blue-500/50"
                    style={{ width: `${Math.max(3, progress.progress)}%` }}
                  />
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-[#161924] p-2.5 rounded-xl border border-white/5 text-center">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400">Target Resolution</span>
                  <span className="text-xs font-mono font-bold text-gray-200 uppercase">
                    {settings.resolution}
                  </span>
                </div>
                <div className="flex flex-col border-x border-white/5">
                  <span className="text-[10px] text-gray-400">Frame Rate</span>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {settings.fps} FPS
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400">Remaining</span>
                  <span className="text-xs font-mono font-bold text-gray-200">
                    {Number.isFinite(progress.etaSeconds) && progress.etaSeconds > 0
                      ? `~${Math.round(progress.etaSeconds)}s`
                      : 'Finishing...'}
                  </span>
                </div>
              </div>

              {/* Cancel Button */}
              <button
                onClick={onCancel}
                className="w-full py-2 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 font-semibold text-xs rounded-xl transition-all cursor-pointer mt-1"
              >
                Cancel Export
              </button>
            </div>
          )}

          {/* Success State */}
          {isCompleted && (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Video Rendered Successfully!</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Your styled recording is ready with all zoom effects, frames, and audio.
                </p>
              </div>

              {/* File Info Box */}
              <div className="w-full bg-[#161924] border border-white/5 rounded-xl p-3 flex flex-col gap-2 text-left">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                  <span className="text-gray-400">Resolution & Format:</span>
                  <span className="font-mono font-semibold text-white uppercase">
                    {settings.resolution} • {settings.format.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                  <span className="text-gray-400">File Size:</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {formatFileSize(progress.fileSize)}
                  </span>
                </div>
                {progress.filePath && (
                  <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                    <span className="text-gray-400 shrink-0">Saved to:</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[11px] text-gray-300 truncate max-w-[220px]">
                        {progress.filePath}
                      </span>
                      <button
                        onClick={handleCopyPath}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Copy file path"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="w-full grid grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={handleOpenVideo}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Play Video</span>
                </button>
                <button
                  onClick={handleShowInFolder}
                  className="py-2.5 px-3 bg-[#1a1e2b] hover:bg-[#232838] border border-white/10 text-gray-200 hover:text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Folder className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Show in Folder</span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Back to Editor
              </button>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="flex flex-col items-center text-center gap-4 py-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/10">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Export Failed</h4>
                <p className="text-xs text-red-300/80 mt-1 max-w-sm">
                  {progress.error || 'An unexpected error occurred during encoding.'}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-[#1a1e2b] hover:bg-[#232838] text-white text-xs font-semibold rounded-xl border border-white/10 transition-all cursor-pointer mt-2"
              >
                Close & Return
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
