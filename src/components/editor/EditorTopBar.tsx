import React from 'react'
import {
  Download,
  Minus,
  Square,
  X,
  Home,
  Undo2,
  Redo2,
  Maximize2
} from 'lucide-react'
import { StudioProject, StudioRuntimeState } from '../../types/editor'

interface EditorTopBarProps {
  project?: StudioProject
  runtime?: StudioRuntimeState
  onUpdateTitle?: (newTitle: string) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onExport: () => void
  onScaleChange?: (scale: 'full' | 'half' | 'quarter') => void
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
  canUndo = false,
  canRedo = false,
  onExport,
  onScaleChange,
  onClose,
  onMinimize
}) => {
  const handleToggleMaximize = () => {
    if (window.electronAPI?.toggleMaximizeWindow) {
      window.electronAPI.toggleMaximizeWindow()
    }
  }

  const currentScale = runtime?.previewScale || 'full'

  return (
    <header
      onDoubleClick={handleToggleMaximize}
      className="h-12 bg-[#12141a]/95 px-3 flex items-center justify-between select-none z-30 drag-region cursor-default"
    >
      {/* Left section: Home Navigation + Title */}
      <div className="flex items-center gap-3 no-drag">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1d26] hover:bg-[#222735] text-gray-300 hover:text-white text-xs font-medium rounded-lg border border-white/5 transition-all cursor-pointer"
          title="Return to Launcher Home"
        >
          <Home className="w-3.5 h-3.5 text-blue-400" />
          <span>Home</span>
        </button>

        <div className="h-4 w-px bg-white/10 mx-0.5" />

        {/* Undo / Redo Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              canUndo
                ? 'bg-[#1a1d26] hover:bg-[#222735] text-gray-200 border-white/5'
                : 'bg-transparent text-gray-600 border-transparent cursor-not-allowed opacity-50'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              canRedo
                ? 'bg-[#1a1d26] hover:bg-[#222735] text-gray-200 border-white/5'
                : 'bg-transparent text-gray-600 border-transparent cursor-not-allowed opacity-50'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Project Title Editor */}
        {project && (
          <input
            type="text"
            value={project.title}
            onChange={(e) => onUpdateTitle && onUpdateTitle(e.target.value)}
            className="bg-transparent hover:bg-white/5 focus:bg-[#1a1d26] text-xs font-semibold text-gray-200 focus:text-white px-2 py-1 rounded-md border border-transparent focus:border-white/10 outline-none transition-all max-w-[180px] truncate"
            title="Rename Project"
          />
        )}
      </div>

      {/* Right Section: Preview Scale Selector + Window Controls */}
      <div className="flex items-center gap-3 no-drag">
        {/* Preview Scale Selector (Right Aligned) */}
        <div className="flex items-center gap-1 bg-[#161922] p-0.5 rounded-lg border border-white/5">
          {(['full', 'half', 'quarter'] as const).map((scale) => {
            const labels = { full: '100% Full', half: '50% Half', quarter: '25% Quarter' }
            const isActive = currentScale === scale
            return (
              <button
                key={scale}
                onClick={() => onScaleChange && onScaleChange(scale)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {labels[scale]}
              </button>
            )
          })}
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Window controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleMaximize}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Maximize / Restore"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-md transition-colors"
            title="Close Editor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
