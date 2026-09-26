import React from 'react'
import { Download, Clipboard } from 'lucide-react'
import { StudioProject } from '../../../types/editor'
import {
  calculateExportDimensions,
  calculateTargetBitrate,
  estimateFileSize,
  formatBitrate
} from '../../../services/exportService'

interface ExportTabProps {
  project: StudioProject
  isImage: boolean
  onUpdateExportSettings?: (updates: Partial<StudioProject['exportSettings']>) => void
  onExport?: () => void
  onExportImage?: (action: 'save' | 'copy') => void
}

export const ExportTab: React.FC<ExportTabProps> = ({
  project,
  isImage,
  onUpdateExportSettings,
  onExport,
  onExportImage
}) => {
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
      const cleanTitle = (project.title || 'Velo').replace(/[<>:"/\\|?*]+/g, '_')
      const ext = exportSettings.format || 'mp4'
      const defaultName = `${cleanTitle}_${exportSettings.resolution}.${ext}`
      const res = await window.electronAPI.showSaveDialog(defaultName, ext)
      if (!res.canceled && res.filePath && onUpdateExportSettings) {
        onUpdateExportSettings({ saveLocation: res.filePath })
      }
    }
  }

  if (isImage) {
    return (
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
          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#252525] p-[3px] rounded-xl border border-black/5 dark:border-white/[0.06]">
            {(['original', '2k', '4k'] as const).map((res) => {
              const isActive = (exportSettings.resolution || 'original') === res
              const label = res === 'original' ? '1x Native' : res === '2k' ? '2x Retina' : '4K Ultra'
              return (
                <button
                  key={res}
                  onClick={() => onUpdateExportSettings && onUpdateExportSettings({ resolution: res as any })}
                  className={`py-1.5 px-1 rounded-[8px] text-xs font-medium transition-all cursor-pointer text-center ${
                    isActive
                      ? 'bg-[#2373F4] text-white shadow-sm'
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
            className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium text-xs rounded-xl shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Clipboard className="w-3.5 h-3.5 text-[#2373F4]" />
            <span>Copy Image to Clipboard</span>
          </button>

          <button
            onClick={() => onExportImage && onExportImage('save')}
            className="w-full py-3 px-4 bg-[#2373F4] hover:bg-[#2373F4]/90 text-white font-semibold text-[13px] rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save Framed Screenshot</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Format Segmented Row */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Format
        </span>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-[#252525] p-[3px] rounded-xl border border-black/5 dark:border-white/[0.06]">
          {(['mp4', 'webm'] as const).map((fmt) => {
            const isActive = exportSettings.format === fmt
            return (
              <button
                key={fmt}
                onClick={() => onUpdateExportSettings && onUpdateExportSettings({ format: fmt })}
                className={`py-1.5 px-3 rounded-[8px] text-xs font-medium transition-all cursor-pointer text-center uppercase ${
                  isActive
                    ? 'bg-[#2373F4] text-white shadow-sm'
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
          <span className="text-[10px] font-mono text-[#2373F4] font-semibold bg-[#2373F4]/10 px-2 py-0.5 rounded border border-[#2373F4]/20">
            {currentDimensions.width} × {currentDimensions.height}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-[#252525] p-[3px] rounded-xl border border-black/5 dark:border-white/[0.06]">
          {(['4k', '1080p', '720p', 'original'] as const).map((res) => {
            const isActive = exportSettings.resolution === res
            const label = res === 'original' ? 'Native' : res.toUpperCase()
            return (
              <button
                key={res}
                onClick={() => onUpdateExportSettings && onUpdateExportSettings({ resolution: res })}
                className={`py-1.5 px-1 rounded-[8px] text-xs font-medium transition-all cursor-pointer text-center ${
                  isActive
                    ? 'bg-[#2373F4] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Frame Rate */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Frame Rate
        </span>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-[#252525] p-[3px] rounded-xl border border-black/5 dark:border-white/[0.06]">
          {([60, 30] as const).map((f) => {
            const isActive = exportSettings.fps === f
            return (
              <button
                key={f}
                onClick={() => onUpdateExportSettings && onUpdateExportSettings({ fps: f })}
                className={`py-1.5 px-2 rounded-[8px] text-xs font-medium transition-all cursor-pointer text-center ${
                  isActive
                    ? 'bg-[#2373F4] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f} FPS {f === 60 ? '(Smooth)' : '(Standard)'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Quality Preset */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Quality
          </span>
          <span className="text-[10px] font-mono text-cyan-400 font-semibold">
            {formatBitrate(currentBitrate)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#252525] p-[3px] rounded-xl border border-black/5 dark:border-white/[0.06]">
          {(['ultra', 'high', 'standard'] as const).map((preset) => {
            const isActive = exportSettings.bitratePreset === preset
            const labels = { ultra: 'Ultra', high: 'High', standard: 'Standard' }
            return (
              <button
                key={preset}
                onClick={() => onUpdateExportSettings && onUpdateExportSettings({ bitratePreset: preset })}
                className={`py-1.5 px-1 rounded-[8px] text-xs font-medium transition-all cursor-pointer text-center ${
                  isActive
                    ? 'bg-[#2373F4] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {labels[preset]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Audio Toggle */}
      <div className="flex items-center justify-between p-3 bg-[#252525] rounded-xl border border-white/[0.06]">
        <span className="text-xs font-medium text-gray-200">Audio Track</span>
        <button
          onClick={() =>
            onUpdateExportSettings &&
            onUpdateExportSettings({ includeAudio: !exportSettings.includeAudio })
          }
          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
            exportSettings.includeAudio ? 'bg-[#2373F4]' : 'bg-gray-700'
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
      <div className="flex items-center justify-between px-3 py-2 bg-[#252525] rounded-xl border border-white/[0.06] text-[11px]">
        <div className="flex items-center gap-1.5 text-gray-400">
          <span>Est. Size:</span>
          <span className="font-mono font-bold text-emerald-400">{estimatedSize}</span>
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
        className="w-full py-3 px-4 bg-[#2373F4] hover:bg-[#2373F4]/90 text-white font-semibold text-[13px] rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer text-center mt-1"
      >
        Export Video
      </button>
    </div>
  )
}
