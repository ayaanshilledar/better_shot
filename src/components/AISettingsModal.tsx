import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  X,
  Cpu,
  RefreshCw,
  ShieldCheck,
  Bot,
  ArrowLeft
} from 'lucide-react'
import {
  getAIConfig,
  saveAIConfig,
  validateAndFetchModels,
  detectProviderFromKey,
  PROVIDER_MODELS,
  PROVIDER_INFO
} from '../services/aiService'
import { AIProvider } from '../types/ai'

interface AISettingsModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'dialog' | 'overlay'
}

// Safe helpers that never throw even if provider is invalid or corrupted
const getProviderInfo = (p: string | null | undefined) => {
  if (p && PROVIDER_INFO[p as AIProvider]) {
    return PROVIDER_INFO[p as AIProvider]
  }
  return {
    name: 'Groq Cloud',
    placeholder: 'gsk_...',
    getKeyUrl: 'https://console.groq.com/keys',
    keyPrefixHint: 'Starts with gsk_...'
  }
}

const getProviderModels = (p: string | null | undefined): string[] => {
  if (p && PROVIDER_MODELS[p as AIProvider] && Array.isArray(PROVIDER_MODELS[p as AIProvider])) {
    return PROVIDER_MODELS[p as AIProvider]
  }
  return ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  mode = 'dialog'
}) => {
  const [provider, setProvider] = useState<AIProvider>('groq')
  const [apiKey, setApiKey] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('llama-3.3-70b-versatile')
  const [availableModels, setAvailableModels] = useState<string[]>(PROVIDER_MODELS.groq || [])
  const [showKey, setShowKey] = useState<boolean>(false)
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      try {
        const cfg = getAIConfig()
        const initialProvider: AIProvider = (cfg?.provider && PROVIDER_INFO[cfg.provider]) ? cfg.provider : 'groq'
        const initialModels = (Array.isArray(cfg?.availableModels) && cfg.availableModels.length > 0)
          ? cfg.availableModels
          : getProviderModels(initialProvider)

        setProvider(initialProvider)
        setApiKey(cfg?.apiKey || '')
        setSelectedModel(cfg?.selectedModel || initialModels[0] || '')
        setAvailableModels(initialModels)

        if (cfg?.isVerified && cfg?.apiKey) {
          setValidationStatus('success')
          setStatusMessage(`API Key active & verified with ${getProviderInfo(initialProvider).name}`)
        } else {
          setValidationStatus('idle')
          setStatusMessage('')
        }
      } catch (err) {
        console.warn('[BetterShot:AISettings] Error loading AI config:', err)
        setProvider('groq')
        setApiKey('')
        setAvailableModels(getProviderModels('groq'))
        setSelectedModel(getProviderModels('groq')[0] || '')
      }
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider)
    const models = getProviderModels(newProvider)
    setAvailableModels(models)
    setSelectedModel(models[0] || '')
    setValidationStatus('idle')
    setStatusMessage('')
  }

  const handleKeyChange = (val: string) => {
    setApiKey(val)
    setValidationStatus('idle')
    setStatusMessage('')

    // Auto-detect provider from prefix if recognizable
    const detected = detectProviderFromKey(val)
    if (detected && detected !== provider) {
      setProvider(detected)
      const models = getProviderModels(detected)
      setAvailableModels(models)
      setSelectedModel(models[0] || '')
    }
  }

  const detectedProvider = detectProviderFromKey(apiKey)
  const currentInfo = getProviderInfo(provider)
  const detectedInfo = detectedProvider ? getProviderInfo(detectedProvider) : null
  const modelsToDisplay = (Array.isArray(availableModels) && availableModels.length > 0)
    ? availableModels
    : getProviderModels(provider)

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setValidationStatus('error')
      setStatusMessage(`Please enter your ${currentInfo.name} API key.`)
      return
    }

    setIsValidating(true)
    setValidationStatus('idle')
    setStatusMessage(`Verifying key with ${currentInfo.name}...`)

    try {
      const res = await validateAndFetchModels(apiKey.trim(), provider)
      setIsValidating(false)

      if (res.success) {
        setValidationStatus('success')
        const fetchedModels = (Array.isArray(res.models) && res.models.length > 0) ? res.models : modelsToDisplay
        setAvailableModels(fetchedModels)
        setStatusMessage(`Verified with ${currentInfo.name}! Ready to use.`)
        if (!fetchedModels.includes(selectedModel) && fetchedModels.length > 0) {
          setSelectedModel(fetchedModels[0])
        }
        saveAIConfig({
          provider,
          apiKey: apiKey.trim(),
          selectedModel: fetchedModels[0] || selectedModel,
          availableModels: fetchedModels,
          isVerified: true
        })
      } else {
        setValidationStatus('error')
        setStatusMessage(res.error || `Failed to validate ${currentInfo.name} key.`)
      }
    } catch (err: any) {
      setIsValidating(false)
      setValidationStatus('error')
      setStatusMessage(err?.message || `Failed to validate ${currentInfo.name} key.`)
    }
  }

  const handleSave = () => {
    try {
      saveAIConfig({
        provider,
        apiKey: apiKey.trim(),
        selectedModel: selectedModel || modelsToDisplay[0] || '',
        availableModels: modelsToDisplay,
        isVerified: validationStatus === 'success'
      })
    } catch (e) {
      console.warn('[BetterShot:AISettings] Save error:', e)
    }
    onClose()
  }

  const handleOpenKeyPortal = () => {
    try {
      window.open(currentInfo.getKeyUrl, '_blank')
    } catch {}
  }

  const providerList: { id: AIProvider; label: string; shortLabel: string }[] = [
    { id: 'groq', label: 'Groq Cloud', shortLabel: 'Groq' },
    { id: 'google', label: 'Google Gemini', shortLabel: 'Gemini' },
    { id: 'claude', label: 'Claude', shortLabel: 'Claude' },
    { id: 'grok', label: 'xAI Grok', shortLabel: 'Grok' },
    { id: 'openai', label: 'OpenAI', shortLabel: 'OpenAI' },
    { id: 'openrouter', label: 'OpenRouter', shortLabel: 'Router' }
  ]

  // RENDER FOR LAUNCHER OVERLAY MODE (In-place inside Launcher without transparent window backdrop)
  if (mode === 'overlay') {
    return (
      <div className="absolute inset-0 bg-white/98 dark:bg-[#101216]/98 backdrop-blur-md z-40 flex flex-col p-3.5 overflow-hidden animate-in fade-in duration-150 text-slate-800 dark:text-gray-100 rounded-2xl select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-black/5 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="w-5 h-5 rounded-md bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shrink-0">
              <Sparkles className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                AI Configuration
              </h3>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-zinc-400 font-mono">
                BYOK
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 text-xs min-h-0 custom-scrollbar">
          {/* Privacy Note */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
            <p className="text-[10px] text-slate-600 dark:text-zinc-400 leading-relaxed">
              Keys are stored locally in your browser and connect directly to the provider. No intermediate servers or telemetry.
            </p>
          </div>

          {/* Provider Selector Tabs */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">
              Provider
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#161920] border border-black/5 dark:border-white/5 rounded-xl">
              {providerList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  title={p.label}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer truncate text-center ${
                    provider === p.id
                      ? 'bg-white dark:bg-[#222733] text-slate-900 dark:text-white shadow-xs border border-black/5 dark:border-white/10 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {p.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* API Key Input Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                {currentInfo.name} API Key
              </label>
              {detectedInfo && (
                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                  {detectedInfo.name} detected
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={currentInfo.placeholder}
                className="w-full pl-2.5 pr-8 py-1.5 bg-slate-100 dark:bg-[#161920] border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono outline-none focus:border-slate-400 dark:focus:border-white/20 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-white rounded cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleOpenKeyPortal}
                className="text-[10px] text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:underline flex items-center gap-1 font-normal cursor-pointer"
              >
                <span>Get API key ({currentInfo.name})</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidating || !apiKey.trim()}
                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-950 text-slate-700 dark:text-gray-200 text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isValidating ? 'animate-spin' : ''}`} />
                <span>{isValidating ? 'Verifying...' : 'Verify'}</span>
              </button>
            </div>
          </div>

          {/* Validation Feedback Banner */}
          {statusMessage && (
            <div
              className={`p-2 rounded-xl text-[10px] flex items-center gap-1.5 ${
                validationStatus === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : validationStatus === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                  : 'bg-slate-100 dark:bg-[#161920] text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-white/5'
              }`}
            >
              {validationStatus === 'success' ? (
                <CheckCircle2 className="w-3 h-3 shrink-0" />
              ) : validationStatus === 'error' ? (
                <AlertCircle className="w-3 h-3 shrink-0" />
              ) : (
                <RefreshCw className="w-3 h-3 shrink-0 animate-spin" />
              )}
              <span className="truncate">{statusMessage}</span>
            </div>
          )}

          {/* Model Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Model</span>
              <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                {modelsToDisplay.length} available
              </span>
            </label>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-[#161920] border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono outline-none focus:border-slate-400 dark:focus:border-white/20 transition-colors cursor-pointer"
            >
              {modelsToDisplay.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-slate-950 text-xs font-medium rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  // RENDER FOR STUDIO EDITOR DIALOG MODE
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#111216] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-zinc-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                AI Configuration
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-zinc-400 font-medium">
                  BYOK
                </span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3.5 text-xs min-h-0 custom-scrollbar">
          {/* Privacy Notice */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
            <p className="text-[10.5px] text-slate-600 dark:text-zinc-400 leading-relaxed">
              100% Client-Side. Your API keys are stored locally in your browser. Requests call AI endpoints directly with no proxy servers.
            </p>
          </div>

          {/* Provider Selection Tabs */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-slate-700 dark:text-zinc-300">
              Model Provider
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#161922] border border-slate-200 dark:border-white/5 rounded-xl">
              {providerList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  title={p.label}
                  className={`py-1.5 px-2 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer truncate text-center ${
                    provider === p.id
                      ? 'bg-white dark:bg-[#232733] text-slate-900 dark:text-white shadow-xs border border-black/5 dark:border-white/10 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">{p.label}</span>
                  <span className="sm:hidden">{p.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* API Key Input Section */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-700 dark:text-zinc-300">
                {currentInfo.name} API Key
              </label>
              {detectedInfo && (
                <span className="text-[9.5px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                  {detectedInfo.name} detected
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={currentInfo.placeholder}
                className="w-full pl-3 pr-10 py-2 bg-slate-100 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono outline-none focus:border-slate-400 dark:focus:border-white/20 transition-colors"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-white rounded cursor-pointer"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
              <button
                type="button"
                onClick={handleOpenKeyPortal}
                className="text-[10.5px] text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:underline flex items-center gap-1 font-normal cursor-pointer"
              >
                <span>Get API key ({currentInfo.name})</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidating || !apiKey.trim()}
                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-950 text-slate-700 dark:text-gray-200 text-[10.5px] font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-auto"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isValidating ? 'animate-spin' : ''}`} />
                <span>{isValidating ? 'Verifying...' : 'Verify Key'}</span>
              </button>
            </div>
          </div>

          {/* Validation Feedback Banner */}
          {statusMessage && (
            <div
              className={`p-2 rounded-xl text-[10.5px] flex items-center gap-2 ${
                validationStatus === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : validationStatus === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                  : 'bg-slate-100 dark:bg-[#161922] text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-white/5'
              }`}
            >
              {validationStatus === 'success' ? (
                <CheckCircle2 className="w-3 h-3 shrink-0" />
              ) : validationStatus === 'error' ? (
                <AlertCircle className="w-3 h-3 shrink-0" />
              ) : (
                <RefreshCw className="w-3 h-3 shrink-0 animate-spin" />
              )}
              <span className="truncate">{statusMessage}</span>
            </div>
          )}

          {/* Model Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-slate-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Model Selection</span>
              <span className="text-[9.5px] text-slate-400 dark:text-zinc-500">
                {modelsToDisplay.length} models
              </span>
            </label>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono outline-none focus:border-slate-400 dark:focus:border-white/20 transition-colors cursor-pointer"
            >
              {modelsToDisplay.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-slate-950 text-xs font-medium rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}

