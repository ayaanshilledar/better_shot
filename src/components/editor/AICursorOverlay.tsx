import { AIAgentPersona } from '../../types/ai'

export interface AICursorState {
  visible: boolean
  x: number
  y: number
  isClicking: boolean
  currentLabel: string
  agent?: AIAgentPersona
  name?: string
  color?: string
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

  const agent = cursorState.agent || 'jacob'
  const defaultName = agent === 'dia' ? 'DIA Agent' : 'Jacob'
  const defaultColor = agent === 'dia' ? '#06B6D4' : '#FF5F56'

  const {
    x,
    y,
    isClicking,
    currentLabel,
    name = defaultName,
    color = defaultColor,
    targetElementRect
  } = cursorState

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Target Element Highlight Box */}
      {targetElementRect && (
        <div
          className="absolute rounded-xl transition-all duration-200 pointer-events-none border border-[#FF5F56]/70 bg-[#FF5F56]/10 shadow-[0_0_20px_rgba(255,95,86,0.15)]"
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
          <div
            className="absolute -top-3 -left-3 w-8 h-8 rounded-full border-2 animate-ping opacity-75 pointer-events-none"
            style={{ borderColor: color }}
          />
        )}

        {/* Cursor Body with Pointer & Name Badge */}
        <div
          className={`relative flex flex-col items-start transition-transform duration-150 origin-top-left ${
            isClicking ? 'scale-90' : 'scale-100'
          }`}
        >
          {/* Arrow Pointer */}
          <div className="relative">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.35)]"
            >
              <path
                d="M3.8 2.2L19.2 13.8L11.8 14.8L8.2 22.2L3.8 2.2Z"
                fill={color}
                stroke="#FFFFFF"
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Name Tag Badge attached at bottom-right of pointer */}
          <div
            className="absolute left-[13px] top-[13px] flex flex-col gap-1 items-start select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Primary Name Pill */}
            <div
              className="px-2.5 py-[3px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.25)] flex items-center justify-center whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              <span className="text-[11px] font-semibold text-zinc-950 leading-none tracking-tight">
                {name}
              </span>
            </div>

            {/* Optional Activity / Action Label when performing operations */}
            {currentLabel && currentLabel !== name && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900/90 dark:bg-black/90 text-zinc-200 border border-white/15 rounded-md shadow-lg backdrop-blur-md whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                <span className="text-[10px] font-medium text-zinc-300 leading-none max-w-[180px] truncate">
                  {currentLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

