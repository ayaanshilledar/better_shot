import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Move } from 'lucide-react'
import { CropRegion } from '../../electron/preload'

export const AreaSelectorOverlay: React.FC = () => {
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[BetterShot:AreaSelector] Cancelled via Escape key')
        window.electronAPI?.cancelAreaSelection()
      } else if (e.key === 'Enter' && selection && selection.width > 10 && selection.height > 10) {
        console.log('[BetterShot:AreaSelector] Confirmed via Enter key')
        handleConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selection])

  const handleMouseDown = (e: React.MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    console.log(`[BetterShot:AreaSelector] Mouse down at (${x}, ${y})`)
    setStartPos({ x, y })
    setCurrentPos({ x, y })
    setSelection(null)
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !startPos) return
    const x = e.clientX
    const y = e.clientY
    setCurrentPos({ x, y })

    const left = Math.min(startPos.x, x)
    const top = Math.min(startPos.y, y)
    const width = Math.abs(x - startPos.x)
    const height = Math.abs(y - startPos.y)

    setSelection({ x: left, y: top, width, height })
  }

  const handleMouseUp = () => {
    if (isDragging && selection) {
      console.log(`[BetterShot:AreaSelector] Selection finished: x=${selection.x}, y=${selection.y}, w=${selection.width}, h=${selection.height}`)
    }
    setIsDragging(false)
  }

  const handleConfirm = () => {
    if (!selection || selection.width < 10 || selection.height < 10) return

    const cropRegion: CropRegion = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    }

    console.log('[BetterShot:AreaSelector] Confirming area selection region:', cropRegion)
    window.electronAPI?.confirmAreaSelection(cropRegion)
  }

  const handleCancel = () => {
    console.log('[BetterShot:AreaSelector] Cancelled via button click')
    window.electronAPI?.cancelAreaSelection()
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="w-screen h-screen relative select-none cursor-crosshair overflow-hidden bg-black/40"
    >
      {/* Top Banner Guide */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-[#12141a]/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 text-white pointer-events-none">
        <Move className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-semibold tracking-wide">
          Click and drag to select recording area • Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">Esc</kbd> to cancel
        </span>
      </div>

      {/* Selection Box Render */}
      {selection && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-auto flex flex-col justify-between"
          style={{
            left: `${selection.x}px`,
            top: `${selection.y}px`,
            width: `${selection.width}px`,
            height: `${selection.height}px`
          }}
        >
          {/* Dimension Tag */}
          <div className="absolute -top-7 left-0 bg-blue-600 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded shadow">
            {Math.round(selection.width)} × {Math.round(selection.height)} px
          </div>

          {/* Action Toolbar on Mouse Up */}
          {!isDragging && selection.width > 20 && selection.height > 20 && (
            <div className="absolute -bottom-10 right-0 flex items-center gap-1.5 bg-[#12141a] border border-white/15 p-1 rounded-xl shadow-xl z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancel()
                }}
                className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Cancel (Esc)"
              >
                <X className="w-4 h-4 text-rose-400" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleConfirm()
                }}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/30 transition-all cursor-pointer"
                title="Confirm Area Selection (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Start Recording</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
