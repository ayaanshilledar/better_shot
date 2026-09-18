import React, { useRef, useEffect, useState } from 'react'
import { Play, Pause, Scissors, ZoomIn, ZoomOut, SkipBack, SkipForward, Crosshair, Target, Crop, Frame, ChevronDown, Check } from 'lucide-react'
import { StudioProject, StudioRuntimeState, AspectRatioType } from '../../types/editor'
import { calculateActiveZoom } from '../../utils/zoomUtils'

interface StudioCanvasProps {
  project: StudioProject
  runtime: StudioRuntimeState
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTogglePlay: () => void
  onTimeUpdate: (time: number) => void
  onSeek: (time: number) => void
  onZoomChange?: (zoomLevel: number) => void
  onSelectVideo?: () => void
  onDeselectVideo?: () => void
  onUpdateLayout?: (updates: Partial<StudioProject['layout']>, skipHistory?: boolean) => void
  onUpdateZoomFocalPoint?: (zoomId: string, x: number, y: number) => void
  onToggleCrop?: () => void
  onScaleChange?: (scale: 'full' | 'half' | 'quarter') => void
}

const FRAME_PRESETS: { id: AspectRatioType; label: string; ratioText: string; subLabel: string }[] = [
  { id: 'auto', label: 'Auto', ratioText: 'Fit Video', subLabel: 'Natural / Crop Ratio' },
  { id: '16:9', label: '16:9', ratioText: 'Landscape', subLabel: 'YouTube / Desktop' },
  { id: '9:16', label: '9:16', ratioText: 'Portrait', subLabel: 'TikTok / Reels / Shorts' },
  { id: '1:1', label: '1:1', ratioText: 'Square', subLabel: 'Instagram / Feed' },
  { id: '4:3', label: '4:3', ratioText: 'Classic', subLabel: 'Presentation / Tablet' },
  { id: '21:9', label: '21:9', ratioText: 'Ultrawide', subLabel: 'Cinematic Monitor' }
]

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  project,
  runtime,
  videoRef,
  onTogglePlay,
  onTimeUpdate,
  onSeek,
  onZoomChange,
  onSelectVideo,
  onDeselectVideo,
  onUpdateLayout,
  onUpdateZoomFocalPoint,
  onToggleCrop,
  onScaleChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoWrapperRef = useRef<HTMLDivElement>(null)

  const isDraggingRef = useRef<boolean>(false)
  const isDraggingReticleRef = useRef<boolean>(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0
  })
  const hasMovedRef = useRef<boolean>(false)

  // Floating Frame Aspect Ratio menu state
  const [isFrameMenuOpen, setIsFrameMenuOpen] = useState<boolean>(false)
  const frameMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isFrameMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (frameMenuRef.current && !frameMenuRef.current.contains(e.target as Node)) {
        setIsFrameMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [isFrameMenuOpen])

  // Preview Scale multiplier calculation ('full' -> 1.0, 'half' -> 0.5, 'quarter' -> 0.25)
  const previewScaleMultiplier =
    runtime.previewScale === 'half' ? 0.5 : runtime.previewScale === 'quarter' ? 0.25 : 1.0

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0 || isNaN(sec)) {
      return '0:00.00'
    }
    const mins = Math.floor(sec / 60)
    const secs = Math.floor(sec % 60)
    const ms = Math.floor((sec % 1) * 100)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  // Compute CSS Shadow based on project.layout.shadow
  const getShadowStyle = () => {
    switch (project.layout.shadow) {
      case 'soft':
        return '0 8px 20px -4px rgba(0, 0, 0, 0.35), 0 4px 8px -2px rgba(0, 0, 0, 0.2)'
      case 'medium':
        return '0 14px 30px -8px rgba(0, 0, 0, 0.55), 0 6px 12px -3px rgba(0, 0, 0, 0.3)'
      case 'hard':
        return '0 18px 36px -8px rgba(0, 0, 0, 0.75), 0 8px 16px -4px rgba(0, 0, 0, 0.4)'
      case 'glow':
        return '0 0 25px rgba(59, 130, 246, 0.4), 0 12px 28px -6px rgba(0, 0, 0, 0.6)'
      case 'none':
      default:
        return 'none'
    }
  }

  // Calculate smooth sub-frame active zoom state (scale & origin X/Y)
  const activeZoomState = calculateActiveZoom(
    project.timeline.zoomEvents,
    runtime.currentTime
  )

  const selectedZoomEvent = project.timeline.zoomEvents.find(
    (z) => z.id === runtime.selectedZoomId
  )

  // Use selected event's target focal point if in Zoom tab & event selected, else use real-time animated state
  const reticleX = selectedZoomEvent ? selectedZoomEvent.x : activeZoomState.x
  const reticleY = selectedZoomEvent ? selectedZoomEvent.y : activeZoomState.y

  const zoomScale = activeZoomState.scale
  const zoomOriginX = `${activeZoomState.x}%`
  const zoomOriginY = `${activeZoomState.y}%`

  const stageRef = useRef<HTMLDivElement>(null)

  // Real video dimensions tracking from loaded video stream
  const [actualVideoDims, setActualVideoDims] = useState<{ width: number; height: number }>({
    width: project.media.width || 1920,
    height: project.media.height || 1080
  })

  // Stage dimensions tracking to reliably fit any aspect ratio (1:1, 4:3, 9:16, 16:9, 21:9)
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 })

  useEffect(() => {
    const el = stageRef.current || containerRef.current
    if (!el) return

    const updateFromRect = (width: number, height: number) => {
      if (width > 0 && height > 0) {
        setStageDimensions({ width: Math.round(width), height: Math.round(height) })
      }
    }

    const rect = el.getBoundingClientRect()
    updateFromRect(rect.width, rect.height)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          updateFromRect(width, height)
        }
      })
      observer.observe(el)
      return () => observer.disconnect()
    } else {
      const onResize = () => {
        const r = el.getBoundingClientRect()
        updateFromRect(r.width, r.height)
      }
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
  }, [])

  // Streamable local media source URL
  const mediaUrl = project.media.sourcePath ? `file:///${project.media.sourcePath.replace(/\\/g, '/')}` : ''

  const videoW = actualVideoDims.width || project.media.width || 1920
  const videoH = actualVideoDims.height || project.media.height || 1080
  const crop = project.layout.cropRegion

  const isCropped = Boolean(
    crop &&
    crop.width > 20 &&
    crop.height > 20 &&
    (Math.abs(crop.width - videoW) > 2 || Math.abs(crop.height - videoH) > 2 || crop.x > 2 || crop.y > 2)
  )

  const cropW = Math.max(20, isCropped ? crop!.width : videoW)
  const cropH = Math.max(20, isCropped ? crop!.height : videoH)
  const cropX = Math.max(0, isCropped ? crop!.x : 0)
  const cropY = Math.max(0, isCropped ? crop!.y : 0)

  const containerAspect = `${cropW} / ${cropH}`
  const videoRatio = cropW / cropH

  // Canvas aspect ratio resolution
  const activeAspectRatio: AspectRatioType = project.layout.aspectRatio || 'auto'
  const canvasAspectDecimal = (() => {
    switch (activeAspectRatio) {
      case '16:9':
        return 16 / 9
      case '9:16':
        return 9 / 16
      case '1:1':
        return 1 / 1
      case '4:3':
        return 4 / 3
      case '21:9':
        return 21 / 9
      case 'auto':
      default:
        return cropW / cropH
    }
  })()

  // Compute pixel-exact outer canvas frame dimensions fitting stage
  const maxCanvasW = Math.max(100, stageDimensions.width - 24)
  const maxCanvasH = Math.max(100, stageDimensions.height - 24)

  let canvasW = maxCanvasW
  let canvasH = Math.round(maxCanvasW / canvasAspectDecimal)
  if (canvasH > maxCanvasH) {
    canvasH = maxCanvasH
    canvasW = Math.round(maxCanvasH * canvasAspectDecimal)
  }

  // Compute dynamic scale factor based on padding slider (0 to 40 mapped to 1.0 down to 0.65)
  const canvasScale = project.background.type === 'none'
    ? 1.0
    : Math.max(0.5, 1 - (project.layout.padding / 40) * 0.35)

  // Compute pixel-exact video frame width and height inside the canvas frame
  const availableVideoW = Math.max(80, (canvasW - 48) * canvasScale)
  const availableVideoH = Math.max(80, (canvasH - 48) * canvasScale)

  let frameW = availableVideoW
  let frameH = Math.round(availableVideoW / videoRatio)
  if (frameH > availableVideoH) {
    frameH = availableVideoH
    frameW = Math.round(availableVideoH * videoRatio)
  }

  const borderWidth = project.layout.borderWidth ?? 1
  const borderOpacity = project.layout.borderOpacity ?? 25

  // Compute background style string for the background layer
  const getBgStyle = () => {
    if (project.background.type === 'none') return 'transparent'
    if (project.background.customImageUrl) return `url(${project.background.customImageUrl}) center/cover no-repeat`
    return project.background.gradient || project.background.color || '#101216'
  }

  // Keep track of layout dimensions when mounted
  useEffect(() => {
    if (videoWrapperRef.current && onUpdateLayout) {
      const rect = videoWrapperRef.current.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        if (!project.layout.width || !project.layout.height) {
          onUpdateLayout({ width: Math.round(rect.width), height: Math.round(rect.height) }, true)
        }
      }
    }
  }, [project.layout.width, project.layout.height, project.media.width, project.media.height])

  // Synchronize audio volume & muted state with video element
  useEffect(() => {
    if (videoRef.current) {
      const isMuted = Boolean(project.layout.isMuted)
      const vol = (project.layout.volume ?? 100) / 100
      videoRef.current.muted = isMuted
      videoRef.current.volume = isMuted ? 0 : Math.max(0, Math.min(1, vol))
    }
  }, [project.layout.volume, project.layout.isMuted, videoRef.current])

  // Mouse Down Drag Handler on Video Element
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()

    if (onSelectVideo) onSelectVideo()

    if (runtime.selectedTab === 'zoom' && selectedZoomEvent && onUpdateZoomFocalPoint) {
      const videoWrapperEl = videoWrapperRef.current
      if (videoWrapperEl) {
        const rect = videoWrapperEl.getBoundingClientRect()
        const rawX = ((e.clientX - rect.left) / rect.width) * 100
        const rawY = ((e.clientY - rect.top) / rect.height) * 100
        const clampedX = Math.round(Math.max(0, Math.min(100, rawX)))
        const clampedY = Math.round(Math.max(0, Math.min(100, rawY)))
        onUpdateZoomFocalPoint(selectedZoomEvent.id, clampedX, clampedY)
      }
      return
    }

    isDraggingRef.current = true
    hasMovedRef.current = false
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: project.layout.x || 0,
      startY: project.layout.y || 0
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return

      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasMovedRef.current = true
      }

      // Convert screen-space mouse movement to canvas-space coordinates based on preview scale
      const canvasDeltaX = deltaX / previewScaleMultiplier
      const canvasDeltaY = deltaY / previewScaleMultiplier

      const nextX = Math.round(dragStartRef.current.startX + canvasDeltaX)
      const nextY = Math.round(dragStartRef.current.startY + canvasDeltaY)

      if (onUpdateLayout) {
        onUpdateLayout({ x: nextX, y: nextY }, true)
      }
    }

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)

        if (hasMovedRef.current && onUpdateLayout && videoWrapperRef.current) {
          const rect = videoWrapperRef.current.getBoundingClientRect()
          onUpdateLayout(
            {
              x: project.layout.x || 0,
              y: project.layout.y || 0,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              scale: project.layout.scale || 1
            },
            false
          )
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Mouse Down Drag Handler for Zoom Reticle Target Point
  const handleReticleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!selectedZoomEvent || !onUpdateZoomFocalPoint) return

    isDraggingReticleRef.current = true

    const videoWrapperEl = videoWrapperRef.current
    if (!videoWrapperEl) return

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingReticleRef.current) return

      const rect = videoWrapperEl.getBoundingClientRect()
      const rawX = ((moveEvent.clientX - rect.left) / rect.width) * 100
      const rawY = ((moveEvent.clientY - rect.top) / rect.height) * 100

      const clampedX = Math.round(Math.max(0, Math.min(100, rawX)))
      const clampedY = Math.round(Math.max(0, Math.min(100, rawY)))

      onUpdateZoomFocalPoint(selectedZoomEvent.id, clampedX, clampedY)
    }

    const handleMouseUp = () => {
      isDraggingReticleRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Click outside to deselect
  const handleCanvasClick = () => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false
      return
    }
    if (onDeselectVideo) {
      onDeselectVideo()
    }
  }

  const isSelected = Boolean(runtime.isVideoSelected)
  const posX = project.layout.x || 0
  const posY = project.layout.y || 0
  const objectScale = project.layout.scale || 1.0

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      className="flex-1 bg-[#090b0e] relative flex flex-col items-center justify-between overflow-hidden select-none"
    >
      {/* Top Canvas Header (Clean & Borderless, Left: Crop Video | Right: Preview Scale Pill) */}
      <div className="w-full h-12 px-6 flex items-center justify-between select-none z-20 border-b-0 bg-transparent shrink-0">
        {/* Left End: Crop Video & Frame Aspect Ratio Controls */}
        <div className="flex items-center gap-2">
          {/* Crop Video Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onToggleCrop) onToggleCrop()
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm ${
              isCropped
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30 shadow-blue-500/10'
                : 'bg-[#14161f] hover:bg-[#1a1d28] text-gray-300 hover:text-white border-white/10 hover:border-white/20'
            }`}
            title={isCropped ? `Cropped (${cropW}x${cropH}) - Click to adjust crop` : 'Crop Video'}
          >
            <Crop className="w-3.5 h-3.5 text-blue-400" />
            <span>Crop Video</span>
            {isCropped && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            )}
          </button>

          {/* Frame Aspect Ratio Dropdown Button */}
          <div className="relative" ref={frameMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsFrameMenuOpen((prev) => !prev)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                isFrameMenuOpen || activeAspectRatio !== 'auto'
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30 shadow-blue-500/10'
                  : 'bg-[#14161f] hover:bg-[#1a1d28] text-gray-300 hover:text-white border-white/10 hover:border-white/20'
              }`}
              title="Change canvas aspect ratio frame"
            >
              <Frame className="w-3.5 h-3.5 text-blue-400" />
              <span>Frame: <span className="font-mono text-white">{activeAspectRatio.toUpperCase()}</span></span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isFrameMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Floating Dropdown Menu */}
            {isFrameMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-1.5 w-52 bg-[#12141a] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-white/5 mb-0.5">
                  Canvas Aspect Ratio
                </div>
                {FRAME_PRESETS.map((preset) => {
                  const isActive = activeAspectRatio === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        if (onUpdateLayout) {
                          onUpdateLayout({ aspectRatio: preset.id })
                        }
                        setIsFrameMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer text-left ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs">{preset.label}</span>
                          <span className={`text-[11px] ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>• {preset.ratioText}</span>
                        </div>
                        <span className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>{preset.subLabel}</span>
                      </div>
                      {isActive && (
                        <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right End: Preview Scale Segmented Pill Switcher (Matching Provided Screenshot) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center bg-[#14161f] p-1 rounded-xl border border-white/5 shadow-inner gap-0.5"
        >
          {(['full', 'half', 'quarter'] as const).map((scale) => {
            const labels = {
              full: '100% Full',
              half: '50% Half',
              quarter: '25% Quarter'
            }
            const isActive = runtime.previewScale === scale
            return (
              <button
                key={scale}
                onClick={() => onScaleChange && onScaleChange(scale)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                {labels[scale]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Studio Middle Canvas Area */}
      <div
        ref={stageRef}
        className="flex-1 w-full relative flex items-center justify-center overflow-hidden p-2 sm:p-3 min-h-0"
      >
        {/* Outer Studio Background Canvas Frame with Preview Scale transform */}
        <div
          className={`relative rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-200 p-3 sm:p-4 ${
            project.background.type === 'none' ? 'border-none' : 'border border-white/10'
          }`}
          style={{
            boxSizing: 'border-box',
            width: `${canvasW}px`,
            height: `${canvasH}px`,
            maxWidth: '100%',
            maxHeight: '100%',
            transform: `scale(${previewScaleMultiplier})`,
            transformOrigin: 'center center'
          }}
        >
        {/* Dedicated Background Layer (Blur filter applies ONLY to background, never video) */}
        {project.background.type !== 'none' && (
          <div
            className="absolute inset-0 transition-all duration-300 pointer-events-none"
            style={{
              background: getBgStyle(),
              filter: project.background.blurAmount > 0
                ? `blur(${project.background.blurAmount * 0.25}px)`
                : 'none',
              transform: project.background.blurAmount > 0 ? 'scale(1.08)' : 'none'
            }}
          >
            {/* Subtle background overlay grid */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
          </div>
        )}

        {/* Media Frame Container (Stays crisp & unblurred above background layer) */}
        <div
          className="relative z-10 transition-all duration-300 flex items-center justify-center max-w-full max-h-full w-full h-full"
        >
          {/* Framed HTML5 Video Element (Hardware 60FPS with selection & free drag transform) */}
          <div
            ref={videoWrapperRef}
            onMouseDown={handleMouseDown}
            className={`transition-shadow duration-200 relative group flex items-center justify-center cursor-grab active:cursor-grabbing ${
              isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-black/50 shadow-2xl z-20' : ''
            }`}
            style={{
              borderRadius: `${project.layout.cornerRadius}px`,
              boxShadow: isSelected ? undefined : getShadowStyle(),
              transform: `translate(${posX}px, ${posY}px) scale(${objectScale}) translateZ(0)`,
              transformOrigin: 'center center',
              aspectRatio: containerAspect,
              width: `${frameW}px`,
              height: `${frameH}px`,
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          >
            {/* Visual Handles when video is selected */}
            {isSelected && (
              <>
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm shadow-md pointer-events-none z-30" />
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm shadow-md pointer-events-none z-30" />
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm shadow-md pointer-events-none z-30" />
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm shadow-md pointer-events-none z-30" />
              </>
            )}

            {/* Visual Target Reticle Overlay for Zoom Focal Point */}
            {(runtime.selectedTab === 'zoom' || selectedZoomEvent || activeZoomState.activeEventId) && (
              <div
                onMouseDown={handleReticleMouseDown}
                className={`absolute z-40 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-crosshair group transition-transform ${
                  selectedZoomEvent ? 'pointer-events-auto hover:scale-110' : 'pointer-events-none'
                }`}
                style={{
                  left: `${reticleX}%`,
                  top: `${reticleY}%`
                }}
                title="Drag to position zoom focus target"
              >
                {/* Minimal Target Circle Pin */}
                <div className="w-5 h-5 rounded-full border-2 border-white bg-blue-600/80 shadow-md flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                </div>
              </div>
            )}

            {/* Outer Border Stroke Layer (Expands strictly OUTSIDE the video frame) */}
            {borderWidth > 0 && borderOpacity > 0 && (
              <div
                className="absolute pointer-events-none z-30 transition-all duration-150"
                style={{
                  top: `-${borderWidth}px`,
                  left: `-${borderWidth}px`,
                  right: `-${borderWidth}px`,
                  bottom: `-${borderWidth}px`,
                  borderRadius: `${project.layout.cornerRadius + borderWidth}px`,
                  border: `${borderWidth}px solid rgba(255, 255, 255, ${borderOpacity / 100})`,
                  boxSizing: 'border-box'
                }}
              />
            )}

            {/* Framed Viewport Container (Clips inner zoomed content to rounded frame bounds) */}
            <div
              className="w-full h-full relative overflow-hidden"
              style={{
                borderRadius: `${project.layout.cornerRadius}px`
              }}
            >
              {/* Inner Zoom Layer (Scales video content smoothly without overflowing outer frame or affecting padding) */}
              <div
                className="w-full h-full relative overflow-hidden"
                style={{
                  transform: `scale(${zoomScale}) translateZ(0)`,
                  transformOrigin: `${zoomOriginX} ${zoomOriginY}`,
                  willChange: 'transform'
                }}
              >
                {mediaUrl ? (
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    playsInline
                    className={isCropped ? "absolute max-w-none max-h-none block" : "w-full h-full object-cover block"}
                    style={{
                      width: isCropped ? `${(videoW / cropW) * 100}%` : '100%',
                      height: isCropped ? `${(videoH / cropH) * 100}%` : '100%',
                      left: isCropped ? `${-(cropX / cropW) * 100}%` : '0%',
                      top: isCropped ? `${-(cropY / cropH) * 100}%` : '0%',
                      objectFit: isCropped ? 'fill' : 'cover',
                      borderRadius: `${project.layout.cornerRadius}px`,
                      transform: 'translateZ(0)',
                      willChange: 'transform',
                      backfaceVisibility: 'hidden'
                    }}
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget
                      if (el.videoWidth && el.videoHeight) {
                        setActualVideoDims({ width: el.videoWidth, height: el.videoHeight })
                      }
                    }}
                    onTimeUpdate={() => {
                      if (videoRef.current) {
                        onTimeUpdate(videoRef.current.currentTime)
                      }
                    }}
                  />
                ) : (
                  <div className="w-[640px] h-[360px] bg-slate-800 flex items-center justify-center text-gray-400 text-sm">
                    No Video Stream Loaded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Bottom Transport Bar (Clean Aligned Placement) */}
      <div className="w-full h-12 bg-[#0b0c10]/95 border-t-0 px-6 flex items-center justify-between relative select-none z-20">
        {/* Far Left: Timecode Readout */}
        <div className="flex items-center min-w-[110px]">
          <span className="font-mono text-xs font-normal text-gray-400 tracking-tight">
            {formatTime(runtime.currentTime)} / {formatTime(project.media.duration || 4.43)}
          </span>
        </div>

        {/* Absolute Center: Transport Play Controls */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <button
            onClick={() => {
              if (videoRef.current) {
                const t = Math.max(0, videoRef.current.currentTime - 1)
                videoRef.current.currentTime = t
                onSeek(t)
              }
            }}
            className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Step back 1 sec"
          >
            <SkipBack className="w-4 h-4 fill-gray-400 hover:fill-white" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-8 h-8 bg-white hover:bg-gray-100 text-black rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
            title={runtime.isPlaying ? 'Pause' : 'Play'}
          >
            {runtime.isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-black text-black" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-black text-black ml-0.5" />
            )}
          </button>

          <button
            onClick={() => {
              if (videoRef.current) {
                const d = project.media.duration || 5
                const t = Math.min(d, videoRef.current.currentTime + 1)
                videoRef.current.currentTime = t
                onSeek(t)
              }
            }}
            className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Step forward 1 sec"
          >
            <SkipForward className="w-4 h-4 fill-gray-400 hover:fill-white" />
          </button>
        </div>

        {/* Far Right: Scissors & Zoom Controls */}
        <div className="flex items-center gap-3">
          <button
            className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Split clip at playhead"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-white/10 mx-0.5" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const current = runtime.timelineZoom || 1.0
                const next = Math.max(1.0, current - 0.2)
                if (onZoomChange) onZoomChange(next)
              }}
              className="p-0.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom out timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={runtime.timelineZoom || 1.0}
              onChange={(e) => onZoomChange && onZoomChange(parseFloat(e.target.value))}
              className="w-24 accent-blue-500 cursor-pointer h-1 bg-gray-700 rounded-lg"
              title="Adjust timeline track scale"
            />
            <button
              onClick={() => {
                const current = runtime.timelineZoom || 1.0
                const next = Math.min(3.0, current + 0.2)
                if (onZoomChange) onZoomChange(next)
              }}
              className="p-0.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom in timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
