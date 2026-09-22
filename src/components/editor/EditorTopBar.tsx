import React from 'react'
import {
  Download,
  Minus,
  Square,
  X,
  Home,
  Undo2,
  Redo2,
  Maximize2,
  Sun,
  Moon
} from 'lucide-react'
import { StudioProject, StudioRuntimeState } from '../../types/editor'
import { useTheme } from '../../context/ThemeContext'

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
  onToggleAI?: () => void
  isAIOpen?: boolean
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
  onMinimize,
  onToggleAI,
  isAIOpen = false
}) => {
  const { resolvedTheme, setTheme } = useTheme()

  const handleToggleMaximize = () => {
    if (window.electronAPI?.toggleMaximizeWindow) {
      window.electronAPI.toggleMaximizeWindow()
    }
  }

  const currentScale = runtime?.previewScale || 'full'

  return (
    <header
      onDoubleClick={handleToggleMaximize}
      className="h-12 bg-white/95 dark:bg-[#12141a]/95 px-3 flex items-center justify-between select-none z-30 drag-region cursor-default border-b border-black/5 dark:border-white/5 text-slate-900 dark:text-white"
    >
      {/* Left section: Home Navigation + Title */}
      <div className="flex items-center gap-3 no-drag">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1d26] dark:hover:bg-[#222735] text-slate-700 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white text-xs font-medium rounded-lg border border-slate-200 dark:border-white/5 transition-all cursor-pointer"
          title="Return to Launcher Home"
        >
          <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Home</span>
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-white/10 mx-0.5" />

        {/* Undo / Redo Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              canUndo
                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1d26] dark:hover:bg-[#222735] text-slate-700 dark:text-gray-200 border-slate-200 dark:border-white/5'
                : 'bg-transparent text-slate-300 dark:text-gray-600 border-transparent cursor-not-allowed opacity-50'
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
                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1d26] dark:hover:bg-[#222735] text-slate-700 dark:text-gray-200 border-slate-200 dark:border-white/5'
                : 'bg-transparent text-slate-300 dark:text-gray-600 border-transparent cursor-not-allowed opacity-50'
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
            className="bg-transparent hover:bg-black/5 focus:bg-slate-100 dark:hover:bg-white/5 dark:focus:bg-[#1a1d26] text-xs font-semibold text-slate-800 focus:text-slate-950 dark:text-gray-200 dark:focus:text-white px-2 py-1 rounded-md border border-transparent focus:border-slate-300 dark:focus:border-white/10 outline-none transition-all max-w-[180px] truncate"
            title="Rename Project"
          />
        )}
      </div>

      {/* Right Section: Preview Scale Selector + Theme Toggle + Window Controls */}
      <div className="flex items-center gap-3 no-drag">
        {/* Preview Scale Selector (Right Aligned) */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161922] p-0.5 rounded-lg border border-slate-200 dark:border-white/5">
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
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
                }`}
              >
                {labels[scale]}
              </button>
            )
          })}
        </div>

        {/* Quick Theme Toggle Button */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-black/5 dark:hover:border-white/5"
          title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-blue-600" />
          )}
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-white/10" />

        {/* Window controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleMaximize}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Maximize / Restore"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/20 rounded-md transition-colors cursor-pointer"
            title="Close Editor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
