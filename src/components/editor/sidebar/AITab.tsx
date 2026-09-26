import React, { useState, useRef, useEffect } from 'react'
import {
  RotateCcw,
  RefreshCw,
  ArrowUp
} from 'lucide-react'
import { MatrixOrb } from '../../common/MatrixOrb'
import { AIChatMessage } from '../../../types/ai'
import { StudioRuntimeState } from '../../../types/editor'

interface AITabProps {
  runtime: StudioRuntimeState
  isImage: boolean
  aiMessages?: AIChatMessage[]
  isAIExecuting?: boolean
  canUndoAI?: boolean
  onSendMessage?: (text: string) => Promise<void>
  onConfirmPlan?: (messageId: string) => Promise<void> | void
  onDismissPlan?: (messageId: string) => void
  onUndoLastAIEdit?: () => void
}

export const AITab: React.FC<AITabProps> = ({
  runtime,
  isImage,
  aiMessages = [],
  isAIExecuting = false,
  canUndoAI = false,
  onSendMessage,
  onConfirmPlan,
  onDismissPlan,
  onUndoLastAIEdit
}) => {
  const [aiPrompt, setAiPrompt] = useState<string>('')
  const [promptHistory, setPromptHistory] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const formatTimestamp = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ds = Math.floor((sec % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ds}`
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, isAIExecuting])

  return (
    <div className="flex flex-col flex-1 min-h-0 justify-between gap-2.5">
      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 custom-scrollbar text-xs">
        {aiMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 px-2 text-slate-400 dark:text-zinc-500">
            <div className="mb-3 flex items-center justify-center">
              <MatrixOrb state={isAIExecuting ? 'thinking' : 'idle'} size={48} color="#FF5F56" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1">
              Velo AI
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 max-w-[200px] leading-relaxed">
              Type below to format layout, apply wallpapers, or trim video.
            </p>
          </div>
        ) : (
          aiMessages.map((m) => {
            const meaningfulActions = (m.actions || [])
              .map((act) => {
                if (act.type === 'switch_tab' || act.type === 'undo') return null
                if (act.type === 'set_padding') return { key: 'Padding', val: `${act.padding}%` }
                if (act.type === 'set_corner_radius') return { key: 'Corners', val: `${act.cornerRadius}px` }
                if (act.type === 'set_shadow') return { key: 'Shadow', val: String(act.shadow) }
                if (act.type === 'set_background')
                  return {
                    key: 'Wallpaper',
                    val: act.presetId === 'none' ? 'None' : act.presetId || 'Custom'
                  }
                if (act.type === 'set_aspect_ratio') return { key: 'Aspect', val: act.aspectRatio }
                if (act.type === 'trim_video')
                  return {
                    key: 'Trim',
                    val: `${act.start?.toFixed(1) || 0}s-${act.end?.toFixed(1) || 0}s`
                  }

                if (act.label) {
                  if (/^returning to/i.test(act.label)) return null
                  if (/^switching/i.test(act.label)) return null
                  const clean = act.label.replace(/^Setting\s+/i, '').replace(/^Switching to\s+/i, '')
                  const parts = clean.split(/\s+to\s+/i)
                  if (parts.length === 2) {
                    return { key: parts[0], val: parts[1] }
                  }
                  return { key: 'Edit', val: clean }
                }
                return { key: 'Edit', val: act.type }
              })
              .filter((a): a is { key: string; val: string } => Boolean(a))

            return (
              <div
                key={m.id}
                className={`flex flex-col gap-2 ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[96%] p-3 text-[11.5px] leading-relaxed select-text ${
                    m.sender === 'user'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-2xl rounded-tr-xs shadow-xs font-medium'
                      : 'bg-slate-100/90 dark:bg-[#151821] text-slate-800 dark:text-zinc-200 border border-slate-200/70 dark:border-white/5 rounded-2xl rounded-tl-xs shadow-xs'
                  }`}
                >
                  {/* Agent Persona Badge */}
                  {m.sender !== 'user' && (
                    <div className="flex items-center gap-1.5 mb-1.5 select-none">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#FF5F56]/10 border border-[#FF5F56]/25 text-[#FF5F56] text-[9.5px] font-semibold tracking-tight">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF5F56]" />
                        <span>Jacob</span>
                      </div>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed text-[12px]">{m.content}</div>

                  {/* Clarifying Questions Chips */}
                  {m.clarificationOptions && m.clarificationOptions.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                        Choose an option:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {m.clarificationOptions.map((opt, optIdx) => (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => onSendMessage?.(opt)}
                            disabled={isAIExecuting}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 text-[10px] font-medium transition-all cursor-pointer shadow-xs active:scale-95"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clean Action Badges */}
                  {meaningfulActions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-black/5 dark:border-white/5">
                      {meaningfulActions.map((act, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-[10.5px]"
                        >
                          <span className="text-slate-400 dark:text-zinc-500 font-medium">{act.key}:</span>
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">{act.val}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Confirmation Bar */}
                  {m.status === 'awaiting_confirmation' && onConfirmPlan && onDismissPlan && (
                    <div className="mt-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex flex-col gap-2">
                      <span className="text-[10px] font-medium text-slate-700 dark:text-zinc-300">
                        Apply proposed adjustments:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onConfirmPlan(m.id)}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-slate-950 text-[10.5px] font-medium transition-all cursor-pointer shadow-xs"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismissPlan(m.id)}
                          className="py-1.5 px-3 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-400 text-[10.5px] cursor-pointer transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Thinking Indicator */}
                  {m.status === 'thinking' && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400 mt-2">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      <span>Analyzing layout parameters...</span>
                    </div>
                  )}

                  {/* Footer with Revert Action */}
                  {canUndoAI && m.sender === 'assistant' && m.status !== 'thinking' && (
                    <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 dark:text-zinc-500 font-mono text-[9px]">Completed</span>
                      <button
                        type="button"
                        onClick={onUndoLastAIEdit}
                        className="text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white font-medium hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Revert</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Follow-up Suggestions */}
                {m.suggestions && m.suggestions.length > 0 && m.status === 'completed' && (
                  <div className="flex flex-col gap-1 w-full max-w-[96%] pt-1">
                    {m.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => {
                          if (isAIExecuting) return
                          onSendMessage?.(sug)
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg bg-slate-100/80 hover:bg-slate-200 dark:bg-[#161924] dark:hover:bg-white/[0.08] border border-black/5 dark:border-white/5 text-[10.5px] text-slate-700 dark:text-zinc-300 leading-normal transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <span className="pr-2">{sug}</span>
                        <ArrowUp className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-slate-400 dark:text-zinc-400 transition-opacity shrink-0" />
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
                : 'Ask to trim, format layout...'
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
  )
}
