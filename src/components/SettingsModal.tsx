import React, { useState, useEffect } from 'react'
import {
  Moon,
  Sun,
  Laptop,
  FolderOpen,
  X,
  Video,
  Bot
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
    window.addEventListener('velo-ai-config-changed', handleUpdate)
    window.addEventListener('bettershot-ai-config-changed', handleUpdate)
    return () => {
      window.removeEventListener('velo-ai-config-changed', handleUpdate)
      window.removeEventListener('bettershot-ai-config-changed', handleUpdate)
    }
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
    <div className="w-full h-fit bg-[#1a1a1a] z-30 flex flex-col overflow-hidden animate-in fade-in duration-150 text-white rounded-2xl relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <h3 className="text-[13px] font-semibold text-white/90">
          Settings
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-white/40 hover:text-white/70 rounded-md transition-colors cursor-pointer"
          title="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Body */}
      <div className="w-full px-4 py-3 space-y-4 select-none shrink-0">
        {/* Appearance / Theme Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-white/60">
              Appearance
            </span>
            <span className="text-[11px] text-white/30 capitalize">
              {theme} mode
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-[#252525] rounded-xl">
            {themeOptions.map((opt) => {
              const Icon = opt.icon
              const isSelected = theme === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-[10px] text-[12px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#333] text-white shadow-sm'
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-white/80' : 'text-white/30'}`} />
                  <span className="text-[11px]">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Camera Overlay Info */}
        <div className="space-y-2">
          <span className="text-[12px] font-medium text-white/60">
            Camera Overlay
          </span>
          <div className="flex items-center justify-between py-2.5 px-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <Video className="w-4 h-4 text-white/50" />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-white/80">Talking Head Bubble</span>
                <span className="text-[11px] text-white/30">Draggable on screen during recording</span>
              </div>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.06] text-white/40">
              Active
            </span>
          </div>
        </div>

        {/* Velo AI Configuration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-white/60">
              Velo AI
            </span>
            <span className="text-[10px] font-mono text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded">
              BYOK
            </span>
          </div>
          <button
            onClick={() => setIsAISettingsOpen(true)}
            className="w-full flex items-center justify-between py-2.5 px-1 group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <Bot className="w-4 h-4 text-white/50" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">
                  Model & API Key
                </span>
                <span className="text-[11px] text-white/30 truncate max-w-[180px]">
                  {aiConfig.apiKey
                    ? `${aiConfig.provider?.toUpperCase() || 'AI'}: ${aiConfig.selectedModel}`
                    : 'Add Groq, Google, Claude, or OpenAI key'}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-medium text-white/30 group-hover:text-white/60 transition-colors">
              Configure
            </span>
          </button>
        </div>

        {/* Storage & Files */}
        <div className="space-y-2">
          <span className="text-[12px] font-medium text-white/60">
            Storage
          </span>
          <button
            onClick={handleOpenFolder}
            className="w-full flex items-center justify-between py-2.5 px-1 group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-white/50" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">
                  Recordings Folder
                </span>
                <span className="text-[11px] text-white/30 truncate max-w-[180px]">
                  Videos/{APP_CONFIG.outputFolder}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-medium text-white/30 group-hover:text-white/60 transition-colors">
              Open
            </span>
          </button>
        </div>

        {/* App Info Footer */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/20">
          <span>{APP_CONFIG.appName}</span>
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
