import React, { useState } from 'react'
import {
  Image,
  Sliders,
  Ban,
  Download,
  Volume2,
  VolumeX,
  ZoomIn,
  Trash2
} from 'lucide-react'
import { StudioProject, StudioRuntimeState, ShadowType, ZoomEvent, ZoomEasingType } from '../../types/editor'
import { WALLPAPER_PRESETS } from '../../config/presets'
import { AutoZoomOptions } from '../../utils/zoomUtils'

interface EditorSidebarProps {
  project: StudioProject
  runtime: StudioRuntimeState
  onUpdateBackground: (updates: Partial<StudioProject['background']>) => void
  onUpdateLayout: (updates: Partial<StudioProject['layout']>) => void
  onSelectTab: (tab: StudioRuntimeState['selectedTab']) => void
  onAddZoomEvent?: (zoomData?: Partial<ZoomEvent>) => void
  onUpdateZoomEvent?: (zoomId: string, updates: Partial<ZoomEvent>) => void
  onDeleteZoomEvent?: (zoomId: string) => void
  onSelectZoomEvent?: (zoomId: string | null) => void
  onGenerateAutoZooms?: (options?: AutoZoomOptions) => void
  onClearAutoZooms?: () => void
  onExport?: () => void
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  project,
  runtime,
  onUpdateBackground,
  onUpdateLayout,
  onSelectTab,
  onAddZoomEvent,
  onUpdateZoomEvent,
  onDeleteZoomEvent,
  onSelectZoomEvent,
  onGenerateAutoZooms,
  onClearAutoZooms,
  onExport
}) => {
  const [zoomMode, setZoomMode] = useState<'manual' | 'auto'>('manual')

  // Auto Zoom local settings state
  const [autoDensity, setAutoDensity] = useState<'subtle' | 'balanced' | 'dynamic'>('balanced')
  const [autoMaxScale, setAutoMaxScale] = useState<number>(1.6)
  const [autoEaseSpeed, setAutoEaseSpeed] = useState<number>(0.4)

  const tabs = [
    { id: 'background', label: 'Bg', icon: Image },
    { id: 'layout', label: 'Layout', icon: Sliders },
    { id: 'zoom', label: 'Zoom', icon: ZoomIn },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'export', label: 'Export', icon: Download }
  ] as const

  const shadowOptions: { id: ShadowType; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'soft', label: 'Soft' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
    { id: 'glow', label: 'Glow' }
  ]

  const easingOptions: { id: ZoomEasingType; label: string }[] = [
    { id: 'ease-in-out', label: 'Smooth Cubic (Ease In & Out)' },
    { id: 'ease-out', label: 'Fast Landing (Ease Out)' },
    { id: 'ease-in', label: 'Smooth Acceleration (Ease In)' },
    { id: 'linear', label: 'Linear Speed' },
    { id: 'elastic', label: 'Elastic Spring Bounce' }
  ]

  const focalPresets = [
    { label: 'Center', x: 50, y: 50 },
    { label: 'Top-Left', x: 30, y: 30 },
    { label: 'Top-Right', x: 70, y: 30 },
    { label: 'Bottom-Left', x: 30, y: 70 },
    { label: 'Bottom-Right', x: 70, y: 70 }
  ]

  const selectedZoomEvent = project.timeline.zoomEvents.find(
    (z) => z.id === runtime.selectedZoomId
  )

  return (
    <aside className="w-80 bg-[#12141a] border-l border-white/10 flex flex-col select-none z-20">
      {/* Smooth Segmented Tab Switcher Bar */}
      <div className="p-3 bg-[#161922]">
        <div className="grid grid-cols-5 gap-1 bg-[#12141a] p-1 rounded-xl border border-white/5 shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = runtime.selectedTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id as any)}
                className={`py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all duration-200 cursor-pointer ${
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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar">
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

        {/* Layout & Framing Controls */}
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

            {/* Border Width Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300">Border Width</span>
                <span className="font-mono text-blue-400 font-semibold">{project.layout.borderWidth ?? 1}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={project.layout.borderWidth ?? 1}
                onChange={(e) => onUpdateLayout({ borderWidth: parseInt(e.target.value, 10) })}
                className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
              />
            </div>

            {/* Border Opacity Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300">Border Opacity</span>
                <span className="font-mono text-blue-400 font-semibold">{project.layout.borderOpacity ?? 25}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={project.layout.borderOpacity ?? 25}
                onChange={(e) => onUpdateLayout({ borderOpacity: parseInt(e.target.value, 10) })}
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

        {/* Zoom Controls Tab Content */}
        {runtime.selectedTab === 'zoom' && (
          <div className="flex flex-col gap-4">
            {/* Mode Switcher: Manual vs Auto Zoom */}
            <div className="grid grid-cols-2 gap-1 bg-[#161922] p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setZoomMode('manual')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  zoomMode === 'manual'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Manual
              </button>

              <button
                onClick={() => setZoomMode('auto')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  zoomMode === 'auto'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Auto Zoom
              </button>
            </div>

            {/* MANUAL ZOOM MODE */}
            {zoomMode === 'manual' && (
              <div className="flex flex-col gap-4">
                {/* Zoom Keyframe Events List */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 font-semibold px-1">
                    <span>Timeline Zoom Events</span>
                    <span className="font-mono text-[11px] text-blue-400 font-semibold">
                      {project.timeline.zoomEvents.length} active
                    </span>
                  </div>

                  {project.timeline.zoomEvents.length === 0 ? (
                    <div className="p-4 bg-[#161922] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center gap-1.5">
                      <p className="text-xs text-gray-400">
                        No zoom keyframes yet. Click on the timeline track below to add a zoom.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                      {project.timeline.zoomEvents.map((z) => {
                        const isSelected = z.id === runtime.selectedZoomId
                        return (
                          <div
                            key={z.id}
                            onClick={() => onSelectZoomEvent && onSelectZoomEvent(z.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-[#1a1d28] border-blue-500/60 text-white shadow-sm'
                                : 'bg-[#161922] border-white/5 hover:border-white/20 text-gray-300'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-200">{z.scale.toFixed(1)}x Zoom</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-gray-300 font-mono capitalize">
                                  {z.type || 'manual'}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-gray-400">
                                {z.startTime.toFixed(2)}s - {(z.startTime + z.duration).toFixed(2)}s ({z.duration.toFixed(1)}s)
                              </span>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onDeleteZoomEvent) onDeleteZoomEvent(z.id)
                              }}
                              className="p-1 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
                              title="Delete Keyframe"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* SELECTED ZOOM EVENT PROPERTY EDITOR */}
                {selectedZoomEvent && (
                  <div className="p-3 bg-[#161922] border border-white/10 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="text-xs font-bold text-gray-200">
                        Selected Keyframe
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        @{selectedZoomEvent.startTime.toFixed(2)}s
                      </span>
                    </div>

                    {/* Scale Level Slider & Quick Presets */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-300">Zoom Scale</span>
                        <span className="font-mono text-blue-400 font-bold">
                          {selectedZoomEvent.scale.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.1"
                        max="4.0"
                        step="0.05"
                        value={selectedZoomEvent.scale}
                        onChange={(e) =>
                          onUpdateZoomEvent &&
                          onUpdateZoomEvent(selectedZoomEvent.id, { scale: parseFloat(e.target.value) })
                        }
                        className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
                      />
                      {/* Scale Presets */}
                      <div className="grid grid-cols-4 gap-1">
                        {[1.25, 1.5, 2.0, 3.0].map((presetScale) => (
                          <button
                            key={presetScale}
                            onClick={() =>
                              onUpdateZoomEvent &&
                              onUpdateZoomEvent(selectedZoomEvent.id, { scale: presetScale })
                            }
                            className={`py-1 rounded text-[10px] font-mono font-semibold transition-colors ${
                              Math.abs(selectedZoomEvent.scale - presetScale) < 0.05
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-[#12141a] text-gray-400 hover:text-white'
                            }`}
                          >
                            {presetScale}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Focal Position X & Y + 2D Interactive Target Picker */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-300">Focal Origin Target</span>
                        <span className="font-mono text-blue-400 text-[11px] font-bold">
                          X: {Math.round(selectedZoomEvent.x)}%, Y: {Math.round(selectedZoomEvent.y)}%
                        </span>
                      </div>

                      {/* 2D Interactive Mini Target Canvas Box */}
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const rawX = ((e.clientX - rect.left) / rect.width) * 100
                          const rawY = ((e.clientY - rect.top) / rect.height) * 100
                          const x = Math.round(Math.max(0, Math.min(100, rawX)))
                          const y = Math.round(Math.max(0, Math.min(100, rawY)))
                          if (onUpdateZoomEvent) {
                            onUpdateZoomEvent(selectedZoomEvent.id, { x, y })
                          }
                        }}
                        className="w-full h-24 bg-[#101216] border border-white/10 rounded-xl relative overflow-hidden cursor-crosshair group flex items-center justify-center shadow-inner"
                        title="Click anywhere to set focus point"
                      >
                        {/* Rule of Thirds Grid Lines */}
                        <div className="absolute inset-0 border-r border-white/5 w-1/3 h-full pointer-events-none" />
                        <div className="absolute inset-0 border-r border-white/5 left-1/3 w-1/3 h-full pointer-events-none" />
                        <div className="absolute inset-0 border-b border-white/5 h-1/3 w-full pointer-events-none" />
                        <div className="absolute inset-0 border-b border-white/5 top-1/3 h-1/3 w-full pointer-events-none" />

                        {/* Active Target Dot Pin */}
                        <div
                          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow-sm flex items-center justify-center pointer-events-none"
                          style={{
                            left: `${selectedZoomEvent.x}%`,
                            top: `${selectedZoomEvent.y}%`
                          }}
                        >
                          <div className="w-1 h-1 rounded-full bg-white" />
                        </div>
                      </div>

                      {/* Position Presets */}
                      <div className="flex flex-wrap gap-1">
                        {focalPresets.map((preset) => {
                          const isActive =
                            Math.abs(selectedZoomEvent.x - preset.x) < 5 &&
                            Math.abs(selectedZoomEvent.y - preset.y) < 5
                          return (
                            <button
                              key={preset.label}
                              onClick={() =>
                                onUpdateZoomEvent &&
                                onUpdateZoomEvent(selectedZoomEvent.id, { x: preset.x, y: preset.y })
                              }
                              className={`py-1 px-2 text-[10px] rounded border transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-blue-600 text-white border-blue-500 font-semibold shadow-sm'
                                  : 'bg-[#12141a] hover:bg-white/5 text-gray-300 border-white/5'
                              }`}
                            >
                              {preset.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AUTO ZOOM MODE */}
            {zoomMode === 'auto' && (
              <div className="flex flex-col gap-4">
                <div className="p-3 bg-[#161922] border border-white/10 rounded-xl flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-200">Auto-Zoom Engine</span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Auto-Zoom scans your video timeline and places smooth focal zoom keyframes across active regions.
                  </p>
                </div>

                {/* Density Selector */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-gray-300">Density</span>
                  <div className="grid grid-cols-3 gap-1 bg-[#161922] p-1 rounded-xl border border-white/5">
                    {(['subtle', 'balanced', 'dynamic'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setAutoDensity(d)}
                        className={`py-1.5 text-[11px] font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                          autoDensity === d
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Auto Scale Limit */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-300">Max Auto Scale</span>
                    <span className="font-mono text-blue-400 font-semibold">{autoMaxScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.2"
                    max="2.5"
                    step="0.05"
                    value={autoMaxScale}
                    onChange={(e) => setAutoMaxScale(parseFloat(e.target.value))}
                    className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
                  />
                </div>

                {/* Generate Auto Zooms Button */}
                <button
                  onClick={() =>
                    onGenerateAutoZooms &&
                    onGenerateAutoZooms({
                      density: autoDensity,
                      maxScale: autoMaxScale,
                      easeSpeed: autoEaseSpeed
                    })
                  }
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Generate Auto Zooms
                </button>

                {/* Clear Auto Zooms Button */}
                {project.timeline.zoomEvents.some((z) => z.type === 'auto') && (
                  <button
                    onClick={() => onClearAutoZooms && onClearAutoZooms()}
                    className="w-full py-2 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Clear Generated Auto Zooms
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Audio Controls Tab Content */}
        {runtime.selectedTab === 'audio' && (
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

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300">Volume Level</span>
                <span className="font-mono text-blue-400 font-semibold">
                  {project.layout.isMuted ? 'Muted' : `${Math.round(project.layout.volume ?? 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={project.layout.isMuted ? 0 : (project.layout.volume ?? 100)}
                onChange={(e) => {
                  const newVol = parseInt(e.target.value, 10)
                  onUpdateLayout({
                    volume: newVol,
                    isMuted: newVol === 0
                  })
                }}
                className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
              />
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
