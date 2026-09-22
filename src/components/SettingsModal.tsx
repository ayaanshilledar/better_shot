import React, { useState, useEffect } from 'react'
import {
  Settings,
  Moon,
  Sun,
  Laptop,
  FolderOpen,
  X,
  Sparkles,
  Video
} from 'lucide-react'
import { useTheme, Theme } from '../context/ThemeContext'
import { APP_CONFIG } from '../config/appConfig'
import { AISettingsModal } from './AISettingsModal'
import { getAIConfig } from '../services/aiService'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme()
  const [isAISettingsOpen, setIsAISettingsOpen] = useState<boolean>(false)
  const [aiConfig, setAiConfig] = useState(getAIConfig())

  useEffect(() => {
    const handleUpdate = () => setAiConfig(getAIConfig())
    window.addEventListener('bettershot-ai-config-changed', handleUpdate)
    return () => window.removeEventListener('bettershot-ai-config-changed', handleUpdate)
  }, [])

  if (!isOpen) return null

  const handleOpenFolder = async () => {
    if (window.electronAPI?.openRecordingsFolder) {
      await window.electronAPI.openRecordingsFolder()
    }
  }

  const themeOptions: { id: Theme; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'system', label: 'System', icon: Laptop },
  ]

  return (
    <div className="absolute inset-0 bg-white/95 dark:bg-[#101216]/95 backdrop-blur-md z-30 flex flex-col p-3.5 overflow-hidden animate-in fade-in duration-150 text-slate-800 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-black/5 dark:border-white/10 shrink-0">
        <h3 className="text-xs font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
          <Settings className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Settings
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
          title="Close Settings"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings Body */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 select-none">
        {/* Appearance / Theme Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Appearance
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
              {theme} mode
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-[#161920] border border-black/5 dark:border-white/5 rounded-xl">
            {themeOptions.map((opt) => {
              const Icon = opt.icon
              const isSelected = theme === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-[#222733] text-blue-600 dark:text-blue-400 shadow-sm border border-black/5 dark:border-white/10 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mb-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'opacity-70'}`} />
                  <span className="text-[10px]">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Camera & Webcam Preferences */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Camera Overlay
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              Floating Bubble
            </span>
          </div>
          <div className="p-2 bg-slate-50 dark:bg-[#181b22] border border-black/5 dark:border-white/5 rounded-xl flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Video className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-800 dark:text-white">Talking Head Bubble</span>
                <span className="text-[9px] text-slate-400 dark:text-gray-400">Draggable on screen during recording</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600/15 text-blue-600 dark:text-blue-400">
              Active
            </span>
          </div>
        </div>

        {/* AI Assistant Preferences */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              AI Configuration
            </span>
            <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-black/5 dark:bg-white/5 px-1.5 py-0.2 rounded border border-black/5 dark:border-white/5">
              BYOK
            </span>
          </div>
          <button
            onClick={() => setIsAISettingsOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#181b22] hover:bg-slate-100 dark:hover:bg-[#1f242e] border border-black/5 dark:border-white/5 rounded-xl text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shrink-0">
                <Sparkles className="w-3 h-3" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 transition-colors">
                  AI Model & API Key
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[190px]">
                  {aiConfig.apiKey
                    ? `${aiConfig.provider?.toUpperCase() || 'AI'}: ${aiConfig.selectedModel}`
                    : 'Add Groq, Google, Claude, or OpenAI key'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 opacity-90 group-hover:text-slate-900 dark:group-hover:text-white">
              Configure
            </span>
          </button>
        </div>

        {/* General / Storage */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Storage & Files
          </span>
          <button
            onClick={handleOpenFolder}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#181b22] hover:bg-slate-100 dark:hover:bg-[#1f242e] border border-black/5 dark:border-white/5 rounded-xl text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Recordings Folder
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[190px]">
                  Videos/{APP_CONFIG.outputFolder}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 opacity-90 group-hover:underline">
              Open
            </span>
          </button>
        </div>

        {/* App Info Footer */}
        <div className="pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
            {APP_CONFIG.appName}
          </span>
          <span>v1.0.0</span>
        </div>
      </div>

      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        mode="overlay"
      />
    </div>
  )
}
