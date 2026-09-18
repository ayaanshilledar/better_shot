import React, { useRef, useState } from 'react'
import { Plus, Video, ZoomIn, Film, Sparkles, Target, Trash2 } from 'lucide-react'
import { StudioProject, StudioRuntimeState, ZoomEvent } from '../../types/editor'

interface EditorTimelineProps {
  project: StudioProject
  runtime: StudioRuntimeState
  onSeek: (time: number) => void
  onSelectZoomEvent?: (zoomId: string | null) => void
  onAddZoomEvent?: (zoomData?: Partial<ZoomEvent>) => void
  onUpdateZoomEvent?: (zoomId: string, updates: Partial<ZoomEvent>, skipHistory?: boolean) => void
  onDeleteZoomEvent?: (zoomId: string) => void
}

export const EditorTimeline: React.FC<EditorTimelineProps> = ({
  project,
  runtime,
  onSeek,
  onSelectZoomEvent,
  onAddZoomEvent,
  onUpdateZoomEvent,
  onDeleteZoomEvent
}) => {
  const rulerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dragMode, setDragMode] = useState<'move' | 'resize-left' | 'resize-right' | null>(null)

  const [trackHoverTime, setTrackHoverTime] = useState<number | null>(null)
  const [trackHoverX, setTrackHoverX] = useState<number | null>(null)

  const rawDuration = project.media.duration
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 5.0

  // Calculate position percentage for red playhead scrubber line
  const playheadPercent = duration > 0 ? Math.min(100, Math.max(0, (runtime.currentTime / duration) * 100)) : 0

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return
    const rect = rulerRef.current.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, offsetX / rect.width))
    onSeek(percent * duration)
  }

  // Generate ruler tick marks (every 1 sec, capped at max 3600 seconds)
  const maxSec = Math.min(3600, Math.max(1, Math.ceil(duration)))
  const ticks: number[] = []
  for (let i = 0; i <= maxSec; i++) {
    ticks.push(i)
  }

  // Check if track hover time falls inside an existing zoom block
  const isHoveringExistingBlock = Boolean(
    trackHoverTime !== null &&
    project.timeline.zoomEvents.some(
      (z) => trackHoverTime >= z.startTime && trackHoverTime <= z.startTime + z.duration
    )
  )

  // Track Mouse Movement over Zoom Track Row for Ghost Add Preview
  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, offsetX / rect.width))
    const hoverSec = parseFloat((percent * duration).toFixed(2))
    setTrackHoverTime(hoverSec)
    setTrackHoverX(offsetX)
  }

  const handleTrackMouseLeave = () => {
    setTrackHoverTime(null)
    setTrackHoverX(null)
  }

  // Click on empty Zoom Track row area to add Zoom keyframe at mouse location
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (trackHoverTime !== null && onAddZoomEvent && !isHoveringExistingBlock && !activeDragId) {
      onSeek(trackHoverTime)
      onAddZoomEvent({ startTime: trackHoverTime })
    }
  }

  // Handle Dragging Zoom Event Block (Move or Resize)
  const handleZoomBlockMouseDown = (
    e: React.MouseEvent,
    z: ZoomEvent,
    mode: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.stopPropagation()
    if (e.button !== 0) return

    if (onSelectZoomEvent) onSelectZoomEvent(z.id)

    setActiveDragId(z.id)
    setDragMode(mode)

    const startX = e.clientX
    const startStartTime = z.startTime
    const startDuration = z.duration

    const trackEl = trackRef.current
    if (!trackEl) return

    const trackWidth = trackEl.getBoundingClientRect().width || 1

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaTime = (deltaX / trackWidth) * duration

      if (mode === 'move') {
        const nextStartTime = Math.max(0, Math.min(duration - startDuration, startStartTime + deltaTime))
        const roundedStart = parseFloat(nextStartTime.toFixed(2))

        if (onUpdateZoomEvent) {
          onUpdateZoomEvent(z.id, { startTime: roundedStart }, true)
        }
        onSeek(roundedStart)
      } else if (mode === 'resize-left') {
        const maxStart = startStartTime + startDuration - 0.2
        const nextStartTime = Math.max(0, Math.min(maxStart, startStartTime + deltaTime))
        const nextDuration = startStartTime + startDuration - nextStartTime

        const roundedStart = parseFloat(nextStartTime.toFixed(2))
        const roundedDur = parseFloat(nextDuration.toFixed(2))

        if (onUpdateZoomEvent) {
          onUpdateZoomEvent(z.id, { startTime: roundedStart, duration: roundedDur }, true)
        }
        onSeek(roundedStart)
      } else if (mode === 'resize-right') {
        const nextDuration = Math.max(0.2, Math.min(duration - startStartTime, startDuration + deltaTime))
        const roundedDur = parseFloat(nextDuration.toFixed(2))

        if (onUpdateZoomEvent) {
          onUpdateZoomEvent(z.id, { duration: roundedDur }, true)
        }
      }
    }

    const handleMouseUp = () => {
      setActiveDragId(null)
      setDragMode(null)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div className="h-52 bg-[#101216] border-t border-white/10 flex flex-col select-none z-30">
      {/* Timeline Controls & Header */}
      <div className="h-9 px-3 border-b border-white/5 bg-[#14161f] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddZoomEvent && onAddZoomEvent()}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-bold text-xs rounded-lg border border-purple-500/30 transition-all cursor-pointer"
            title="Add Zoom Keyframe at current playhead position"
          >
            <Plus className="w-3.5 h-3.5 text-purple-400" />
            <span>Add Zoom</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
          <span>
            {Math.floor(runtime.currentTime / 60)}:
            {(runtime.currentTime % 60).toFixed(2).padStart(5, '0')} / {Math.floor(duration / 60)}:
            {(duration % 60).toFixed(2).padStart(5, '0')}
          </span>
        </div>
      </div>

      {/* Main Track Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Track Labels Column */}
        <div className="w-28 bg-[#12141a] border-r border-white/10 flex flex-col pt-7 z-10">
          <div className="h-9 px-3 flex items-center gap-2 text-xs font-semibold text-gray-300 border-b border-white/5">
            <Video className="w-3.5 h-3.5 text-blue-400" />
            <span>Video</span>
          </div>

          <div className="h-10 px-3 flex items-center justify-between text-xs font-semibold text-gray-300 border-b border-white/5 group">
            <div className="flex items-center gap-2">
              <ZoomIn className="w-3.5 h-3.5 text-purple-400" />
              <span>Zoom</span>
            </div>
            <button
              onClick={() => onAddZoomEvent && onAddZoomEvent()}
              className="p-1 hover:bg-purple-500/20 text-purple-400 rounded transition-colors cursor-pointer"
              title="Add Zoom Keyframe"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-x-auto relative custom-scrollbar bg-[#0b0c10]">
          {/* Scalable Inner Track Container */}
          <div
            ref={trackRef}
            className="relative transition-all duration-150 flex flex-col min-w-full min-h-full"
            style={{ width: `${(runtime.timelineZoom || 1.0) * 100}%` }}
          >
            {/* Time Scrubber Ruler Bar */}
            <div
              ref={rulerRef}
              onClick={handleRulerClick}
              className="h-7 bg-[#14161f] border-b border-white/10 relative cursor-pointer flex items-center select-none"
            >
              {ticks.map((t) => {
                const pos = (t / duration) * 100
                return (
                  <div key={t} className="absolute flex flex-col items-center" style={{ left: `${pos}%` }}>
                    <div className="h-2 w-px bg-gray-500" />
                    <span className="text-[10px] font-mono text-gray-400 mt-0.5">0:{t.toString().padStart(2, '0')}</span>
                  </div>
                )
              })}
            </div>

            {/* Red Playhead Line */}
            <div
              className={`absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none ${
                runtime.isPlaying ? 'transition-none' : 'transition-all duration-75'
              }`}
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-1 shadow-md shadow-red-500/50" />
            </div>

            {/* Track 1: Video Track Layer */}
            <div className="h-9 border-b border-white/5 relative flex items-center px-1">
              <div
                className="h-7 bg-blue-600/30 border border-blue-500/50 rounded-lg flex items-center px-3 gap-2 text-xs font-semibold text-blue-200 shadow-sm transition-all"
                style={{ width: '100%' }}
              >
                <Film className="w-3.5 h-3.5 text-blue-400" />
                <span>Clip {Math.round(duration)}s</span>
                <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 font-mono">1x</span>
              </div>
            </div>

            {/* Track 2: Zoom Track Layer with Interactive Hover & Add Option */}
            <div
              onMouseMove={handleTrackMouseMove}
              onMouseLeave={handleTrackMouseLeave}
              onClick={handleTrackClick}
              className="h-10 border-b border-white/5 relative flex items-center px-1 bg-[#10121a]/60 hover:bg-[#151726]/80 cursor-pointer transition-colors group"
            >
              {/* Interactive Ghost "+ Add Zoom" Preview Button on Hover (Only over empty track space) */}
              {trackHoverX !== null && trackHoverTime !== null && !activeDragId && !isHoveringExistingBlock && (
                <div
                  className="absolute z-20 pointer-events-none -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-purple-600/90 text-white border border-purple-400 text-[10px] font-bold rounded-lg shadow-xl shadow-purple-600/50 backdrop-blur-sm animate-pulse"
                  style={{ left: `${trackHoverX}px` }}
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Zoom @ {trackHoverTime.toFixed(2)}s</span>
                </div>
              )}

              {project.timeline.zoomEvents.length === 0 ? (
                <span className="text-[10px] text-gray-500 pl-3 italic group-hover:text-purple-300 transition-colors">
                  Click anywhere on this track to add a zoom keyframe
                </span>
              ) : (
                project.timeline.zoomEvents.map((z) => {
                  const leftPercent = (z.startTime / duration) * 100
                  const widthPercent = (z.duration / duration) * 100
                  const isSelected = z.id === runtime.selectedZoomId
                  const isDraggingThis = activeDragId === z.id

                  return (
                    <div
                      key={z.id}
                      onMouseDown={(e) => handleZoomBlockMouseDown(e, z, 'move')}
                      className={`absolute h-8 rounded-lg border flex items-center justify-between px-2 cursor-grab active:cursor-grabbing transition-shadow group/block ${
                        isSelected
                          ? 'bg-purple-600/70 border-purple-400 text-white shadow-lg shadow-purple-500/40 ring-2 ring-purple-400 z-10'
                          : 'bg-purple-900/50 border-purple-500/50 hover:bg-purple-800/60 text-purple-200'
                      } ${isDraggingThis ? 'scale-[1.02] shadow-2xl z-30' : ''}`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max(4, widthPercent)}%`
                      }}
                      title={`Zoom ${z.scale.toFixed(1)}x (${z.startTime.toFixed(2)}s - ${(z.startTime + z.duration).toFixed(2)}s)`}
                    >
                      {/* Left Resize Handle */}
                      <div
                        onMouseDown={(e) => handleZoomBlockMouseDown(e, z, 'resize-left')}
                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-purple-400/50 rounded-l-lg flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity z-20"
                        title="Drag edge to change zoom start time"
                      >
                        <div className="w-0.5 h-3 bg-white/70 rounded-full" />
                      </div>

                      {/* Main Zoom Info Tag */}
                      <div className="flex items-center gap-1.5 overflow-hidden select-none pointer-events-none px-1">
                        {z.type === 'auto' ? (
                          <Sparkles className="w-3 h-3 text-yellow-300 shrink-0" />
                        ) : (
                          <Target className="w-3 h-3 text-purple-300 shrink-0" />
                        )}
                        <span className="text-[11px] font-bold font-mono truncate">
                          {z.scale.toFixed(1)}x
                        </span>
                        <span className="text-[9px] opacity-80 font-mono truncate hidden sm:inline">
                          ({z.easing})
                        </span>
                      </div>

                      {/* Direct Delete Button on Zoom Block */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onDeleteZoomEvent) onDeleteZoomEvent(z.id)
                        }}
                        className="p-1 text-purple-300 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors cursor-pointer pointer-events-auto shrink-0 z-20"
                        title="Delete this zoom keyframe"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {/* Right Resize Handle */}
                      <div
                        onMouseDown={(e) => handleZoomBlockMouseDown(e, z, 'resize-right')}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-purple-400/50 rounded-r-lg flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity z-20"
                        title="Drag edge to change zoom duration"
                      >
                        <div className="w-0.5 h-3 bg-white/70 rounded-full" />
                      </div>

                      {/* Live Dragging Tooltip */}
                      {isDraggingThis && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-purple-950 text-white border border-purple-400 text-[10px] font-mono px-2 py-0.5 rounded shadow-xl whitespace-nowrap z-40 pointer-events-none">
                          {dragMode === 'move' && `Start: ${z.startTime.toFixed(2)}s`}
                          {dragMode === 'resize-left' && `Start: ${z.startTime.toFixed(2)}s | Dur: ${z.duration.toFixed(2)}s`}
                          {dragMode === 'resize-right' && `Duration: ${z.duration.toFixed(2)}s`}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
