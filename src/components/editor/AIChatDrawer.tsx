import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  ArrowUp,
  X,
  Settings,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Loader2
} from 'lucide-react'
import { AIChatMessage, AIAction } from '../../types/ai'
import { getAIConfig, saveAIConfig, PROVIDER_INFO } from '../../services/aiService'

interface AIChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSendMessage: (text: string) => Promise<void>
  onConfirmPlan?: (messageId: string) => Promise<void> | void
  onDismissPlan?: (messageId: string) => void
  messages: AIChatMessage[]
  isExecuting: boolean
  currentActionIndex: number
  currentActions: AIAction[]
  onOpenSettings: () => void
  onUndoLastAIEdit?: () => void
  canUndo?: boolean
}

// Convert action types into concise, high-end user-facing reasons
function getActionReason(action?: AIAction): string {
  if (!action) return 'Refining aesthetics'
  switch (action.type) {
    case 'set_aspect_ratio':
      return 'Framing ratio'
    case 'set_background':
      return 'Background contrast'
    case 'set_padding':
    case 'set_corner_radius':
    case 'set_shadow':
      return 'Spacing & border radius'
    case 'add_zoom':
      return 'Focal zoom'
    case 'trim_video':
      return 'Trim duration'
    case 'clear_zooms':
      return 'Reset zooms'
    case 'undo':
      return 'Revert snapshot'
    default:
      return 'Polishing design'
  }
}

