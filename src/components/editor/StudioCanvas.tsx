import React, { useRef, useEffect } from 'react'
import { Play, Pause, Scissors, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react'
import { StudioProject, StudioRuntimeState } from '../../types/editor'

interface StudioCanvasProps {
  project: StudioProject
  runtime: StudioRuntimeState
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTogglePlay: () => void
  onTimeUpdate: (time: number) => void
  onSeek: (time: number) => void
  onZoomChange?: (zoomLevel: number) => void
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  project,
  runtime,
  videoRef,
  onTogglePlay,
  onTimeUpdate,
  onSeek,
  onZoomChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

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

  // Active zoom scale calculation for real-time preview
  const currentZoomEvent = project.timeline.zoomEvents.find(
    (z) => runtime.currentTime >= z.startTime && runtime.currentTime <= z.startTime + z.duration
  )

  const zoomScale = currentZoomEvent ? currentZoomEvent.scale : 1.0
  const zoomOriginX = currentZoomEvent ? `${currentZoomEvent.x}%` : '50%'
  const zoomOriginY = currentZoomEvent ? `${currentZoomEvent.y}%` : '50%'

  // Streamable local media source URL
  const mediaUrl = project.media.sourcePath ? `file:///${project.media.sourcePath.replace(/\\/g, '/')}` : ''

  const videoW = project.media.width || 1920
  const videoH = project.media.height || 1080
  const crop = project.layout.cropRegion

  const isCropped = Boolean(
    crop &&
    crop.width > 0 &&
    crop.height > 0 &&
    (crop.width !== videoW || crop.height !== videoH || crop.x !== 0 || crop.y !== 0)
  )

  const cropW = crop?.width || videoW
  const cropH = crop?.height || videoH
  const cropX = crop?.x || 0
  const cropY = crop?.y || 0

  const containerAspect = isCropped
    ? `${cropW} / ${cropH}`
    : `${videoW} / ${videoH}`

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-[#090b0e] relative flex flex-col items-center justify-center overflow-hidden p-6 select-none"
    >
      {/* Outer Studio Background Canvas Frame */}
      <div
        className={`relative w-full h-full max-w-5xl max-h-[75vh] rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${
          project.background.type === 'none' ? 'border-none' : 'border border-white/10'
        }`}
        style={{
          background: project.background.type === 'none'
            ? 'transparent'
            : (project.background.gradient || project.background.color || '#101216'),
          filter: (project.background.type !== 'none' && project.background.blurAmount > 0)
            ? `blur(${project.background.blurAmount * 0.2}px)`
            : 'none'
        }}
      >
        {/* Subtle background overlay grid */}
        {project.background.type !== 'none' && (
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        )}

        {/* Media Frame Container (Padding & Shadow Application) */}
        <div
          className="relative transition-all duration-300 flex items-center justify-center max-w-full max-h-[70vh]"
          style={{
            padding: project.background.type === 'none' ? '0%' : `${project.layout.padding}%`,
            width: isCropped
              ? 'auto'
              : project.layout.aspectRatio === '16:9'
              ? '90%'
              : project.layout.aspectRatio === '1:1'
              ? '70%'
              : '85%',
            height: 'auto'
          }}
        >
          {/* Framed HTML5 Video Element (Hardware 60FPS) */}
          <div
            className="overflow-hidden transition-all duration-300 relative group flex items-center justify-center"
            style={{
              borderRadius: `${project.layout.cornerRadius}px`,
              boxShadow: getShadowStyle(),
              transform: `scale(${zoomScale})`,
              transformOrigin: `${zoomOriginX} ${zoomOriginY}`,
              aspectRatio: containerAspect,
              width: isCropped ? 'auto' : '100%',
              maxWidth: '100%',
              maxHeight: '60vh'
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
                    style={{
                      position: 'absolute',
                      width: `${(videoW / cropW) * 100}%`,
                      height: `${(videoH / cropH) * 100}%`,
                      left: `${-(cropX / cropW) * 100}%`,
                      top: `${-(cropY / cropH) * 100}%`,
                      maxWidth: 'none',
                      maxHeight: 'none',
                      objectFit: 'fill'
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
                  className="w-full h-auto object-contain block max-h-[60vh]"
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

      {/* Floating Playback & Scissor Controls Bar (Bottom of Stage) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#12151c]/90 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-4 shadow-2xl z-20">
        {/* Timecode display */}
        <span className="font-mono text-xs font-semibold text-gray-300 min-w-[110px]">
          {formatTime(runtime.currentTime)} / {formatTime(project.media.duration || 4.43)}
        </span>

        <div className="h-4 w-px bg-white/10" />

        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all shadow-md active:scale-95 cursor-pointer"
        >
          {runtime.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </button>

        <div className="h-4 w-px bg-white/10" />

        {/* Scissor / Cut Tool */}
        <button
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Split clip at playhead"
        >
          <Scissors className="w-4 h-4" />
        </button>

        {/* Zoom Level Control */}
        <div className="flex items-center gap-2 bg-[#1a1d26] px-2.5 py-1 rounded-lg border border-white/5">
          <ZoomOut className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={zoomScale}
            onChange={(e) => onZoomChange && onZoomChange(parseFloat(e.target.value))}
            className="w-20 accent-blue-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
          />
          <ZoomIn className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] font-mono font-semibold text-blue-400 min-w-[28px]">{zoomScale.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  )
}
