import React, { useState } from 'react'
import {
  Monitor,
  AppWindow as WindowIcon,
  Crop,
  Video,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ChevronDown,
  Minus,
  X,
  Play
} from 'lucide-react'
import { DesktopSource } from '../../electron/preload'
import { APP_CONFIG } from '../config/appConfig'

interface LauncherProps {
  onStartRecording: (mode: 'display' | 'window' | 'area' | 'camera') => void
  onOpenSourcePicker: () => void
  selectedSource: DesktopSource | null
  enableCamera: boolean
  setEnableCamera: (val: boolean) => void
  enableMic: boolean
  setEnableMic: (val: boolean) => void
  enableSystemAudio: boolean
  setEnableSystemAudio: (val: boolean) => void
}

export const Launcher: React.FC<LauncherProps> = ({
  onStartRecording,
  onOpenSourcePicker,
  selectedSource,
  enableCamera,
  setEnableCamera,
  enableMic,
  setEnableMic,
  enableSystemAudio,
  setEnableSystemAudio
}) => {
  const [activeCaptureMode, setActiveCaptureMode] = useState<'display' | 'window' | 'area' | 'camera'>('display')

  const handleMinimize = () => {
    window.electronAPI?.minimizeLauncher()
  }

  const handleClose = () => {
    window.electronAPI?.closeLauncher()
  }

  return (
    <div className="w-full h-full bg-[#101216] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl select-none">
      {/* Window Drag Header */}
      <div className="drag-region px-4 py-3 flex items-center justify-between border-b border-white/5 bg-[#14171d]/80">
        {/* Left branding */}
        <div className="flex items-center gap-2.5 no-drag">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-white/10">
            <div className="w-4 h-4 rounded-full border-2 border-black" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white">{APP_CONFIG.appName}</span>
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-white/5 rounded-full border border-white/10">
            {APP_CONFIG.workspaceLabel}
          </span>
        </div>

        {/* Right window actions */}
        <div className="flex items-center gap-1.5 no-drag">
          <button
            onClick={handleMinimize}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-4 flex-1 flex flex-col gap-3.5 overflow-y-auto">

        {/* 2x2 Capture Source Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Display option */}
          <div
            onClick={() => {
              setActiveCaptureMode('display')
              onOpenSourcePicker()
            }}
            className={`group relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeCaptureMode === 'display'
                ? 'bg-[#252934] border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg'
                : 'bg-[#181b22] border-white/5 hover:bg-[#20242e] hover:border-white/10'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <Monitor className={`w-5 h-5 flex-shrink-0 ${activeCaptureMode === 'display' ? 'text-blue-400' : 'text-gray-400'}`} />
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white">Display</span>
                <span className="text-[10px] text-gray-400 truncate">
                  {selectedSource?.isDisplay ? selectedSource.name : 'Full Screen'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>

          {/* Window option */}
          <div
            onClick={() => {
              setActiveCaptureMode('window')
              onOpenSourcePicker()
            }}
            className={`group relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeCaptureMode === 'window'
                ? 'bg-[#252934] border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg'
                : 'bg-[#181b22] border-white/5 hover:bg-[#20242e] hover:border-white/10'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <WindowIcon className={`w-5 h-5 flex-shrink-0 ${activeCaptureMode === 'window' ? 'text-blue-400' : 'text-gray-400'}`} />
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white">Window</span>
                <span className="text-[10px] text-gray-400 truncate">
                  {selectedSource && !selectedSource.isDisplay ? selectedSource.name : 'App Window'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>

          {/* Area option */}
          <div
            onClick={() => setActiveCaptureMode('area')}
            className={`group flex items-center justify-center gap-2 p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeCaptureMode === 'area'
                ? 'bg-[#252934] border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg'
                : 'bg-[#181b22] border-white/5 hover:bg-[#20242e] hover:border-white/10'
            }`}
          >
            <Crop className={`w-5 h-5 ${activeCaptureMode === 'area' ? 'text-blue-400' : 'text-gray-400'}`} />
            <span className="text-xs font-bold text-white">Area</span>
          </div>

          {/* Camera Only option */}
          <div
            onClick={() => setActiveCaptureMode('camera')}
            className={`group flex items-center justify-center gap-2 p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeCaptureMode === 'camera'
                ? 'bg-[#252934] border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg'
                : 'bg-[#181b22] border-white/5 hover:bg-[#20242e] hover:border-white/10'
            }`}
          >
            <Video className={`w-5 h-5 ${activeCaptureMode === 'camera' ? 'text-blue-400' : 'text-gray-400'}`} />
            <span className="text-xs font-bold text-white">Camera Only</span>
          </div>
        </div>

        {/* Audio Source Toggles */}
        <div className="flex flex-col gap-2 pt-1">

          {/* Microphone toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#181b22] border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3">
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
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                enableMic
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-[#2a2e38] text-gray-400 hover:text-white'
              }`}
            >
              {enableMic ? 'On' : 'Off'}
            </button>
          </div>

          {/* System Audio toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#181b22] border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3">
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
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
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
          className="mt-auto py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all"
        >
          <Play className="w-4 h-4 fill-white" />
          Start Recording
        </button>
      </div>
    </div>
  )
}
