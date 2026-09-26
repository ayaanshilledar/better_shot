import React from 'react'
import { Ban } from 'lucide-react'
import { StudioProject } from '../../../types/editor'
import { WALLPAPER_PRESETS } from '../../../config/presets'

interface BackgroundTabProps {
  project: StudioProject
  onUpdateBackground: (updates: Partial<StudioProject['background']>) => void
  onUpdateLayout: (updates: Partial<StudioProject['layout']>) => void
}

export const BackgroundTab: React.FC<BackgroundTabProps> = ({
  project,
  onUpdateBackground,
  onUpdateLayout
}) => {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {/* "None" Wallpaper Option Card */}
      <button
        data-preset-id="none"
        onClick={() => {
          onUpdateBackground({
            type: 'none',
            presetId: 'none',
            gradient: '',
            color: 'transparent',
            blurAmount: 0
          })
          onUpdateLayout({ padding: 0 })
        }}
        className={`h-24 rounded-xl relative overflow-hidden transition-all border-2 text-left group cursor-pointer flex flex-col items-center justify-center gap-1.5 bg-[#181b24] ${
          project.background.type === 'none'
            ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg scale-[1.02]'
            : 'border-white/5 hover:border-white/20'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
          <Ban className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-semibold text-gray-300">None</span>
      </button>

      {/* Wallpaper Presets Gallery Grid */}
      {WALLPAPER_PRESETS.map((preset) => {
        const isSelected =
          project.background.presetId === preset.id && project.background.type !== 'none'
        return (
          <button
            key={preset.id}
            data-preset-id={preset.id}
            onClick={() =>
              onUpdateBackground({
                presetId: preset.id,
                gradient: preset.cssValue,
                customImageUrl: preset.url || '',
                type: 'wallpaper'
              })
            }
            className={`h-24 rounded-xl relative overflow-hidden transition-all border-2 text-left group cursor-pointer ${
              isSelected
                ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg scale-[1.02]'
                : 'border-white/5 hover:border-white/20'
            }`}
            style={{ background: preset.thumbnail }}
          >
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white drop-shadow-md truncate">
                {preset.name}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
