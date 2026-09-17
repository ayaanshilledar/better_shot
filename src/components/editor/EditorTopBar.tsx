import React from 'react'
import {
  Undo2,
  Redo2,
  Folder,
  Trash2,
  Download,
  Wand2,
  Crop,
  Square,
  Sparkles,
  Film,
  Minus,
  Maximize2,
  X,
  UserCheck,
  Home
} from 'lucide-react'
import { StudioProject, StudioRuntimeState } from '../../types/editor'

interface EditorTopBarProps {
  project: StudioProject
  runtime: StudioRuntimeState
  onUpdateTitle: (newTitle: string) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onExport: () => void
  onScaleChange: (scale: 'full' | 'half' | 'quarter') => void
  onClose: () => void
  onMinimize: () => void
  onDeleteProject?: () => void
  onSelectTab?: (tab: StudioRuntimeState['selectedTab']) => void
  onAutoFormat?: () => void
  onToggleCrop?: () => void
  onToggleFrame?: () => void
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  project,
  runtime,
  onUpdateTitle,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  onScaleChange,
  onClose,
  onMinimize,
  onDeleteProject,
  onSelectTab,
  onAutoFormat,
  onToggleCrop,
  onToggleFrame
}) => {
  return (
    <header className="h-12 bg-[#12141a]/95 border-b border-white/10 px-3 flex items-center justify-between select-none z-30 drag-region">
      {/* Left section: Project Title & Quick Actions */}
      <div className="flex items-center gap-2 no-drag">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1d26] hover:bg-[#222735] text-gray-300 hover:text-white text-xs font-medium rounded-lg border border-white/5 transition-all cursor-pointer mr-0.5"
          title="Return to Launcher Home"
        >
          <Home className="w-3.5 h-3.5 text-blue-400" />
          <span>Home</span>
        </button>
        <div className="flex items-center gap-1.5 bg-[#1a1d26] hover:bg-[#222735] px-2.5 py-1 rounded-lg border border-white/5 transition-all">
          <input
            type="text"
            value={project.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            className="bg-transparent text-xs font-semibold text-white focus:outline-none w-48 tracking-tight truncate"
            title="Edit project title"
          />
          <span className="text-[10px] text-gray-400 font-mono">.cap</span>
        </div>

        <button
          onClick={() => window.electronAPI?.openRecordingsFolder()}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          title="Open containing folder"
        >
          <Folder className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onDeleteProject}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          title="Delete recording"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-white/10 mx-1" />

        {/* Canvas Tools Toolbar: Auto, Crop, Frame */}
        <div className="flex items-center gap-0.5 bg-[#181a22] p-0.5 rounded-lg border border-white/5 text-[11px] font-medium text-gray-300">
          <button
            onClick={onAutoFormat}
            className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded-md transition-colors text-blue-400 cursor-pointer"
            title="Auto-format canvas framing"
          >
            <Wand2 className="w-3 h-3" />
            <span>Auto</span>
          </button>
          <button
            onClick={onToggleCrop}
            className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white cursor-pointer"
            title="Cycle aspect ratio crop"
          >
            <Crop className="w-3 h-3" />
            <span>Crop</span>
          </button>
          <button
            onClick={onToggleFrame}
            className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white cursor-pointer"
            title="Toggle corner framing"
          >
            <Square className="w-3 h-3" />
            <span>Frame</span>
          </button>
        </div>
      </div>

      {/* Center Section: Undo / Redo & Presets / Clips */}
      <div className="flex items-center gap-2 no-drag">
        <div className="flex items-center gap-1 bg-[#181a22] p-0.5 rounded-lg border border-white/5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-md transition-colors ${
              canUndo ? 'text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer' : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-md transition-colors ${
              canRedo ? 'text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer' : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={() => onSelectTab && onSelectTab('layout')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#181a22] hover:bg-[#222735] text-gray-300 hover:text-white text-xs font-medium rounded-lg border border-white/5 transition-colors cursor-pointer"
          title="Open layout framing"
        >
          <Film className="w-3.5 h-3.5 text-blue-400" />
          <span>Clips</span>
        </button>
      </div>

      {/* Right Section: Scale Toggle, Export CTA, Window Controls */}
      <div className="flex items-center gap-3 no-drag">
        {/* Preview Scale Toggle */}
        <div className="flex items-center gap-1 bg-[#181a22] p-0.5 rounded-lg border border-white/5 text-[11px]">
          <span className="px-2 text-gray-400 font-medium">Preview</span>
          {(['full', 'half', 'quarter'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onScaleChange(s)}
              className={`px-2 py-0.5 rounded-md capitalize font-semibold transition-all ${
                runtime.previewScale === s
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s === 'full' ? 'Full' : s === 'half' ? 'Half' : 'Quarter'}
            </button>
          ))}
        </div>

        {/* Export CTA Button */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 transition-all active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        <div className="h-4 w-px bg-white/10" />

        {/* Window controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
