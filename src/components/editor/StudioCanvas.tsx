import React, { useRef, useEffect, useState } from 'react'
import { Play, Pause, Scissors, ZoomIn, ZoomOut, SkipBack, SkipForward, Crosshair, Target } from 'lucide-react'
import { StudioProject, StudioRuntimeState } from '../../types/editor'
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
}

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
  onUpdateZoomFocalPoint
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
        return '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
      case 'medium':
        return '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0,0,0,0.4)'
      case 'hard':
        return '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 0, 0, 0.8)'
      case 'glow':
        return '0 0 35px rgba(59, 130, 246, 0.4), 0 20px 40px -10px rgba(0, 0, 0, 0.8)'
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

  // Streamable local media source URL
  const mediaUrl = project.media.sourcePath ? `file:///${project.media.sourcePath.replace(/\\/g, '/')}` : ''

  const videoW = project.media.width || 1920
  const videoH = project.media.height || 1080
  const crop = project.layout.cropRegion

  const isCropped = Boolean(
    crop &&
    crop.width > 50 &&
    crop.height > 50 &&
    (crop.width !== videoW || crop.height !== videoH || crop.x !== 0 || crop.y !== 0)
  )

  const cropW = Math.max(50, crop?.width || videoW)
  const cropH = Math.max(50, crop?.height || videoH)
  const cropX = Math.max(0, crop?.x || 0)
  const cropY = Math.max(0, crop?.y || 0)

  const containerAspect = isCropped
    ? `${cropW} / ${cropH}`
    : `${videoW} / ${videoH}`

  const isPortrait = cropW < cropH

  // Compute dynamic scale factor based on padding slider (0 to 40 mapped to 1.0 down to 0.65)
  const canvasScale = project.background.type === 'none'
    ? 1.0
    : Math.max(0.5, 1 - (project.layout.padding / 40) * 0.35)

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
      className="flex-1 bg-[#090b0e] relative flex flex-col items-center justify-center overflow-hidden p-2 sm:p-3 select-none"
    >
      {/* Outer Studio Background Canvas Frame with Preview Scale transform */}
      <div
        className={`relative w-full h-full max-w-[96vw] max-h-[88vh] rounded-2xl flex items-center justify-center overflow-hidden transition-transform duration-200 p-3 sm:p-4 ${
          project.background.type === 'none' ? 'border-none' : 'border border-white/10'
        }`}
        style={{
          boxSizing: 'border-box',
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
          className="relative z-10 transition-all duration-300 flex items-center justify-center max-w-full max-h-full overflow-hidden w-full h-full"
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
              width: isPortrait ? 'auto' : '100%',
              height: isPortrait ? '100%' : 'auto',
              maxWidth: `${canvasScale * 100}%`,
              maxHeight: `${canvasScale * 100}%`
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

            {/* Framed Viewport Container (Clips inner zoomed content to rounded frame bounds) */}
            <div
              className="w-full h-full relative overflow-hidden flex items-center justify-center"
              style={{
                borderRadius: `${project.layout.cornerRadius}px`,
                aspectRatio: containerAspect
              }}
            >
              {/* Inner Zoom Layer (Scales video content smoothly without overflowing outer frame or affecting padding) */}
              <div
                className="w-full h-full relative flex items-center justify-center"
                style={{
                  transform: `scale(${zoomScale}) translateZ(0)`,
                  transformOrigin: `${zoomOriginX} ${zoomOriginY}`,
                  willChange: 'transform'
                }}
              >
                {mediaUrl ? (
                  isCropped ? (
                    <div
                      className="relative overflow-hidden w-full h-full"
                      style={{
                        aspectRatio: containerAspect,
                        width: '100%',
                        height: '100%'
                      }}
                    >
                      <video
                        ref={videoRef}
                        src={mediaUrl}
                        playsInline
                        className="absolute max-w-none max-h-none"
                        style={{
                          width: `${(videoW / cropW) * 100}%`,
                          height: `${(videoH / cropH) * 100}%`,
                          left: `${-(cropX / cropW) * 100}%`,
                          top: `${-(cropY / cropH) * 100}%`,
                          objectFit: 'cover',
                          transform: 'translateZ(0)',
                          willChange: 'transform',
                          backfaceVisibility: 'hidden'
                        }}
                        onTimeUpdate={() => {
                          if (videoRef.current) {
                            onTimeUpdate(videoRef.current.currentTime)
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      src={mediaUrl}
                      playsInline
                      className="w-full h-full object-cover block"
                      style={{
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden'
                      }}
                      onTimeUpdate={() => {
                        if (videoRef.current) {
                          onTimeUpdate(videoRef.current.currentTime)
                        }
                      }}
                    />
                  )
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

      {/* Bottom Transport Bar (Clean Aligned Placement) */}
      <div className="w-full h-12 bg-[#0b0c10]/95 border-t border-white/5 px-6 flex items-center justify-between relative select-none z-20">
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
