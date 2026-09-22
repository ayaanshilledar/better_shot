import React, { useState, useEffect, useRef } from 'react'
import {
  FlipHorizontal,
  Circle,
  Square,
  EyeOff,
  Maximize2,
  Minimize2,
  VideoOff,
  Move
} from 'lucide-react'
import { CameraOverlayConfig, DEFAULT_CAMERA_CONFIG } from '../types/editor'

export const CameraBubbleOverlay: React.FC = () => {
  const [config, setConfig] = useState<CameraOverlayConfig>(DEFAULT_CAMERA_CONFIG)
  const [isVisible, setIsVisible] = useState<boolean>(true)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Listen for config & toggle relay from Electron IPC
  useEffect(() => {
    if (window.electronAPI?.onCameraConfigUpdate) {
      const unsubConfig = window.electronAPI.onCameraConfigUpdate((newConfig: any) => {
        console.log('[BetterShot:CameraBubble] Received camera config update:', newConfig)
        setConfig((prev) => ({ ...prev, ...newConfig }))
      })
      const unsubToggle = window.electronAPI.onCameraToggleUpdate?.((enabled: boolean) => {
        console.log('[BetterShot:CameraBubble] Received camera toggle update:', enabled)
        setIsVisible(enabled)
      })
      return () => {
        unsubConfig()
        if (unsubToggle) unsubToggle()
      }
    }
  }, [])

  // Start webcam feed
  useEffect(() => {
    let isActive = true

    const startWebcam = async () => {
      try {
        setStreamError(null)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
        }

        const constraints: MediaStreamConstraints = {
          video: config.deviceId ? { deviceId: { exact: config.deviceId } } : true,
          audio: false
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!isActive) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err: any) {
        console.error('[BetterShot:CameraBubble] Failed to acquire camera stream:', err)
        if (isActive) {
          setStreamError(err?.message || 'Camera inaccessible')
        }
      }
    }

    startWebcam()

    return () => {
      isActive = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [config.deviceId])

  // Broadcast local changes to Electron
  const updateConfig = (updates: Partial<CameraOverlayConfig>) => {
    const next = { ...config, ...updates }
    setConfig(next)
    if (window.electronAPI?.sendCameraConfig) {
      window.electronAPI.sendCameraConfig(updates)
    }
  }

  const handleToggleMirror = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateConfig({ mirror: !config.mirror })
  }

  const handleToggleShape = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateConfig({ shape: config.shape === 'circle' ? 'rect' : 'circle' })
  }

  const handleCycleSize = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextSize = config.size === 'small' ? 'medium' : config.size === 'medium' ? 'large' : 'small'
    updateConfig({ size: nextSize })
  }

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsVisible(false)
    if (window.electronAPI?.sendCameraToggle) {
      window.electronAPI.sendCameraToggle(false)
    }
  }

  if (!isVisible) return null

  const isCircle = config.shape === 'circle'

  return (
    <div
      className="w-screen h-screen flex items-center justify-center p-2 bg-transparent select-none font-sans overflow-hidden"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Outer Floating Shell */}
      <div
        className={`relative w-full h-full flex items-center justify-center transition-all duration-200 cursor-move group ${
          isCircle ? 'rounded-full' : 'rounded-2xl'
        } ring-2 ring-white/80 dark:ring-blue-500/80 shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden bg-slate-950`}
      >
        {/* Live Video Feed */}
        {streamError ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-900 text-slate-400">
            <VideoOff className="w-6 h-6 mb-1 text-red-400" />
            <span className="text-[10px] font-medium text-slate-300">Camera error</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover pointer-events-none transition-transform duration-150 ${
              config.mirror ? 'scale-x-[-1]' : ''
            }`}
          />
        )}

        {/* Hover Controls Overlay */}
        <div
          className={`absolute inset-x-0 bottom-1 flex items-center justify-center gap-1.5 transition-opacity duration-150 no-drag z-20 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-1 p-1 bg-black/75 backdrop-blur-md rounded-full border border-white/20 shadow-lg text-white">
            {/* Mirror Toggle */}
            <button
              onClick={handleToggleMirror}
              title={config.mirror ? 'Disable Mirror' : 'Enable Mirror'}
              className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-slate-200 hover:text-white"
            >
              <FlipHorizontal className="w-3 h-3" />
            </button>

            {/* Shape Toggle */}
            <button
              onClick={handleToggleShape}
              title={isCircle ? 'Switch to Rounded Rectangle' : 'Switch to Circle'}
              className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-slate-200 hover:text-white"
            >
              {isCircle ? <Square className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            </button>

            {/* Size Cycle */}
            <button
              onClick={handleCycleSize}
              title={`Size: ${config.size} (Click to cycle)`}
              className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-slate-200 hover:text-white"
            >
              {config.size === 'large' ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
            </button>

            {/* Hide Camera */}
            <button
              onClick={handleHide}
              title="Hide Camera"
              className="p-1 rounded-full hover:bg-red-500/30 text-slate-200 hover:text-red-300 transition-colors cursor-pointer"
            >
              <EyeOff className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Subtle Drag Hint icon when hovered */}
        {isHovered && (
          <div className="absolute top-2 inset-x-0 flex justify-center pointer-events-none z-10">
            <div className="px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded-full flex items-center gap-1 border border-white/10 text-[9px] text-white/80 shadow">
              <Move className="w-2.5 h-2.5" />
              <span>Drag</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
