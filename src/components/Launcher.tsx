import React, { useState } from 'react'
import {
  Monitor,
  Crop,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Minus,
  X,
  Play
} from 'lucide-react'
import { APP_CONFIG } from '../config/appConfig'

interface LauncherProps {
  onStartRecording: (mode: 'display' | 'area') => void
  enableMic: boolean
  setEnableMic: (val: boolean) => void
  enableSystemAudio: boolean
  setEnableSystemAudio: (val: boolean) => void
}

export const Launcher: React.FC<LauncherProps> = ({
  onStartRecording,
  enableMic,
  setEnableMic,
  enableSystemAudio,
  setEnableSystemAudio
}) => {
  const [activeCaptureMode, setActiveCaptureMode] = useState<'display' | 'area'>('display')

  const handleMinimize = () => {
    window.electronAPI?.minimizeLauncher()
  }

  const handleClose = () => {
    window.electronAPI?.closeLauncher()
  }

  return (
    <div className="w-full h-full bg-[#101216] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl select-none">
      {/* Window Drag Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/5 bg-[#14171d]/90">
        {/* Left branding (Draggable title region) */}
        <div className="drag-region flex-1 flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-white">{APP_CONFIG.appName}</span>
        </div>

        {/* Right window actions (Non-draggable clickable buttons) */}
        <div className="flex items-center gap-1 no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (window.electronAPI?.minimizeLauncher) {
                window.electronAPI.minimizeLauncher()
              }
            }}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="no-drag p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (window.electronAPI?.closeLauncher) {
                window.electronAPI.closeLauncher()
              }
            }}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="no-drag p-1 text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-3 flex-1 flex flex-col gap-2.5 overflow-hidden">
        {/* 2-Column Capture Source Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Display option */}
          <div
            onClick={() => setActiveCaptureMode('display')}
            className={`group flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
              activeCaptureMode === 'display'
                ? 'bg-[#252934] border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg'
                : 'bg-[#181b22] border-white/5 hover:bg-[#20242e] hover:border-white/10'
            }`}
          >
            <Monitor className={`w-4 h-4 ${activeCaptureMode === 'display' ? 'text-blue-400' : 'text-gray-400'}`} />
            <span className="text-xs font-bold text-white">Display</span>
          </div>

          {/* Area option */}
          <div
            onClick={() => setActiveCaptureMode('area')}
            className={`group flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
              activeCaptureMode === 'area'
                ? 'bg-[#252934] border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg'
                : 'bg-[#181b22] border-white/5 hover:bg-[#20242e] hover:border-white/10'
            }`}
          >
            <Crop className={`w-4 h-4 ${activeCaptureMode === 'area' ? 'text-blue-400' : 'text-gray-400'}`} />
            <span className="text-xs font-bold text-white">Area</span>
          </div>
        </div>

        {/* Audio Source Toggles */}
        <div className="flex flex-col gap-2 pt-0.5">
          {/* Microphone toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#181b22] border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-2.5">
              {enableMic ? (
                <Mic className="w-4 h-4 text-blue-400" />
              ) : (
                <MicOff className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-xs font-semibold text-white">
                {enableMic ? 'Microphone' : 'No Microphone'}
              </span>
            </div>
            <button
              onClick={() => setEnableMic(!enableMic)}
              className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all ${
                enableMic
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-[#2a2e38] text-gray-400 hover:text-white'
              }`}
            >
              {enableMic ? 'On' : 'Off'}
            </button>
          </div>

          {/* System Audio toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#181b22] border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-2.5">
              {enableSystemAudio ? (
                <Volume2 className="w-4 h-4 text-blue-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-xs font-semibold text-white">
                {enableSystemAudio ? 'System Audio' : 'No System Audio'}
              </span>
            </div>
            <button
              onClick={() => setEnableSystemAudio(!enableSystemAudio)}
              className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all ${
                enableSystemAudio
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-[#2a2e38] text-gray-400 hover:text-white'
              }`}
            >
              {enableSystemAudio ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Start Recording CTA */}
        <button
          onClick={() => onStartRecording(activeCaptureMode)}
          className="mt-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Start Recording
        </button>
      </div>
    </div>
  )
}
