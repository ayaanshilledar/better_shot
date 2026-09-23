import React, { useRef } from 'react'
import { StudioProject, StudioRuntimeState } from '../../types/editor'

interface EditorTimelineProps {
  project: StudioProject
  runtime: StudioRuntimeState
  onSeek: (time: number) => void
}

export const EditorTimeline: React.FC<EditorTimelineProps> = ({
  project,
  runtime,
  onSeek
}) => {
  const rulerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="h-40 bg-white dark:bg-[#101216] border-t border-slate-200 dark:border-white/10 flex flex-col select-none z-30 text-slate-800 dark:text-gray-200">
      {/* Timeline Controls & Header */}
      <div className="h-9 px-3 border-b border-slate-200/80 dark:border-white/5 bg-slate-50 dark:bg-[#14161f] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-gray-400">
          <span>Timeline</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400 font-mono">
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
        <div className="w-28 bg-slate-50 dark:bg-[#12141a] border-r border-slate-200 dark:border-white/10 flex flex-col pt-7 z-10 text-slate-700 dark:text-gray-300">
          <div className="h-10 px-3 flex items-center text-xs font-semibold text-slate-700 dark:text-gray-300 border-b border-slate-200/80 dark:border-white/5">
            <span>Video</span>
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

            {/* Track: Video Track Layer */}
            <div data-track="video" className="h-10 border-b border-white/5 relative flex items-center px-1">
              {/* Dimmed Inactive Zone Before Trim Start */}
              {project.timeline.trimRange && project.timeline.trimRange.start > 0 && (
                <div
                  className="absolute left-0 top-1 bottom-1 bg-black/60 backdrop-blur-[1px] border-r-2 border-amber-500/70 z-10 flex items-center justify-center pointer-events-none"
                  style={{ width: `${(project.timeline.trimRange.start / duration) * 100}%` }}
                >
                  <span className="text-[9px] text-amber-400/80 font-mono">Trimmed</span>
                </div>
              )}

              {/* Active Video Clip Segment Bar */}
              {(() => {
                const trimStart = project.timeline.trimRange?.start ?? 0
                const trimEnd = project.timeline.trimRange?.end ?? duration
                const activeDur = Math.max(0.1, trimEnd - trimStart)
                const leftPos = (trimStart / duration) * 100
                const widthPercent = (activeDur / duration) * 100
                const isTrimmed = Boolean(project.timeline.trimRange && (trimStart > 0 || trimEnd < duration))

                return (
                  <div
                    className={`h-7 rounded-lg flex items-center justify-between px-3 gap-2 text-xs font-semibold shadow-sm transition-all border ${
                      isTrimmed
                        ? 'bg-gradient-to-r from-blue-600/40 via-indigo-600/40 to-blue-600/40 border-blue-400 text-white shadow-blue-500/20'
                        : 'bg-blue-600/30 border-blue-500/50 text-blue-200'
                    }`}
                    style={{
                      marginLeft: `${leftPos}%`,
                      width: `${widthPercent}%`
                    }}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>Clip {activeDur.toFixed(1)}s</span>
                      {isTrimmed && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded border border-amber-500/30">
                          Trimmed
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 font-mono shrink-0">1x</span>
                  </div>
                )
              })()}

              {/* Dimmed Inactive Zone After Trim End */}
              {project.timeline.trimRange && project.timeline.trimRange.end < duration && (
                <div
                  className="absolute right-0 top-1 bottom-1 bg-black/60 backdrop-blur-[1px] border-l-2 border-amber-500/70 z-10 flex items-center justify-center pointer-events-none"
                  style={{ width: `${((duration - project.timeline.trimRange.end) / duration) * 100}%` }}
                >
                  <span className="text-[9px] text-amber-400/80 font-mono">Trimmed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
