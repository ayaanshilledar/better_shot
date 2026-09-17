import React, { useRef } from 'react'
import { Plus, Video, ZoomIn, Film } from 'lucide-react'
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
    <div className="h-44 bg-[#101216] border-t border-white/10 flex flex-col select-none z-30">
      {/* Timeline Controls & Header */}
      <div className="h-9 px-3 border-b border-white/5 bg-[#14161f] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-xs rounded-lg border border-blue-500/30 transition-all">
            <Plus className="w-3.5 h-3.5" />
            <span>Add track</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
          <span>
            {Math.floor(runtime.currentTime / 60)}:
            {(runtime.currentTime % 60).toFixed(2).padStart(5, '0')}
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
        </div>


        <div className="flex-1 flex flex-col overflow-x-auto relative custom-scrollbar bg-[#0b0c10]">
          {/* Time Scrubber Ruler Bar */}
          <div
            ref={rulerRef}
            onClick={handleRulerClick}
            className="h-7 bg-[#14161f] border-b border-white/10 relative cursor-pointer flex items-center"
          >
            {ticks.map((t) => {
              const pos = (t / duration) * 100
              return (
                <div key={t} className="absolute flex flex-col items-center" style={{ left: `${pos}%` }}>
                  <div className="h-2 w-px bg-gray-500" />
                  <span className="text-[10px] font-mono text-gray-400 mt-0.5">0:0{t}</span>
                </div>
              )
            })}
          </div>

          {/* Red Playhead Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none transition-all duration-75"
            style={{ left: `calc(7rem + ${playheadPercent}%)` }}
          >
            <div className="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-1 shadow-md shadow-red-500/50" />
          </div>

          {/* Track 1: Video Track Layer */}
          <div className="h-9 border-b border-white/5 relative flex items-center px-1">
            <div
              className="h-7 bg-blue-600/30 border border-blue-500/50 rounded-lg flex items-center px-3 gap-2 text-xs font-semibold text-blue-200 shadow-sm"
              style={{ width: '95%' }}
            >
              <Film className="w-3.5 h-3.5 text-blue-400" />
              <span>Clip {Math.round(duration)}s</span>
              <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 font-mono">1x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