const DEFAULT_REASONS = [
  'Refining framing',
  'Balancing contrast',
  'Adjusting spacing',
  'Adding subtle movement',
  'Polishing layout'
]

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  onConfirmPlan,
  onDismissPlan,
  messages,
  isExecuting,
  currentActionIndex,
  currentActions,
  onOpenSettings,
  onUndoLastAIEdit,
  canUndo = false
}) => {
  const [inputText, setInputText] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [config, setConfig] = useState(getAIConfig())
  const [reasonIndex, setReasonIndex] = useState<number>(0)
  const [isReasonTransitioning, setIsReasonTransitioning] = useState<boolean>(false)
  const [expandedDiffMap, setExpandedDiffMap] = useState<Record<string, boolean>>({})
  const [expandedThoughtMap, setExpandedThoughtMap] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleConfigChange = () => setConfig(getAIConfig())
    window.addEventListener('bettershot-ai-config-changed', handleConfigChange)
    return () => window.removeEventListener('bettershot-ai-config-changed', handleConfigChange)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isExecuting, currentActionIndex])

  // Smoothly cycle morphing reasons while working
  const dynamicReasons =
    currentActions.length > 0
      ? currentActions.map((a) => getActionReason(a))
      : DEFAULT_REASONS

  useEffect(() => {
    if (!isExecuting) return
    const interval = setInterval(() => {
      setIsReasonTransitioning(true)
      setTimeout(() => {
        setReasonIndex((prev) => (prev + 1) % dynamicReasons.length)
        setIsReasonTransitioning(false)
      }, 150)
    }, 1800)
    return () => clearInterval(interval)
  }, [isExecuting, dynamicReasons.length])

  if (!isOpen) return null

  const handleSend = () => {
    if (!inputText.trim() || isExecuting) return
    const text = inputText.trim()
    setInputText('')
    onSendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleAutoApply = () => {
    const updated = !config.autoApplyByDefault
    saveAIConfig({ autoApplyByDefault: updated })
  }

  const suggestionChips = [
    'Add wallpaper, 12% padding & drop shadow',
    'Trim the first and last 1 second',
    'Add 1.8x focal zoom at current time',
    'Apply Northern Lights gradient background',
    'Format with 16px rounded corners & subtle shadow'
  ]

  const activeReason =
    isExecuting && currentActions[currentActionIndex]
      ? getActionReason(currentActions[currentActionIndex])
      : dynamicReasons[reasonIndex] || 'Refining layout'

  const completedActions = currentActions.slice(0, currentActionIndex)

  return (
    <div
      className={`fixed right-4 bottom-4 z-40 bg-white/95 dark:bg-[#111216]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/20 flex flex-col transition-all duration-200 overflow-hidden text-slate-800 dark:text-zinc-100 select-none ${
        isExpanded ? 'w-[480px] h-[700px]' : 'w-[390px] h-[580px]'
      }`}
    >
      {/* Header */}
      <div className="h-12 px-3.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-sm">
            <Sparkles className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
              Assistant
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-zinc-400 font-medium truncate max-w-[120px] border border-black/5 dark:border-white/5">
              {config.apiKey ? (config.selectedModel || 'Connected') : 'Local'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Mode Switch: Auto vs Review */}
          <button
            onClick={toggleAutoApply}
            className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer border ${
              config.autoApplyByDefault
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent shadow-xs'
                : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border-transparent hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title={
              config.autoApplyByDefault
                ? 'Auto-Apply: Changes execute immediately'
                : 'Review: Requires confirmation before applying'
            }
          >
            {config.autoApplyByDefault ? 'Auto' : 'Review'}
          </button>

          <div className="w-px h-3.5 bg-slate-200 dark:bg-white/10 mx-0.5" />

          <button
            onClick={onOpenSettings}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="AI Settings & API Key"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse size' : 'Expand size'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {messages.length === 0 ? (
          <div className="flex flex-col py-4 px-1 gap-4">
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                How can I help with this video?
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                Describe adjustments to framing, timing, zoom, and background.
              </p>
            </div>

            {/* Starter Suggestions */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 px-0.5">
                Suggested actions
              </span>
              {suggestionChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(chip)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-slate-50/80 hover:bg-slate-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.07] border border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 text-[11px] text-slate-700 dark:text-zinc-300 transition-all cursor-pointer truncate"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isDiffOpen = expandedDiffMap[m.id] ?? false
            const isThoughtOpen = expandedThoughtMap[m.id] ?? false

            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1.5 ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] p-3 text-[11px] leading-relaxed select-text ${
                    m.sender === 'user'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-2xl rounded-tr-xs shadow-xs'
                      : 'bg-slate-100/90 dark:bg-[#18191e] text-slate-800 dark:text-zinc-200 border border-slate-200/60 dark:border-white/5 rounded-2xl rounded-tl-xs'
                  }`}
                >
                  {/* Active Execution Status Banner */}
                  {(m.status === 'thinking' || m.status === 'executing' || m.status === 'verifying') && (
                    <div className="w-full my-1.5 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600 dark:text-zinc-300">
                        <Loader2 className="w-3 h-3 animate-spin text-slate-500 dark:text-zinc-400" />
                        <span className="transition-opacity duration-150">
                          {isReasonTransitioning ? 'Working...' : activeReason}
                        </span>
                      </div>

                      {completedActions.length > 0 && (
                        <div className="flex flex-col gap-1 pt-1 border-t border-black/5 dark:border-white/5">
                          {completedActions.map((act, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-[9.5px] text-slate-500 dark:text-zinc-400"
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{act.label || getActionReason(act)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Reasoning Disclosure */}
                  {m.thoughtProcess && m.status === 'completed' && (
                    <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                      <button
                        onClick={() => setExpandedThoughtMap((prev) => ({ ...prev, [m.id]: !isThoughtOpen }))}
                        className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Reasoning</span>
                        {isThoughtOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                      </button>

                      {isThoughtOpen && (
                        <div className="mt-1.5 p-2 rounded-lg bg-black/5 dark:bg-white/5 text-[10px] text-slate-600 dark:text-zinc-400 space-y-1">
                          {m.thoughtProcess.analysis && <p><strong>Analysis:</strong> {m.thoughtProcess.analysis}</p>}
                          {m.thoughtProcess.reasoning && <p><strong>Rationale:</strong> {m.thoughtProcess.reasoning}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Checklist */}
                  {m.actions && m.actions.length > 0 && m.status !== 'thinking' && m.status !== 'executing' && (
                    <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 flex flex-col gap-1">
                      <span className="text-[9.5px] font-medium text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                        <SlidersHorizontal className="w-2.5 h-2.5" /> Planned Changes
                      </span>
                      {m.actions.map((act, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-zinc-300"
                        >
                          <Check className="w-2.5 h-2.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          <span className="truncate">{act.label || getActionReason(act)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confirmation Bar */}
                  {m.status === 'awaiting_confirmation' && onConfirmPlan && onDismissPlan && (
                    <div className="mt-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-700 dark:text-zinc-300 font-medium">
                        <span>Review changes</span>
                        <span className="text-[9.5px] text-slate-400 dark:text-zinc-500">Ready to apply</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onConfirmPlan(m.id)}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-slate-950 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <span>Apply Changes</span>
                        </button>
                        <button
                          onClick={() => onDismissPlan(m.id)}
                          className="py-1.5 px-3 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-400 text-[11px] cursor-pointer transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Verification Diff */}
                  {m.verification && (
                    <div className="mt-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedDiffMap((prev) => ({ ...prev, [m.id]: !isDiffOpen }))}
                        className="w-full flex items-center justify-between p-2 text-[10px] font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>{m.verification.summary}</span>
                        </div>
                        {isDiffOpen ? <ChevronUp className="w-2.5 h-2.5 text-slate-400" /> : <ChevronDown className="w-2.5 h-2.5 text-slate-400" />}
                      </button>

                      {isDiffOpen && (
                        <div className="p-2.5 pt-0 space-y-1 text-[9.5px] border-t border-black/5 dark:border-white/5">
                          {m.verification.diffs.map((diff, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between py-0.5 text-slate-600 dark:text-zinc-400"
                            >
                              <span>{diff.property}:</span>
                              <span className="font-mono text-slate-900 dark:text-zinc-200">{diff.actual}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Follow-Up Suggestions */}
                {m.suggestions && m.suggestions.length > 0 && m.status === 'completed' && (
                  <div className="flex flex-wrap gap-1.5 pl-0.5 pt-0.5 max-w-[95%]">
                    {m.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => onSendMessage(sug)}
                        disabled={isExecuting}
                        className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/5 text-[10px] text-slate-600 dark:text-zinc-300 transition-all cursor-pointer truncate max-w-[280px]"
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

      {/* Undo Action Strip */}
      {canUndo && (
        <div className="px-3.5 py-1.5 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
          <span className="text-slate-400 dark:text-zinc-500">Need to revert?</span>
          <button
            onClick={onUndoLastAIEdit}
            className="flex items-center gap-1 text-slate-700 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white font-medium cursor-pointer transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Undo Edit</span>
          </button>
        </div>
      )}

      {/* Input Footer */}
      <div className="p-3 bg-white dark:bg-[#111216] border-t border-slate-100 dark:border-white/5 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center gap-1.5 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder="Ask to trim, format layout, add zoom..."
            className="w-full pl-3 pr-9 py-2 bg-slate-100/80 dark:bg-[#181920] border border-slate-200/80 dark:border-white/10 rounded-xl text-xs outline-none focus:border-slate-400 dark:focus:border-white/20 transition-colors disabled:opacity-50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isExecuting}
            className="absolute right-1.5 p-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-slate-950 disabled:opacity-30 rounded-lg shadow-xs transition-all cursor-pointer"
            title="Send prompt"
          >
            <ArrowUp className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>
        <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-zinc-500 px-1">
          <span>{config.autoApplyByDefault ? 'Auto-apply active' : 'Review mode active'}</span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  )
}

