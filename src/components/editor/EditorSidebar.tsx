import React from 'react'
import {
  Image,
  Sliders
} from 'lucide-react'
import { StudioProject, StudioRuntimeState, ShadowType } from '../../types/editor'
import { WALLPAPER_PRESETS } from '../../config/presets'

interface EditorSidebarProps {
  project: StudioProject
  runtime: StudioRuntimeState
  onUpdateBackground: (updates: Partial<StudioProject['background']>) => void
  onUpdateLayout: (updates: Partial<StudioProject['layout']>) => void
  onSelectTab: (tab: StudioRuntimeState['selectedTab']) => void
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  project,
  runtime,
  onUpdateBackground,
  onUpdateLayout,
  onSelectTab
}) => {
  const tabs = [
    { id: 'background', label: 'Background', icon: Image },
    { id: 'layout', label: 'Layout', icon: Sliders }
  ] as const

  const shadowOptions: { id: ShadowType; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'soft', label: 'Soft' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
    { id: 'glow', label: 'Glow' }
  ]

  return (
    <aside className="w-80 bg-[#12141a] border-l border-white/10 flex flex-col select-none z-20">
      {/* Top Sidebar Navigation Tabs */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#161922]">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = runtime.selectedTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id as any)}
                className={`p-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={tab.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Settings Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
        {/* Background Tab Content - Single Wallpapers Section */}
        {runtime.selectedTab === 'background' && (
          <div className="flex flex-col gap-4">
            {/* Header & Reset Action */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Wallpapers</span>
              <button
                onClick={() => {
                  onUpdateBackground({ type: 'none', presetId: 'none', gradient: '', color: 'transparent', blurAmount: 0 })
                  onUpdateLayout({ padding: 0 })
                }}
                className={`text-[11px] font-semibold transition-colors cursor-pointer ${
                  project.background.type === 'none' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                ✕ None
              </button>
            </div>

            {/* Wallpaper Presets Gallery Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {WALLPAPER_PRESETS.map((preset) => {
                const isSelected = project.background.presetId === preset.id && project.background.type !== 'none'
                return (
                  <button
                    key={preset.id}
                    onClick={() =>
                      onUpdateBackground({
                        presetId: preset.id,
                        gradient: preset.cssValue,
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
          </div>
        )}

        {/* Layout & Framing Controls (Only shown when Layout tab is selected) */}
        {runtime.selectedTab === 'layout' && (
          <div className="flex flex-col gap-5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Layout & Framing</span>

            {/* Blur Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300">Blur</span>
                <span className="font-mono text-blue-400 font-semibold">
                  {project.background.blurAmount.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={project.background.blurAmount}
                onChange={(e) => onUpdateBackground({ blurAmount: parseFloat(e.target.value) })}
                className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
              />
            </div>

            {/* Padding Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300">Padding</span>
                <span className="font-mono text-blue-400 font-semibold">{project.layout.padding.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={project.layout.padding}
                onChange={(e) => onUpdateLayout({ padding: parseFloat(e.target.value) })}
                className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
              />
            </div>

            {/* Corner Radius Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300">Corner Radius</span>
                <span className="font-mono text-blue-400 font-semibold">{project.layout.cornerRadius}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                value={project.layout.cornerRadius}
                onChange={(e) => onUpdateLayout({ cornerRadius: parseInt(e.target.value, 10) })}
                className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
              />
            </div>

            {/* Drop Shadow Preset Buttons */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-300">Drop Shadow</span>
              <div className="grid grid-cols-5 gap-1 bg-[#161922] p-1 rounded-xl border border-white/5">
                {shadowOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onUpdateLayout({ shadow: opt.id })}
                    className={`py-1 text-[11px] font-semibold rounded-lg capitalize transition-all ${
                      project.layout.shadow === opt.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
