import React, { useState, useEffect, useRef } from 'react'
import { StudioProject, StudioRuntimeState, CropRegionData, ZoomEvent } from '../../types/editor'
import { createDefaultProject } from '../../services/projectService'
import { generateAutoZooms, AutoZoomOptions } from '../../utils/zoomUtils'
import { EditorTopBar } from './EditorTopBar'
import { StudioCanvas } from './StudioCanvas'
import { EditorSidebar } from './EditorSidebar'
import { EditorTimeline } from './EditorTimeline'
import { CropModal } from './CropModal'

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

      if (Number.isFinite(dur) && dur > 0) {
        updateProject((p) => ({
          ...p,
          media: {
            ...p.media,
            duration: dur,
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080
          }
        }))
      }
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

  // ZOOM EVENT MANAGEMENT HANDLERS
  const handleAddZoomEvent = (zoomData?: Partial<ZoomEvent>) => {
    const newId = `zoom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const newZoom: ZoomEvent = {
      id: newId,
      startTime: parseFloat(runtime.currentTime.toFixed(2)),
      duration: 2.0,
      easeInDuration: 0.4,
      easeOutDuration: 0.4,
      x: 50,
      y: 50,
      scale: 1.8,
      easing: 'ease-in-out',
      type: 'manual',
      label: 'Manual Zoom',
      ...zoomData
    }

    updateProject((p) => ({
      ...p,
      timeline: {
        ...p.timeline,
        zoomEvents: [...p.timeline.zoomEvents, newZoom]
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
          zoomEvents: p.timeline.zoomEvents.map((z) =>
            z.id === zoomId ? { ...z, ...updates } : z
          )
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
    const autoZooms = generateAutoZooms(totalDuration, options)

    updateProject((p) => {
      const manualZooms = p.timeline.zoomEvents.filter((z) => z.type !== 'auto')
      return {
        ...p,
        timeline: {
          ...p.timeline,
          zoomEvents: [...manualZooms, ...autoZooms]
        }
      }
    })

    if (autoZooms.length > 0) {
      setRuntime((r) => ({
        ...r,
        selectedTab: 'zoom',
        selectedZoomId: autoZooms[0].id
      }))
    }
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

  const handleExport = async () => {
    alert(`Exporting project "${project.title}" to MP4 with ${project.background.presetId} background frame...`)
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
        />

        <EditorSidebar
          project={project}
          runtime={runtime}
          onExport={handleExport}
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
    </div>
  )
}
