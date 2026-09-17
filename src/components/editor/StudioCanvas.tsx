import React, { useRef } from 'react'
import { Play, Pause, Scissors, ZoomIn, ZoomOut, SkipBack, SkipForward } from 'lucide-react'
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

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-[#090b0e] relative flex flex-col items-center justify-center overflow-hidden p-6 select-none"
    >
      {/* Outer Studio Background Canvas Frame */}
      <div
        className={`relative w-full h-full max-w-6xl max-h-[80vh] rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${
          project.background.type === 'none' ? 'border-none' : 'border border-white/10'
        }`}
        style={{
          background: project.background.type === 'none'
            ? 'transparent'
            : (project.background.gradient || project.background.color || '#101216'),
          filter: (project.background.type !== 'none' && project.background.blurAmount > 0)
            ? `blur(${project.background.blurAmount * 0.2}px)`
            : 'none',
          padding: project.background.type === 'none' ? '0px' : `${project.layout.padding * 1.2}%`,
          boxSizing: 'border-box'
        }}
      >
        {/* Subtle background overlay grid */}
        {project.background.type !== 'none' && (
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        )}

        {/* Media Frame Container */}
        <div
          className="relative transition-all duration-300 flex items-center justify-center max-w-full max-h-full overflow-hidden w-full h-full"
        >
          {/* Framed HTML5 Video Element (Hardware 60FPS) */}
          <div
            className="overflow-hidden transition-all duration-300 relative group flex items-center justify-center max-w-full max-h-full"
            style={{
              borderRadius: `${project.layout.cornerRadius}px`,
              boxShadow: getShadowStyle(),
              transform: `scale(${zoomScale}) translateZ(0)`,
              transformOrigin: `${zoomOriginX} ${zoomOriginY}`,
              aspectRatio: containerAspect,
              width: isPortrait ? 'auto' : '100%',
              height: isPortrait ? '100%' : 'auto',
              maxHeight: '100%',
              maxWidth: '100%'
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
                  className="w-full h-auto object-contain block max-h-[72vh]"
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

      {/* Full-Width Bottom Transport Bar (Matching Reference Design Image 1) */}
      <div className="w-full h-14 bg-[#0b0c10]/95 border-t border-white/5 px-6 flex items-center justify-between select-none z-20">
        {/* Far Left: Timecode Readout */}
        <div className="flex items-center">
          <span className="font-mono text-xs font-normal text-gray-400 tracking-tight">
            {formatTime(runtime.currentTime)}/{formatTime(project.media.duration || 4.43)}
          </span>
        </div>

        {/* Center: Transport Play Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (videoRef.current) {
                const t = Math.max(0, videoRef.current.currentTime - 1)
                videoRef.current.currentTime = t
                onSeek(t)
              }
            }}
            className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Step back 1 sec"
          >
            <SkipBack className="w-4 h-4 fill-gray-400 hover:fill-white" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-10 h-10 bg-white hover:bg-gray-100 text-black rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
            title={runtime.isPlaying ? 'Pause' : 'Play'}
          >
            {runtime.isPlaying ? (
              <Pause className="w-4 h-4 fill-black text-black" />
            ) : (
              <Play className="w-4 h-4 fill-black text-black ml-0.5" />
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
            className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Step forward 1 sec"
          >
            <SkipForward className="w-4 h-4 fill-gray-400 hover:fill-white" />
          </button>
        </div>

        {/* Far Right: Scissors & Zoom Controls */}
        <div className="flex items-center gap-3">
          <button
            className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Split clip at playhead"
          >
            <Scissors className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          <div className="flex items-center gap-2">
            <ZoomOut className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={zoomScale}
              onChange={(e) => onZoomChange && onZoomChange(parseFloat(e.target.value))}
              className="w-24 accent-blue-500 cursor-pointer h-1 bg-gray-700 rounded-lg"
            />
            <ZoomIn className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
