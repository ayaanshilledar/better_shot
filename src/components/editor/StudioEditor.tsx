import React, { useState, useEffect, useRef } from 'react'
import { StudioProject, StudioRuntimeState, CropRegionData, ZoomEvent, ExportProgress } from '../../types/editor'
import { createDefaultProject } from '../../services/projectService'
import { generateAutoZooms, AutoZoomOptions } from '../../utils/zoomUtils'
import { createExportProcess } from '../../services/exportService'
import { EditorTopBar } from './EditorTopBar'
import { StudioCanvas } from './StudioCanvas'
import { EditorSidebar } from './EditorSidebar'
import { EditorTimeline } from './EditorTimeline'
import { CropModal } from './CropModal'
import { ExportModal } from './ExportModal'

interface StudioEditorProps {
  recordingFilePath?: string
  onCloseEditor?: () => void
}

export const StudioEditor: React.FC<StudioEditorProps> = ({
  recordingFilePath,
  onCloseEditor
}) => {
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false)
  const defaultPath = recordingFilePath || 'c:\\Users\\ayaan\\Videos\\BetterShot\\BetterShot_demo.webm'
  const defaultFileName = defaultPath.split(/[\\/]/).pop() || 'recording.webm'

  // Master Project State (Persistent)
  const [project, setProject] = useState<StudioProject>(() =>
    createDefaultProject(defaultPath, defaultFileName)
  )

  // Undo / Redo History Stack
  const [history, setHistory] = useState<StudioProject[]>([project])
  const [historyIndex, setHistoryIndex] = useState<number>(0)
  const isUndoRedoRef = useRef<boolean>(false)

  // Runtime UI State (Ephemeral)
  const [runtime, setRuntime] = useState<StudioRuntimeState>({
    status: 'ready',
    currentTime: 0,
    isPlaying: false,
    selectedTab: 'background',
    selectedClipId: null,
    selectedZoomId: null,
    previewScale: 'full',
    timelineZoom: 1.0,
    hoverState: { element: null },
    isVideoSelected: false
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Update project & push to history stack (supports skipHistory for smooth drag rendering)
  const updateProject = (
    updater: (prev: StudioProject) => StudioProject,
    skipHistory = false
  ) => {
    setProject((prevProject) => {
      const next = updater(prevProject)
      next.updatedAt = Date.now()

      if (!isUndoRedoRef.current && !skipHistory) {
        setHistory((prevHistory) => {
          const validIndex = Math.max(0, Math.min(historyIndex, prevHistory.length - 1))
          const sliced = prevHistory.slice(0, validIndex + 1)
          return [...sliced, next]
        })
        setHistoryIndex((prevIndex) => prevIndex + 1)
      }
      isUndoRedoRef.current = false
      return next
    })
  }

  // Handle Undo (Ctrl+Z)
  const handleUndo = () => {
    if (historyIndex > 0 && history[historyIndex - 1]) {
      isUndoRedoRef.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setProject(history[newIndex])
    }
  }

  // Handle Redo (Ctrl+Y)
  const handleRedo = () => {
    if (historyIndex < history.length - 1 && history[historyIndex + 1]) {
      isUndoRedoRef.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setProject(history[newIndex])
    }
  }

  // Keybindings for Space (Play/Pause), Undo, Redo, Delete Zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        handleTogglePlay()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && runtime.selectedZoomId) {
        handleDeleteZoomEvent(runtime.selectedZoomId)
      } else if (e.key === 'Escape') {
        if (onCloseEditor) onCloseEditor()
        else if (window.electronAPI?.closeEditorWindow) window.electronAPI.closeEditorWindow()
        else window.electronAPI?.closeLauncher()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history, runtime.isPlaying, runtime.selectedZoomId])

  // 60FPS Smooth playback loop for continuous playhead & time animation
  useEffect(() => {
    if (!runtime.isPlaying) return

    let animId: number
    const syncTime = () => {
      if (videoRef.current && !videoRef.current.paused) {
        setRuntime((r) => ({ ...r, currentTime: videoRef.current!.currentTime }))
      }
      animId = requestAnimationFrame(syncTime)
    }

    animId = requestAnimationFrame(syncTime)
    return () => cancelAnimationFrame(animId)
  }, [runtime.isPlaying])

  // Play/Pause Video toggle
  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (runtime.isPlaying) {
        videoRef.current.pause()
        setRuntime((r) => ({ ...r, isPlaying: false }))
      } else {
        videoRef.current.play().catch((err) => console.warn('Video play error:', err))
        setRuntime((r) => ({ ...r, isPlaying: true }))
      }
    }
  }

  // Video duration & time listener
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      let dur = video.duration
      if (!Number.isFinite(dur) || dur <= 0) {
        if (video.seekable && video.seekable.length > 0) {
          dur = video.seekable.end(0)
        }
      }

      const w = video.videoWidth || 1920
      const h = video.videoHeight || 1080

      updateProject((p) => ({
        ...p,
        media: {
          ...p.media,
          duration: Number.isFinite(dur) && dur > 0 ? dur : p.media.duration,
          width: w,
          height: h
        }
      }))
    }

    const handleEnded = () => {
      setRuntime((r) => ({ ...r, isPlaying: false, currentTime: 0 }))
      if (videoRef.current) videoRef.current.currentTime = 0
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('durationchange', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('durationchange', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
    }
  }, [videoRef.current])

  const handleSeek = (time: number) => {
    if (videoRef.current && Number.isFinite(time)) {
      videoRef.current.currentTime = time
    }
    setRuntime((r) => ({ ...r, currentTime: Number.isFinite(time) ? time : 0 }))
  }

  const handleDeleteProject = async () => {
    if (confirm(`Are you sure you want to delete "${project.title}"?`)) {
      if (window.electronAPI?.deleteRecording && project.media.sourcePath) {
        await window.electronAPI.deleteRecording(project.media.sourcePath)
      }
      if (onCloseEditor) onCloseEditor()
      else if (window.electronAPI?.closeEditorWindow) window.electronAPI.closeEditorWindow()
      else window.electronAPI?.closeLauncher()
    }
  }

  const handleAutoFormat = () => {
    updateProject((p) => ({
      ...p,
      layout: {
        ...p.layout,
        padding: 10,
        cornerRadius: 12,
        shadow: 'medium'
      }
    }))
  }

  const handleToggleCrop = () => {
    setIsCropModalOpen(true)
  }

  const handleApplyCrop = (cropData: CropRegionData) => {
    updateProject((p) => ({
      ...p,
      layout: {
        ...p.layout,
        aspectRatio: cropData.aspectRatio as any,
        cropRegion: cropData
      }
    }))
  }

  const handleToggleFrame = () => {
    const nextRadius = project.layout.cornerRadius > 0 ? 0 : 16
    updateProject((p) => ({
      ...p,
      layout: { ...p.layout, cornerRadius: nextRadius }
    }))
  }

  // ZOOM EVENT MANAGEMENT HANDLERS (Non-overlapping timeframe guarantee)
  const handleAddZoomEvent = (zoomData?: Partial<ZoomEvent>) => {
    const rawDuration = project.media.duration
    const totalDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 10.0
    const targetStart = parseFloat((zoomData?.startTime ?? runtime.currentTime).toFixed(2))

    // Check if targetStart falls inside any existing zoom event
    const existingZooms = [...project.timeline.zoomEvents].sort((a, b) => a.startTime - b.startTime)
    const activeAtStart = existingZooms.find(
      (z) => targetStart >= z.startTime && targetStart < z.startTime + z.duration
    )

    if (activeAtStart) {
      // Already inside a zoom event at this timeframe! Select the existing one instead of creating a conflicting duplicate
      setRuntime((r) => ({
        ...r,
        selectedTab: 'zoom',
        selectedZoomId: activeAtStart.id
      }))
      return
    }

    // Check if there is enough room before totalDuration ends
    if (targetStart >= totalDuration - 0.2) {
      return
    }

    // Find the next upcoming zoom event after targetStart
    const nextZoom = existingZooms.find((z) => z.startTime > targetStart)
    const availableGap = nextZoom ? nextZoom.startTime - targetStart : totalDuration - targetStart

    // Minimum usable duration for a zoom event is 0.3s
    if (availableGap < 0.3) {
      return
    }

    // Desired duration (default 2.0s or custom from zoomData, clamped to available gap)
    const desiredDuration = zoomData?.duration ?? 2.0
    const finalDuration = parseFloat(Math.max(0.3, Math.min(desiredDuration, availableGap)).toFixed(2))

    const newId = `zoom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const newZoom: ZoomEvent = {
      id: newId,
      easeInDuration: Math.min(0.4, parseFloat((finalDuration / 2).toFixed(2))),
      easeOutDuration: Math.min(0.4, parseFloat((finalDuration / 2).toFixed(2))),
      x: 50,
      y: 50,
      scale: 1.8,
      easing: 'ease-in-out',
      type: 'manual',
      label: 'Manual Zoom',
      ...zoomData,
      startTime: targetStart,
      duration: finalDuration
    }

    updateProject((p) => ({
      ...p,
      timeline: {
        ...p.timeline,
        zoomEvents: [...p.timeline.zoomEvents, newZoom].sort((a, b) => a.startTime - b.startTime)
      }
    }))

    setRuntime((r) => ({
      ...r,
      selectedTab: 'zoom',
      selectedZoomId: newId
    }))
  }

  const handleUpdateZoomEvent = (zoomId: string, updates: Partial<ZoomEvent>, skipHistory = false) => {
    updateProject(
      (p) => ({
        ...p,
        timeline: {
          ...p.timeline,
          zoomEvents: p.timeline.zoomEvents
            .map((z) => (z.id === zoomId ? { ...z, ...updates } : z))
            .sort((a, b) => a.startTime - b.startTime)
        }
      }),
      skipHistory
    )
  }

  const handleDeleteZoomEvent = (zoomId: string) => {
    updateProject((p) => ({
      ...p,
      timeline: {
        ...p.timeline,
        zoomEvents: p.timeline.zoomEvents.filter((z) => z.id !== zoomId)
      }
    }))

    if (runtime.selectedZoomId === zoomId) {
      setRuntime((r) => ({ ...r, selectedZoomId: null }))
    }
  }

  const handleGenerateAutoZooms = (options?: AutoZoomOptions) => {
    const totalDuration = project.media.duration || 10
    const rawAutoZooms = generateAutoZooms(totalDuration, options)

    updateProject((p) => {
      const manualZooms = p.timeline.zoomEvents.filter((z) => z.type !== 'auto')
      // Only keep auto zooms that do not collide with any manual zoom
      const nonCollidingAutoZooms = rawAutoZooms.filter((autoZ) => {
        const autoEnd = autoZ.startTime + autoZ.duration
        return !manualZooms.some((manZ) => {
          const manEnd = manZ.startTime + manZ.duration
          return autoZ.startTime < manEnd && autoEnd > manZ.startTime
        })
      })

      return {
        ...p,
        timeline: {
          ...p.timeline,
          zoomEvents: [...manualZooms, ...nonCollidingAutoZooms].sort((a, b) => a.startTime - b.startTime)
        }
      }
    })

    setRuntime((r) => ({
      ...r,
      selectedTab: 'zoom'
    }))
  }

  const handleClearAutoZooms = () => {
    updateProject((p) => ({
      ...p,
      timeline: {
        ...p.timeline,
        zoomEvents: p.timeline.zoomEvents.filter((z) => z.type !== 'auto')
      }
    }))

    setRuntime((r) => ({ ...r, selectedZoomId: null }))
  }

  const handleUpdateZoomFocalPoint = (zoomId: string, x: number, y: number) => {
    updateProject(
      (p) => ({
        ...p,
        timeline: {
          ...p.timeline,
          zoomEvents: p.timeline.zoomEvents.map((z) =>
            z.id === zoomId ? { ...z, x, y } : z
          )
        }
      }),
      true
    )
  }

  // Export State and Handlers
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    progress: 0,
    currentTime: 0,
    totalDuration: 1,
    fps: 60,
    etaSeconds: 0,
    phase: 'preparing'
  })
  const exportCancelRef = useRef<(() => void) | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const handleStartExport = () => {
    setIsExportModalOpen(true)
    const currentSettings = {
      format: project.exportSettings?.format || 'mp4',
      resolution: project.exportSettings?.resolution || '1080p',
      fps: project.exportSettings?.fps || 60,
      bitratePreset: project.exportSettings?.bitratePreset || 'high',
      customBitrateMbps: project.exportSettings?.customBitrateMbps || 12,
      includeAudio: project.exportSettings?.includeAudio ?? true,
      audioBitrateKbps: project.exportSettings?.audioBitrateKbps || 192,
      saveLocation: project.exportSettings?.saveLocation
    }

    const { promise, cancel } = createExportProcess(
      project,
      currentSettings,
      (prog) => setExportProgress(prog),
      (canvas) => {
        previewCanvasRef.current = canvas
      }
    )

    exportCancelRef.current = cancel
    promise.catch((err) => {
      console.error('Export error:', err)
    })
  }

  const handleCancelExport = () => {
    if (exportCancelRef.current) {
      exportCancelRef.current()
      exportCancelRef.current = null
    }
  }

  const handleCloseExportModal = () => {
    handleCancelExport()
    setIsExportModalOpen(false)
  }

  return (
    <div className="w-screen h-screen bg-[#0d0d11] text-white flex flex-col overflow-hidden font-sans select-none relative">
      {/* Top Navigation & Action Header */}
      <EditorTopBar
        project={project}
        runtime={runtime}
        onUpdateTitle={(title) => updateProject((p) => ({ ...p, title }))}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onExport={() => setRuntime((r) => ({ ...r, selectedTab: 'export' }))}
        onScaleChange={(scale) => setRuntime((r) => ({ ...r, previewScale: scale }))}
        onClose={() => {
          if (onCloseEditor) onCloseEditor()
          else if (window.electronAPI?.closeEditorWindow) window.electronAPI.closeEditorWindow()
          else window.electronAPI?.closeLauncher()
        }}
        onMinimize={() => window.electronAPI?.minimizeLauncher()}
        onDeleteProject={handleDeleteProject}
        onSelectTab={(tab) => setRuntime((r) => ({ ...r, selectedTab: tab }))}
        onAutoFormat={handleAutoFormat}
        onToggleCrop={handleToggleCrop}
        onToggleFrame={handleToggleFrame}
      />

      {/* Main Studio Middle Area: Stage + Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <StudioCanvas
          project={project}
          runtime={runtime}
          videoRef={videoRef}
          onTogglePlay={handleTogglePlay}
          onTimeUpdate={(t) => setRuntime((r) => ({ ...r, currentTime: t }))}
          onSeek={handleSeek}
          onZoomChange={(zoom) => setRuntime((r) => ({ ...r, timelineZoom: zoom }))}
          onSelectVideo={() => setRuntime((r) => ({ ...r, isVideoSelected: true }))}
          onDeselectVideo={() => setRuntime((r) => ({ ...r, isVideoSelected: false }))}
          onUpdateLayout={(updates, skipHistory) =>
            updateProject(
              (p) => ({
                ...p,
                layout: { ...p.layout, ...updates }
              }),
              skipHistory
            )
          }
          onUpdateZoomFocalPoint={handleUpdateZoomFocalPoint}
          onToggleCrop={handleToggleCrop}
          onScaleChange={(scale) => setRuntime((r) => ({ ...r, previewScale: scale }))}
        />

        <EditorSidebar
          project={project}
          runtime={runtime}
          onExport={handleStartExport}
          onUpdateExportSettings={(updates) =>
            updateProject((p) => ({
              ...p,
              exportSettings: { ...p.exportSettings, ...updates }
            }))
          }
          onUpdateBackground={(updates) =>
            updateProject((p) => ({
              ...p,
              background: { ...p.background, ...updates }
            }))
          }
          onUpdateLayout={(updates) =>
            updateProject((p) => ({
              ...p,
              layout: { ...p.layout, ...updates }
            }))
          }
          onSelectTab={(tab) => setRuntime((r) => ({ ...r, selectedTab: tab }))}
          onAddZoomEvent={handleAddZoomEvent}
          onUpdateZoomEvent={handleUpdateZoomEvent}
          onDeleteZoomEvent={handleDeleteZoomEvent}
          onSelectZoomEvent={(zoomId) => setRuntime((r) => ({ ...r, selectedZoomId: zoomId }))}
          onGenerateAutoZooms={handleGenerateAutoZooms}
          onClearAutoZooms={handleClearAutoZooms}
        />
      </div>

      {/* Bottom Timeline Section */}
      <EditorTimeline
        project={project}
        runtime={runtime}
        onSeek={handleSeek}
        onSelectZoomEvent={(zoomId) => setRuntime((r) => ({ ...r, selectedTab: 'zoom', selectedZoomId: zoomId }))}
        onAddZoomEvent={handleAddZoomEvent}
        onUpdateZoomEvent={handleUpdateZoomEvent}
        onDeleteZoomEvent={handleDeleteZoomEvent}
      />

      {/* Crop Modal Dialog */}
      <CropModal
        isOpen={isCropModalOpen}
        onClose={() => setIsCropModalOpen(false)}
        project={project}
        onApplyCrop={handleApplyCrop}
      />

      {/* Export Progress Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        onCancel={handleCancelExport}
        progress={exportProgress}
        project={project}
        settings={project.exportSettings}
        previewCanvasRef={previewCanvasRef}
      />
    </div>
  )
}
