import React from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { SliderRow } from '../../common/SliderRow'
import { StudioProject } from '../../../types/editor'

interface AudioTabProps {
  project: StudioProject
  onUpdateLayout: (updates: Partial<StudioProject['layout']>) => void
}

export const AudioTab: React.FC<AudioTabProps> = ({
  project,
  onUpdateLayout
}) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-xs pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 font-semibold text-gray-200">
          {project.layout.isMuted ? (
            <VolumeX className="w-4 h-4 text-red-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-blue-400" />
          )}
          <span>Video Track Audio</span>
        </div>
        <button
          onClick={() => onUpdateLayout({ isMuted: !project.layout.isMuted })}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            project.layout.isMuted
              ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
              : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
          }`}
        >
          {project.layout.isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>

      <SliderRow
        label="Volume Level"
        value={project.layout.isMuted ? 0 : project.layout.volume ?? 100}
        min={0}
        max={100}
        step={1}
        unit="%"
        decimals={0}
        onChange={(newVol) => {
          onUpdateLayout({
            volume: newVol,
            isMuted: newVol === 0
          })
        }}
      />
    </div>
  )
}
