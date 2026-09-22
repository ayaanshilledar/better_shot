import React from 'react'

export interface AICursorState {
  visible: boolean
  x: number
  y: number
  isClicking: boolean
  currentLabel: string
  targetElementRect?: {
    top: number
    left: number
    width: number
    height: number
  }
}

interface AICursorOverlayProps {
  cursorState: AICursorState
}

export const AICursorOverlay: React.FC<AICursorOverlayProps> = ({ cursorState }) => {
  if (!cursorState.visible) return null

  const { x, y, isClicking, currentLabel, targetElementRect } = cursorState

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Target Element Highlight Box */}
      {targetElementRect && (
        <div
          className="absolute rounded-xl transition-all duration-200 pointer-events-none border border-blue-500/60 bg-blue-500/5 shadow-xs"
          style={{
            top: `${targetElementRect.top - 2}px`,
            left: `${targetElementRect.left - 2}px`,
            width: `${targetElementRect.width + 4}px`,
            height: `${targetElementRect.height + 4}px`
          }}
        />
      )}

      {/* Floating AI Cursor Pointer */}
      <div
        className="absolute pointer-events-none transition-all duration-300 ease-out will-change-transform"
        style={{
          transform: `translate3d(${x}px, ${y}px, 0)`
        }}
      >
        {/* Subtle Click Ripple */}
        {isClicking && (
          <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full border border-blue-500 animate-ping opacity-60 pointer-events-none" />
        )}

        {/* Crisp Designer Cursor Pointer */}
        <div className={`relative transition-transform duration-150 ${isClicking ? 'scale-90' : 'scale-100'}`}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
          >
            <path
              d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
              fill="#0f172a"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Minimal Floating Activity Pill */}
        {currentLabel && (
          <div className="absolute left-5 top-2 flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/95 dark:bg-zinc-900/95 text-white border border-slate-700/60 dark:border-white/10 rounded-full shadow-lg backdrop-blur-md whitespace-nowrap select-none animate-in fade-in duration-150">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[10px] font-medium text-zinc-200 leading-none max-w-[200px] truncate">
              {currentLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

