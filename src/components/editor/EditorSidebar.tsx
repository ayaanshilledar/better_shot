import React from 'react'
import {
  Image,
  Sliders,
  Ban,
  Download
} from 'lucide-react'
import { StudioProject, StudioRuntimeState, ShadowType } from '../../types/editor'
import { WALLPAPER_PRESETS } from '../../config/presets'

interface EditorSidebarProps {
  project: StudioProject
  runtime: StudioRuntimeState
  onUpdateBackground: (updates: Partial<StudioProject['background']>) => void
  onUpdateLayout: (updates: Partial<StudioProject['layout']>) => void
  onSelectTab: (tab: StudioRuntimeState['selectedTab']) => void
  onExport?: () => void
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  project,
  runtime,
  onUpdateBackground,
  onUpdateLayout,
  onSelectTab,
  onExport
}) => {
  const tabs = [
    { id: 'background', label: 'Background', icon: Image },
    { id: 'layout', label: 'Layout', icon: Sliders },
    { id: 'export', label: 'Export', icon: Download }
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
      {/* Smooth Segmented Tab Switcher Bar */}
      <div className="p-3 bg-[#161922]">
        <div className="grid grid-cols-3 gap-1 bg-[#12141a] p-1 rounded-xl border border-white/5 shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = runtime.selectedTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id as any)}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Settings Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
        {/* Background Tab Content - Wallpapers Grid with None option */}
        {runtime.selectedTab === 'background' && (
          <div className="grid grid-cols-2 gap-2.5">
            {/* "None" Wallpaper Option Card */}
            <button
              onClick={() => {
                onUpdateBackground({ type: 'none', presetId: 'none', gradient: '', color: 'transparent', blurAmount: 0 })
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
              <span className="text-[11px] font-semibold text-gray-300">
                None
              </span>
            </button>

            {/* Wallpaper Presets Gallery Grid */}
            {WALLPAPER_PRESETS.map((preset) => {
              const isSelected = project.background.presetId === preset.id && project.background.type !== 'none'
              return (
                <button
                  key={preset.id}
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
        )}

        {/* Layout & Framing Controls (Only shown when Layout tab is selected) */}
        {runtime.selectedTab === 'layout' && (
          <div className="flex flex-col gap-5">

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

        {/* Export Section (Blank for now) */}
        {runtime.selectedTab === 'export' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6" />
        )}
      </div>
    </aside>
  )
}
