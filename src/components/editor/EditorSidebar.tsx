import React from 'react'
import {
  Image,
  Sliders,
  Download,
  Volume2,
  MousePointer,
  Bot
} from 'lucide-react'
import {
  StudioProject,
  StudioRuntimeState
} from '../../types/editor'
import { CursorConfig, DEFAULT_CURSOR_CONFIG } from '../../types/cursor'
import { AIChatMessage } from '../../types/ai'
import {
  BackgroundTab,
  LayoutTab,
  CursorTab,
  AudioTab,
  AITab,
  ExportTab
} from './sidebar'

interface EditorSidebarProps {
  width?: number
  project: StudioProject
  runtime: StudioRuntimeState
  onUpdateBackground: (updates: Partial<StudioProject['background']>) => void
  onUpdateLayout: (updates: Partial<StudioProject['layout']>) => void
  onSelectTab: (tab: StudioRuntimeState['selectedTab']) => void
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
  onUpdateCursorConfig,
  onUpdateExportSettings,
  onExport,
  onExportImage,
  onSendMessage,
  onConfirmPlan,
  onDismissPlan,
  isAIExecuting = false,
  onUndoLastAIEdit,
  canUndoAI = false,
  aiMessages = []
}) => {
  const isImage = Boolean(
    project.media.mediaType === 'image' ||
      /\.(png|jpe?g|webp|bmp|gif)$/i.test(project.media.sourcePath)
  )

  const allTabs = [
    { id: 'background', label: 'Bg', icon: Image },
    { id: 'layout', label: 'Layout', icon: Sliders },
    { id: 'cursor', label: 'Cursor', icon: MousePointer },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'ai', label: 'AI', icon: Bot },
    { id: 'export', label: 'Export', icon: Download }
  ] as const

  const tabs = isImage
    ? allTabs.filter(
        (t) =>
          t.id === 'background' ||
          t.id === 'layout' ||
          t.id === 'ai' ||
          t.id === 'export'
      )
    : allTabs

  const cursorConfig = project.cursorConfig || DEFAULT_CURSOR_CONFIG

  return (
    <aside
      style={{ width: `${width}px` }}
      className="bg-white dark:bg-[#1a1a1a] border-l border-slate-200 dark:border-white/[0.06] flex flex-col select-none z-20 text-slate-800 dark:text-gray-100 shrink-0 overflow-hidden"
    >
      {/* Smooth Segmented Tab Switcher Bar */}
      <div className="p-3 bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-200/80 dark:border-white/[0.06]">
        <div
          className="grid gap-1 bg-slate-200/70 dark:bg-[#252525] p-[3px] rounded-xl border border-black/5 dark:border-white/[0.06]"
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
                className={`py-1.5 px-0.5 rounded-[8px] flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#2373F4] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/60 dark:text-white/40 dark:hover:text-white/70'
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
        {runtime.selectedTab === 'background' && (
          <BackgroundTab
            project={project}
            onUpdateBackground={onUpdateBackground}
            onUpdateLayout={onUpdateLayout}
          />
        )}

        {runtime.selectedTab === 'layout' && (
          <LayoutTab
            project={project}
            onUpdateBackground={onUpdateBackground}
            onUpdateLayout={onUpdateLayout}
          />
        )}

        {runtime.selectedTab === 'cursor' && (
          <CursorTab
            cursorConfig={cursorConfig}
            onUpdateCursorConfig={onUpdateCursorConfig}
          />
        )}

        {runtime.selectedTab === 'audio' && (
          <AudioTab
            project={project}
            onUpdateLayout={onUpdateLayout}
          />
        )}

        {runtime.selectedTab === 'ai' && (
          <AITab
            runtime={runtime}
            isImage={isImage}
            aiMessages={aiMessages}
            isAIExecuting={isAIExecuting}
            canUndoAI={canUndoAI}
            onSendMessage={onSendMessage}
            onConfirmPlan={onConfirmPlan}
            onDismissPlan={onDismissPlan}
            onUndoLastAIEdit={onUndoLastAIEdit}
          />
        )}

        {runtime.selectedTab === 'export' && (
          <ExportTab
            project={project}
            isImage={isImage}
            onUpdateExportSettings={onUpdateExportSettings}
            onExport={onExport}
            onExportImage={onExportImage}
          />
        )}
      </div>
    </aside>
  )
}
