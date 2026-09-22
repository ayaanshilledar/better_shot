import React, { useState, useEffect, useRef } from 'react'
import {
  Image,
  Sliders,
  Ban,
  Download,
  Volume2,
  VolumeX,
  ZoomIn,
  Trash2,
  MousePointer,
  Sparkles,
  Volume1,
  Circle,
  Radio,
  Check,
  Clipboard,
  Bot,
  Send,
  ArrowUp,
  Clock,
  RotateCcw,
  RefreshCw,
  Key,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react'
import {
  StudioProject,
  StudioRuntimeState,
  ShadowType,
  ZoomEvent,
  ZoomEasingType,
  ExportResolution,
  ExportFps,
  ExportBitratePreset,
  ExportFormat
} from '../../types/editor'
import { WALLPAPER_PRESETS } from '../../config/presets'
import { AutoZoomOptions } from '../../utils/zoomUtils'
import {
  calculateExportDimensions,
  calculateTargetBitrate,
  estimateFileSize,
  formatBitrate
} from '../../services/exportService'
import { CursorConfig, CursorStyleType, ClickSoundType, DEFAULT_CURSOR_CONFIG } from '../../types/cursor'
import { clickSoundService } from '../../services/clickSoundService'
import { getAIConfig } from '../../services/aiService'
import { AIChatMessage } from '../../types/ai'

interface EditorSidebarProps {
  width?: number
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
  onUpdateCursorConfig?: (updates: Partial<CursorConfig>) => void
  onUpdateExportSettings?: (updates: Partial<StudioProject['exportSettings']>) => void
  onExport?: () => void
  onExportImage?: (action: 'save' | 'copy') => void
  onToggleAI?: () => void
  isAIOpen?: boolean
  onOpenAISettings?: () => void
  onSendMessage?: (text: string) => Promise<void>
  onConfirmPlan?: (messageId: string) => Promise<void> | void
  onDismissPlan?: (messageId: string) => void
  isAIExecuting?: boolean
  onUndoLastAIEdit?: () => void
  canUndoAI?: boolean
  aiMessages?: AIChatMessage[]
}


export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  width = 340,
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
  onUpdateCursorConfig,
  onUpdateExportSettings,
  onExport,
  onExportImage,
  onToggleAI,
  isAIOpen = false,
  onOpenAISettings,
  onSendMessage,
  onConfirmPlan,
  onDismissPlan,
  isAIExecuting = false,
  onUndoLastAIEdit,
  canUndoAI = false,
  aiMessages = []
}) => {
  const [zoomMode, setZoomMode] = useState<'manual' | 'auto'>('manual')
  const [aiPrompt, setAiPrompt] = useState<string>('')
  const [aiConfig, setAiConfig] = useState(getAIConfig())
  const [promptHistory, setPromptHistory] = useState<string[]>([])
  const [expandedThoughtMap, setExpandedThoughtMap] = useState<Record<string, boolean>>({})
  const [expandedDiffMap, setExpandedDiffMap] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto Zoom Config Sliders state
  const [autoDensity, setAutoDensity] = useState<'subtle' | 'balanced' | 'dynamic'>('balanced')
  const [autoMaxScale, setAutoMaxScale] = useState<number>(1.8)
  const [autoEaseSpeed, setAutoEaseSpeed] = useState<number>(0.4)

  const formatTimestamp = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ds = Math.floor((sec % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ds}`
  }

  useEffect(() => {
    const handleConfigChange = () => setAiConfig(getAIConfig())
    window.addEventListener('bettershot-ai-config-changed', handleConfigChange)
    return () => window.removeEventListener('bettershot-ai-config-changed', handleConfigChange)
  }, [])

  useEffect(() => {
    if (runtime.selectedTab === 'ai') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [aiMessages, isAIExecuting, runtime.selectedTab])

  const cursorConfig = project.cursorConfig || DEFAULT_CURSOR_CONFIG

  // Export Settings normalization and dynamic calculations
  const exportSettings = {
    format: project.exportSettings?.format || 'mp4',
    resolution: project.exportSettings?.resolution || '1080p',
    fps: project.exportSettings?.fps || 60,
    bitratePreset: project.exportSettings?.bitratePreset || 'high',
    customBitrateMbps: project.exportSettings?.customBitrateMbps || 12,
    includeAudio: project.exportSettings?.includeAudio ?? true,
    audioBitrateKbps: project.exportSettings?.audioBitrateKbps || 192,
    saveLocation: project.exportSettings?.saveLocation
  }

  const currentDimensions = calculateExportDimensions(
    project.layout.aspectRatio,
    exportSettings.resolution,
    project.media.width,
    project.media.height
  )

  const currentBitrate = calculateTargetBitrate(
    exportSettings.resolution,
    exportSettings.bitratePreset,
    exportSettings.customBitrateMbps
  )

  const estimatedSize = estimateFileSize(
    project.media.duration || 10,
    currentBitrate,
    exportSettings.audioBitrateKbps,
    exportSettings.includeAudio
  )

  const handleSelectSaveLocation = async () => {
    if (window.electronAPI?.showSaveDialog) {
      const cleanTitle = (project.title || 'BetterShot').replace(/[<>:"/\\|?*]+/g, '_')
      const ext = exportSettings.format || 'mp4'
      const defaultName = `${cleanTitle}_${exportSettings.resolution}.${ext}`
      const res = await window.electronAPI.showSaveDialog(defaultName, ext)
      if (!res.canceled && res.filePath && onUpdateExportSettings) {
        onUpdateExportSettings({ saveLocation: res.filePath })
      }
    }
  }

  const isImage = Boolean(project.media.mediaType === 'image' || /\.(png|jpe?g|webp|bmp|gif)$/i.test(project.media.sourcePath))

  const allTabs = [
    { id: 'background', label: 'Bg', icon: Image },
    { id: 'layout', label: 'Layout', icon: Sliders },
    { id: 'zoom', label: 'Zoom', icon: ZoomIn },
    { id: 'cursor', label: 'Cursor', icon: MousePointer },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'export', label: 'Export', icon: Download }
  ] as const

  const tabs = isImage
    ? allTabs.filter(t => t.id === 'background' || t.id === 'layout' || t.id === 'ai' || t.id === 'export')
    : allTabs


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
    <aside
      style={{ width: `${width}px` }}
      className="bg-white dark:bg-[#12141a] border-l border-slate-200 dark:border-white/10 flex flex-col select-none z-20 text-slate-800 dark:text-gray-100 shrink-0 overflow-hidden"
    >
      {/* Smooth Segmented Tab Switcher Bar */}
      <div className="p-3 bg-slate-50 dark:bg-[#161922] border-b border-slate-200/80 dark:border-transparent">
        <div
          className="grid gap-1 bg-slate-200/70 dark:bg-[#12141a] p-1 rounded-xl border border-black/5 dark:border-white/5 shadow-inner"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = runtime.selectedTab === tab.id
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => onSelectTab(tab.id as any)}
                className={`py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
                }`}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Settings Panel Content */}
      <div
        className={`flex-1 ${
          runtime.selectedTab === 'ai'
            ? 'overflow-hidden p-3 flex flex-col min-h-0'
            : 'overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar'
        }`}
      >
        {/* Background Tab Content - Wallpapers Grid with None option */}
        {runtime.selectedTab === 'background' && (
          <div className="grid grid-cols-2 gap-2.5">
            {/* "None" Wallpaper Option Card */}
            <button
              data-preset-id="none"
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
                data-control="padding"
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
                data-control="cornerRadius"
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
                    data-control="shadow"
                    data-shadow-id={opt.id}
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

                {/* Cursor Click Detection Banner */}
                {project.cursorData?.clicks && project.cursorData.clicks.length > 0 && (
                  <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-[11px] text-blue-300 leading-snug">
                      Detected <strong>{project.cursorData.clicks.length} real clicks</strong>! Zooms will center on your action points.
                    </span>
                  </div>
                )}

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
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{project.cursorData?.clicks?.length ? 'Generate Zooms from Clicks' : 'Generate Auto Zooms'}</span>
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

        {/* Cursor & Click FX Tab Content */}
        {runtime.selectedTab === 'cursor' && (
          <div className="flex flex-col gap-5">
            {/* Header with Enable Switch */}
            <div className="p-3 bg-[#161922] border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <MousePointer className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-200">Cursor & Click FX</div>
                  <div className="text-[10px] text-gray-400">Single pointer replacement & audio</div>
                </div>
              </div>
              <button
                onClick={() =>
                  onUpdateCursorConfig &&
                  onUpdateCursorConfig({ enabled: !cursorConfig.enabled })
                }
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                  cursorConfig.enabled ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    cursorConfig.enabled ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {cursorConfig.enabled && (
              <>
                {/* Cursor Style Options */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-gray-300">Cursor Style</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'macos-arrow', label: 'macOS Arrow', desc: 'Crisp vector pointer' },
                      { id: 'halo', label: 'Halo Glow', desc: 'Soft luminous ring' },
                      { id: 'spotlight', label: 'Spotlight', desc: 'Radial focal light' },
                      { id: 'dot', label: 'Accent Dot', desc: 'Minimal dot indicator' },
                      { id: 'original', label: 'Original', desc: 'Raw captured cursor' }
                    ].map((styleOpt) => {
                      const isSelected = cursorConfig.style === styleOpt.id
                      return (
                        <button
                          key={styleOpt.id}
                          onClick={() =>
                            onUpdateCursorConfig &&
                            onUpdateCursorConfig({ style: styleOpt.id as CursorStyleType })
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500/50 shadow-sm'
                              : 'bg-[#161922] border-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-200">{styleOpt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                          </div>
                          <span className="text-[10px] text-gray-400">{styleOpt.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Cursor Size Slider */}
                {cursorConfig.style !== 'original' && (
                  <div className="flex flex-col gap-2 bg-[#161922] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-300">Pointer Size</span>
                      <span className="font-mono text-[11px] text-blue-400">{cursorConfig.size}px</span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={54}
                      step={2}
                      value={cursorConfig.size}
                      onChange={(e) =>
                        onUpdateCursorConfig &&
                        onUpdateCursorConfig({ size: Number(e.target.value) })
                      }
                      className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
                    />
                  </div>
                )}

                {/* Accent Color Palette */}
                {['halo', 'spotlight', 'dot'].includes(cursorConfig.style) && (
                  <div className="flex flex-col gap-2 bg-[#161922] p-3 rounded-xl border border-white/5">
                    <span className="text-xs font-semibold text-gray-300">Accent Color</span>
                    <div className="flex items-center gap-2">
                      {['#3b82f6', '#6366f1', '#8b5cf6', '#10b981', '#f43f5e', '#f59e0b', '#ffffff'].map((color) => (
                        <button
                          key={color}
                          onClick={() =>
                            onUpdateCursorConfig &&
                            onUpdateCursorConfig({ color, rippleColor: color })
                          }
                          className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                            cursorConfig.color === color ? 'scale-110 border-white shadow-md' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Click Ripple Pulse Setting */}
                <div className="flex items-center justify-between bg-[#161922] p-3 rounded-xl border border-white/5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-gray-200">Click Ripple Effect</span>
                    <span className="text-[10px] text-gray-400">Expanding visual pulse on mouse clicks</span>
                  </div>
                  <button
                    onClick={() =>
                      onUpdateCursorConfig &&
                      onUpdateCursorConfig({ showClickRipple: !cursorConfig.showClickRipple })
                    }
                    className={`w-9 h-4.5 rounded-full transition-colors relative cursor-pointer ${
                      cursorConfig.showClickRipple ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        cursorConfig.showClickRipple ? 'left-4.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Click Sound FX Section */}
                <div className="flex flex-col gap-3 bg-[#161922] p-3 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume1 className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-gray-200">Click Sound FX</span>
                    </div>
                    <button
                      onClick={() =>
                        onUpdateCursorConfig &&
                        onUpdateCursorConfig({
                          sound: {
                            ...cursorConfig.sound,
                            enabled: !cursorConfig.sound.enabled
                          }
                        })
                      }
                      className={`w-9 h-4.5 rounded-full transition-colors relative cursor-pointer ${
                        cursorConfig.sound.enabled ? 'bg-blue-600' : 'bg-gray-700'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                          cursorConfig.sound.enabled ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {cursorConfig.sound.enabled && (
                    <div className="flex flex-col gap-3 pt-2 border-t border-white/5">
                      {/* Sound Type Selection */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'mac', label: 'macOS Snap' },
                          { id: 'tap', label: 'Tactile Tap' },
                          { id: 'bubble', label: 'Soft Bubble' },
                          { id: 'mechanical', label: 'Switch Click' }
                        ].map((soundOpt) => {
                          const isSel = cursorConfig.sound.soundType === soundOpt.id
                          return (
                            <button
                              key={soundOpt.id}
                              onClick={() => {
                                onUpdateCursorConfig &&
                                  onUpdateCursorConfig({
                                    sound: {
                                      ...cursorConfig.sound,
                                      soundType: soundOpt.id as ClickSoundType
                                    }
                                  })
                                clickSoundService.play(soundOpt.id as ClickSoundType, cursorConfig.sound.volume)
                              }}
                              className={`py-1.5 px-2 text-[11px] rounded-lg font-medium transition-all cursor-pointer text-center ${
                                isSel
                                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                  : 'bg-[#12141a] text-gray-400 hover:text-white'
                              }`}
                            >
                              {soundOpt.label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Sound Volume Slider & Test Button */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex-1 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <span>Volume</span>
                            <span className="font-mono text-blue-400">{cursorConfig.sound.volume}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={cursorConfig.sound.volume}
                            onChange={(e) =>
                              onUpdateCursorConfig &&
                              onUpdateCursorConfig({
                                sound: {
                                  ...cursorConfig.sound,
                                  volume: Number(e.target.value)
                                }
                              })
                            }
                            className="accent-blue-500 cursor-pointer h-1.5 bg-[#1e222e] rounded-lg"
                          />
                        </div>
                        <button
                          onClick={() =>
                            clickSoundService.play(cursorConfig.sound.soundType, cursorConfig.sound.volume)
                          }
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 border border-white/5"
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Telemetry Info Card */}
                <div className="p-3 bg-[#161922] border border-white/10 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-200">Recording Telemetry</span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      project.cursorData?.samples?.length
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}>
                      {project.cursorData?.samples?.length ? 'Synced' : 'No Sidecar'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 font-mono">
                    <div className="bg-[#12141a] p-2 rounded-lg border border-white/5">
                      <div className="text-gray-500 text-[9px] uppercase">Positions</div>
                      <div className="text-white font-bold">{project.cursorData?.samples?.length || 0} pts</div>
                    </div>
                    <div className="bg-[#12141a] p-2 rounded-lg border border-white/5">
                      <div className="text-gray-500 text-[9px] uppercase">Clicks</div>
                      <div className="text-white font-bold">{project.cursorData?.clicks?.length || 0} hits</div>
                    </div>
                  </div>
                </div>
              </>
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

        {/* Elevated AI Chat Panel */}
        {runtime.selectedTab === 'ai' && (
          <div className="flex flex-col flex-1 min-h-0 justify-between gap-2.5">
            {/* Minimal Header / Status Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 shrink-0 text-xs">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <Sparkles className="w-3.5 h-3.5 opacity-80" />
                <span className="font-semibold text-[11px]">AI Assistant</span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 truncate max-w-[130px]">
                  • {aiConfig.apiKey ? (aiConfig.selectedModel || 'Connected') : 'Local'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canUndoAI && (
                  <button
                    type="button"
                    onClick={onUndoLastAIEdit}
                    className="text-[10px] text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                    title="Undo last AI edit"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Undo</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenAISettings}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Configure AI API Key"
                >
                  <Key className="w-3 h-3 text-slate-400 hover:text-slate-700 dark:hover:text-white" />
                </button>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 custom-scrollbar text-xs">
              {/* Optional Tip Banner if No API Key */}
              {!aiConfig.apiKey && (aiMessages || []).length <= 2 && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 flex items-start gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-800 dark:text-zinc-200">
                      Smart Offline Planner Active
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Basic commands work offline. Add an API key in settings for advanced reasoning.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenAISettings}
                      className="mt-1.5 px-2 py-0.5 text-[9.5px] font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded cursor-pointer transition-colors"
                    >
                      Configure Key
                    </button>
                  </div>
                </div>
              )}

              {(aiMessages || []).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-6 px-2 text-slate-400 dark:text-zinc-500">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-zinc-300 flex items-center justify-center mb-2">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-0.5">
                    {isImage ? 'AI Screenshot Copilot' : 'AI Video Editor'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 max-w-[210px] leading-relaxed mb-4">
                    Direct your edits naturally or tap a quick starter below:
                  </p>

                  {/* Context-Aware Quick Action Chips */}
                  <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
                    {(isImage
                      ? [
                          { label: 'Clean Framing', text: 'Apply 16% padding, rounded corners, and soft drop shadow' },
                          { label: 'Aurora Wallpaper', text: 'Set aurora wallpaper with soft shadow' },
                          { label: '1:1 Square Format', text: 'Set 1:1 aspect ratio for Instagram/X' }
                        ]
                      : [
                          { label: 'One-Click Polish', text: 'Apply modern wallpaper, 12% padding, rounded corners and drop shadow' },
                          {
                            label: runtime.currentTime > 0 ? `Zoom at ${formatTimestamp(runtime.currentTime)}` : 'Zoom at 2s',
                            text: runtime.currentTime > 0 ? `Add 1.8x zoom at ${runtime.currentTime.toFixed(1)}s` : 'Add 1.8x focal zoom at 2s'
                          },
                          { label: '9:16 Vertical Video', text: 'Make 9:16 vertical for TikTok and Shorts' },
                          { label: 'Clear All Zooms', text: 'Clear all zoom keyframes from timeline' }
                        ]
                    ).map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isAIExecuting) return
                          onSendMessage?.(chip.text)
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-100/80 dark:bg-[#161924] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] border border-black/5 dark:border-white/5 text-[11px] text-slate-700 dark:text-zinc-300 transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <span className="font-medium truncate">{chip.label}</span>
                        <ArrowUp className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-slate-500 dark:text-zinc-400 transition-opacity shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                aiMessages.map((m) => {
                  const isThoughtOpen = expandedThoughtMap[m.id] ?? false
                  const isDiffOpen = expandedDiffMap[m.id] ?? false

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col gap-1.5 ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[92%] p-2.5 text-[11px] leading-relaxed select-text ${
                          m.sender === 'user'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-2xl rounded-tr-xs shadow-xs'
                            : 'bg-slate-100/90 dark:bg-[#181a26] text-slate-800 dark:text-zinc-200 border border-black/5 dark:border-white/5 rounded-2xl rounded-tl-xs'
                        }`}
                      >
                        {/* 1. Chain-of-Thought Disclosure */}
                        {m.thoughtProcess && (
                          <div className="mb-2 rounded-lg bg-black/5 dark:bg-white/5 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedThoughtMap((prev) => ({ ...prev, [m.id]: !isThoughtOpen }))}
                              className="w-full flex items-center justify-between p-1.5 text-[9.5px] font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              <span>Reasoning</span>
                              {isThoughtOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            </button>

                            {isThoughtOpen && (
                              <div className="p-2 pt-0 space-y-1 text-[9.5px] text-slate-500 dark:text-zinc-400 border-t border-black/5 dark:border-white/5">
                                {m.thoughtProcess.analysis && (
                                  <div>
                                    <span className="font-semibold text-slate-700 dark:text-zinc-300">Analysis:</span>
                                    <p className="mt-0.5 leading-relaxed">{m.thoughtProcess.analysis}</p>
                                  </div>
                                )}

                                {m.thoughtProcess.reasoning && (
                                  <div>
                                    <span className="font-semibold text-slate-700 dark:text-zinc-300">Rationale:</span>
                                    <p className="mt-0.5 leading-relaxed">{m.thoughtProcess.reasoning}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="whitespace-pre-wrap">{m.content}</div>

                        {/* Interactive Action Receipts Badges */}
                        {m.actions && m.actions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-black/5 dark:border-white/10">
                            {m.actions.map((act, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-700 dark:text-zinc-300 text-[9.5px] font-medium border border-black/5 dark:border-white/5"
                                title={act.label}
                              >
                                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-zinc-500" />
                                <span className="truncate max-w-[130px]">{act.label}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Confirmation Bar in Sidebar */}
                        {m.status === 'awaiting_confirmation' && onConfirmPlan && onDismissPlan && (
                          <div className="mt-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex flex-col gap-1.5">
                            <span className="text-[9.5px] font-medium text-slate-700 dark:text-zinc-300">
                              Review changes:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onConfirmPlan(m.id)}
                                className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-slate-950 text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                              >
                                <span>Apply</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onDismissPlan(m.id)}
                                className="py-1 px-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-400 text-[10px] cursor-pointer transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Verification Diff Badge in Sidebar */}
                        {m.verification && (
                          <div className="mt-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedDiffMap((prev) => ({ ...prev, [m.id]: !isDiffOpen }))}
                              className="w-full flex items-center justify-between p-1.5 text-[9.5px] font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span className="truncate max-w-[170px]">{m.verification.summary}</span>
                              </div>
                              {isDiffOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            </button>

                            {isDiffOpen && (
                              <div className="p-2 pt-0 space-y-1 text-[9px] border-t border-black/5 dark:border-white/5">
                                {m.verification.diffs.map((diff, i) => (
                                  <div key={i} className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                                    <span>{diff.property}:</span>
                                    <span className="font-mono text-slate-900 dark:text-zinc-200">{diff.actual}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Thinking Indicator */}
                        {m.status === 'thinking' && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>Analyzing and polishing layout...</span>
                          </div>
                        )}

                        {/* Inline Revert Button */}
                        {canUndoAI && m.sender === 'assistant' && m.status !== 'thinking' && (
                          <div className="mt-1.5 pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={onUndoLastAIEdit}
                              className="text-[9.5px] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
                              title="Undo this specific edit"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Revert</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Follow-up Suggestions in Sidebar */}
                      {m.suggestions && m.suggestions.length > 0 && m.status === 'completed' && (
                        <div className="flex flex-wrap gap-1 pl-1 max-w-[95%]">
                          {m.suggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => {
                                if (isAIExecuting) return
                                onSendMessage?.(sug)
                              }}
                              className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/5 text-[9px] text-slate-600 dark:text-zinc-300 truncate max-w-[200px] cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Playhead Badge & Quick Undo Strip */}
            {!isImage && (
              <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
                <button
                  type="button"
                  onClick={() => setAiPrompt((prev) => `${prev} at ${runtime.currentTime.toFixed(1)}s`.trim())}
                  className="hover:text-slate-700 dark:hover:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Click to insert current playhead timestamp into prompt"
                >
                  <span>Playhead:</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-zinc-300">
                    {formatTimestamp(runtime.currentTime)}
                  </span>
                </button>
                {canUndoAI && (
                  <button
                    type="button"
                    onClick={onUndoLastAIEdit}
                    className="hover:text-slate-700 dark:hover:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Undo last edit"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Undo</span>
                  </button>
                )}
              </div>
            )}

            {/* Message Input at Bottom */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!aiPrompt.trim() || isAIExecuting) return
                const text = aiPrompt.trim()
                setPromptHistory((prev) => [...prev, text])
                setAiPrompt('')
                onSendMessage?.(text)
              }}
              className="relative shrink-0 pt-1 border-t border-black/5 dark:border-white/5"
            >
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' && !aiPrompt && promptHistory.length > 0) {
                      e.preventDefault()
                      setAiPrompt(promptHistory[promptHistory.length - 1])
                    }
                  }}
                  placeholder={
                    isAIExecuting
                      ? 'Executing edits...'
                      : isImage
                      ? 'Ask to polish screenshot...'
                      : 'Ask to zoom, trim, format layout...'
                  }
                  disabled={isAIExecuting}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-100 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-xl text-xs outline-none focus:border-slate-400 dark:focus:border-white/20 transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-slate-800 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!aiPrompt.trim() || isAIExecuting}
                  className="absolute right-1.5 p-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-slate-950 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
                  title="Send message"
                >
                  {isAIExecuting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Simplified, Clean Export Section */}
        {runtime.selectedTab === 'export' && (
          isImage ? (
            <div className="flex flex-col gap-4">
              {/* Image Format */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Format
                </span>
                <div className="grid grid-cols-2 gap-1 bg-[#161924] p-1 rounded-xl border border-white/5">
                  {(['png', 'jpeg'] as const).map((fmt) => {
                    const isActive = (exportSettings.format || 'png') === fmt
                    return (
                      <button
                        key={fmt}
                        onClick={() => onUpdateExportSettings && onUpdateExportSettings({ format: fmt })}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center uppercase ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {fmt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Resolution Selector */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Resolution
                  </span>
                  <span className="text-[10px] font-mono text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {currentDimensions.width} × {currentDimensions.height}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-[#161924] p-1 rounded-xl border border-white/5">
                  {(['original', '2k', '4k'] as const).map((res) => {
                    const isActive = (exportSettings.resolution || 'original') === res
                    const label = res === 'original' ? '1x Native' : res === '2k' ? '2x Retina' : '4K Ultra'
                    return (
                      <button
                        key={res}
                        onClick={() => onUpdateExportSettings && onUpdateExportSettings({ resolution: res as any })}
                        className={`py-1.5 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons: Copy to Clipboard & Save */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => onExportImage && onExportImage('copy')}
                  className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-xs rounded-xl shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Clipboard className="w-3.5 h-3.5 text-blue-400" />
                  <span>Copy Image to Clipboard</span>
                </button>

                <button
                  onClick={() => onExportImage && onExportImage('save')}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save Framed Screenshot</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Format Segmented Row */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Format
                </span>
                <div className="grid grid-cols-2 gap-1 bg-[#161924] p-1 rounded-xl border border-white/5">
                  {(['mp4', 'webm'] as const).map((fmt) => {
                    const isActive = exportSettings.format === fmt
                    return (
                      <button
                        key={fmt}
                        onClick={() => onUpdateExportSettings && onUpdateExportSettings({ format: fmt })}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center uppercase ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {fmt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Resolution Selector (Equal 4 Columns, Clean Fit) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Resolution
                  </span>
                  <span className="text-[10px] font-mono text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {currentDimensions.width} × {currentDimensions.height}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-[#161924] p-1 rounded-xl border border-white/5">
                  {(['4k', '1080p', '720p', 'original'] as const).map((res) => {
                    const isActive = exportSettings.resolution === res
                    const label = res === 'original' ? 'Native' : res.toUpperCase()
                    return (
                      <button
                        key={res}
                        onClick={() => onUpdateExportSettings && onUpdateExportSettings({ resolution: res })}
                        className={`py-1.5 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Frame Rate (Smooth 60 vs Standard 30) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Frame Rate
                </span>
                <div className="grid grid-cols-2 gap-1 bg-[#161924] p-1 rounded-xl border border-white/5">
                  {([60, 30] as const).map((f) => {
                    const isActive = exportSettings.fps === f
                    return (
                      <button
                        key={f}
                        onClick={() => onUpdateExportSettings && onUpdateExportSettings({ fps: f })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {f} FPS {f === 60 ? '(Smooth)' : '(Standard)'}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quality Preset (Clean 3 Levels) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Quality
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 font-semibold">
                    {formatBitrate(currentBitrate)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-[#161924] p-1 rounded-xl border border-white/5">
                  {(['ultra', 'high', 'standard'] as const).map((preset) => {
                    const isActive = exportSettings.bitratePreset === preset
                    const labels = { ultra: 'Ultra', high: 'High', standard: 'Standard' }
                    return (
                      <button
                        key={preset}
                        onClick={() => onUpdateExportSettings && onUpdateExportSettings({ bitratePreset: preset })}
                        className={`py-1.5 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {labels[preset]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Audio Toggle (Simple Single Row) */}
              <div className="flex items-center justify-between p-3 bg-[#161924] rounded-xl border border-white/5">
                <span className="text-xs font-medium text-gray-200">Audio Track</span>
                <button
                  onClick={() =>
                    onUpdateExportSettings &&
                    onUpdateExportSettings({ includeAudio: !exportSettings.includeAudio })
                  }
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    exportSettings.includeAudio ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      exportSettings.includeAudio ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Quick Summary Strip & Save As */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#141720] rounded-xl border border-white/5 text-[11px]">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <span>Est. Size:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {estimatedSize}
                  </span>
                </div>
                <button
                  onClick={handleSelectSaveLocation}
                  className="text-[10px] font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md"
                  title="Choose custom export folder"
                >
                  {exportSettings.saveLocation ? 'Custom Path' : 'Save As...'}
                </button>
              </div>

              {/* Primary Action Export Button */}
              <button
                onClick={() => onExport && onExport()}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-center mt-1"
              >
                Export Video
              </button>
            </div>
          )
        )}
      </div>
    </aside>
  )
}
