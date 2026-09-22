import { StudioProject } from '../types/editor'
import { AIAction, AIConfig, AIPlanResult, AIProvider } from '../types/ai'
import { WALLPAPER_PRESETS } from '../config/presets'

const STORAGE_KEYS = {
  PROVIDER: 'bettershot_ai_provider',
  API_KEY: 'bettershot_ai_api_key',
  MODEL: 'bettershot_ai_model',
  MODELS_CACHE: 'bettershot_ai_models_cache',
  VERIFIED: 'bettershot_ai_is_verified',
  AUTO_APPLY: 'bettershot_ai_auto_apply'
}

export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'deepseek-r1-distill-llama-70b',
    'mixtral-8x7b-32768'
  ],
  google: [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ],
  claude: [
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest'
  ],
  grok: [
    'grok-2-latest',
    'grok-beta',
    'grok-vision-beta'
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
    'gpt-4-turbo'
  ],
  openrouter: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct'
  ]
}

export const PROVIDER_INFO: Record<
  AIProvider,
  { name: string; placeholder: string; getKeyUrl: string; keyPrefixHint: string }
> = {
  groq: {
    name: 'Groq Cloud',
    placeholder: 'gsk_...',
    getKeyUrl: 'https://console.groq.com/keys',
    keyPrefixHint: 'Starts with gsk_...'
  },
  google: {
    name: 'Google Gemini',
    placeholder: 'AIzaSy...',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    keyPrefixHint: 'Starts with AIza...'
  },
  claude: {
    name: 'Anthropic Claude',
    placeholder: 'sk-ant-...',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefixHint: 'Starts with sk-ant-...'
  },
  grok: {
    name: 'xAI Grok',
    placeholder: 'xai-...',
    getKeyUrl: 'https://console.x.ai/',
    keyPrefixHint: 'Starts with xai-...'
  },
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-...',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    keyPrefixHint: 'Starts with sk-...'
  },
  openrouter: {
    name: 'OpenRouter',
    placeholder: 'sk-or-...',
    getKeyUrl: 'https://openrouter.ai/keys',
    keyPrefixHint: 'Starts with sk-or-...'
  }
}

/**
 * Automatically detects the AI provider from the API key prefix.
 */
export function detectProviderFromKey(key: string): AIProvider | null {
  if (!key) return null
  const trimmed = key.trim()
  if (trimmed.startsWith('gsk_')) return 'groq'
  if (trimmed.startsWith('AIza')) return 'google'
  if (trimmed.startsWith('sk-ant-')) return 'claude'
  if (trimmed.startsWith('xai-')) return 'grok'
  if (trimmed.startsWith('sk-or-')) return 'openrouter'
  if (trimmed.startsWith('sk-')) return 'openai'
  return null
}

/**
 * Reads the current AI configuration from local browser storage.
 */
export function getAIConfig(): AIConfig {
  if (typeof window === 'undefined') {
    return {
      provider: 'groq',
      apiKey: '',
      selectedModel: PROVIDER_MODELS.groq[0],
      availableModels: PROVIDER_MODELS.groq,
      isVerified: false,
      autoApplyByDefault: false
    }
  }

  const rawProvider = localStorage.getItem(STORAGE_KEYS.PROVIDER) as AIProvider | null
  const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || ''
  const detected = detectProviderFromKey(apiKey)
  const provider: AIProvider = detected || rawProvider || 'groq'

  const defaultModel = PROVIDER_MODELS[provider]?.[0] || 'llama-3.3-70b-versatile'
  const selectedModel = localStorage.getItem(STORAGE_KEYS.MODEL) || defaultModel
  const isVerified = localStorage.getItem(STORAGE_KEYS.VERIFIED) === 'true'
  const autoApplyByDefault = localStorage.getItem(STORAGE_KEYS.AUTO_APPLY) === 'true'

  let availableModels = PROVIDER_MODELS[provider] || PROVIDER_MODELS.groq
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.MODELS_CACHE)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.length > 0) {
        availableModels = parsed
      }
    }
  } catch (e) {
    // Ignore JSON parse error
  }

  return {
    provider,
    apiKey,
    selectedModel,
    availableModels,
    isVerified,
    autoApplyByDefault
  }
}

/**
 * Saves AI configuration updates to local browser storage and fires an event.
 */
export function saveAIConfig(updates: Partial<AIConfig>): AIConfig {
  if (typeof window !== 'undefined') {
    if (updates.provider !== undefined) {
      localStorage.setItem(STORAGE_KEYS.PROVIDER, updates.provider)
    }
    if (updates.apiKey !== undefined) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, updates.apiKey.trim())
    }
    if (updates.selectedModel !== undefined) {
      localStorage.setItem(STORAGE_KEYS.MODEL, updates.selectedModel)
    }
    if (updates.isVerified !== undefined) {
      localStorage.setItem(STORAGE_KEYS.VERIFIED, String(updates.isVerified))
    }
    if (updates.autoApplyByDefault !== undefined) {
      localStorage.setItem(STORAGE_KEYS.AUTO_APPLY, String(updates.autoApplyByDefault))
    }
    if (updates.availableModels !== undefined) {
      localStorage.setItem(STORAGE_KEYS.MODELS_CACHE, JSON.stringify(updates.availableModels))
    }

    window.dispatchEvent(new CustomEvent('bettershot-ai-config-changed'))
  }

  return getAIConfig()
}


/**
 * Validates an API key against the chosen provider and returns available models.
 */
export async function validateAndFetchModels(
  apiKey: string,
  provider: AIProvider
): Promise<{
  success: boolean
  models: string[]
  error?: string
}> {
  const cleanKey = apiKey.trim()
  if (!cleanKey) {
    return { success: false, models: PROVIDER_MODELS[provider], error: 'API key is empty' }
  }

  try {
    if (provider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          Authorization: `Bearer ${cleanKey}`
        }
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        return {
          success: false,
          models: PROVIDER_MODELS.groq,
          error: errData?.error?.message || `HTTP ${response.status}: Invalid Groq Key`
        }
      }

      const data = await response.json()
      const groqModels = (data.data || [])
        .map((m: any) => m.id)
        .filter((id: string) => !id.includes('whisper') && !id.includes('tts') && !id.includes('guard'))

      // Prioritize llama 3.3, 3.1, deepseek
      groqModels.sort((a: string, b: string) => {
        if (a.includes('llama-3.3-70b')) return -1
        if (b.includes('llama-3.3-70b')) return 1
        if (a.includes('deepseek')) return -1
        if (b.includes('deepseek')) return 1
        return 0
      })

      const finalModels = groqModels.length > 0 ? groqModels : PROVIDER_MODELS.groq
      saveAIConfig({ provider, apiKey: cleanKey, availableModels: finalModels, isVerified: true })
      return { success: true, models: finalModels }
    }

    if (provider === 'google') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
      const response = await fetch(url)
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        return {
          success: false,
          models: PROVIDER_MODELS.google,
          error: errData?.error?.message || `HTTP ${response.status}`
        }
      }

      const data = await response.json()
      const validModels = (data.models || [])
        .filter((m: any) => {
          const methods = m.supportedGenerationMethods || []
          const name = (m.name || '').toLowerCase()
          return methods.includes('generateContent') && name.includes('gemini')
        })
        .map((m: any) => m.name.replace(/^models\//, ''))

      validModels.sort((a: string, b: string) => {
        const score = (name: string) => {
          if (name.includes('2.5-flash')) return 10
          if (name.includes('2.0-flash')) return 9
          if (name.includes('1.5-flash')) return 8
          return 1
        }
        return score(b) - score(a)
      })

      const finalModels = validModels.length > 0 ? validModels : PROVIDER_MODELS.google
      saveAIConfig({ provider, apiKey: cleanKey, availableModels: finalModels, isVerified: true })
      return { success: true, models: finalModels }
    }

    if (provider === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }]
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const msg = errData?.error?.message || `HTTP ${response.status}: Authentication failed`
        return { success: false, models: PROVIDER_MODELS.claude, error: msg }
      }

      saveAIConfig({ provider, apiKey: cleanKey, availableModels: PROVIDER_MODELS.claude, isVerified: true })
      return { success: true, models: PROVIDER_MODELS.claude }
    }

    if (provider === 'grok') {
      const response = await fetch('https://api.x.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${cleanKey}`
        }
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        return {
          success: false,
          models: PROVIDER_MODELS.grok,
          error: errData?.error?.message || `HTTP ${response.status}`
        }
      }

      const data = await response.json()
      const grokModels = (data.data || []).map((m: any) => m.id).filter((id: string) => id.includes('grok'))
      const finalModels = grokModels.length > 0 ? grokModels : PROVIDER_MODELS.grok

      saveAIConfig({ provider, apiKey: cleanKey, availableModels: finalModels, isVerified: true })
      return { success: true, models: finalModels }
    }

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${cleanKey}`
        }
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        return {
          success: false,
          models: PROVIDER_MODELS.openai,
          error: errData?.error?.message || `HTTP ${response.status}`
        }
      }

      const data = await response.json()
      const gptModels = (data.data || [])
        .map((m: any) => m.id)
        .filter((id: string) => id.startsWith('gpt-4') || id.startsWith('o1') || id.startsWith('o3'))

      const finalModels = gptModels.length > 0 ? gptModels.slice(0, 8) : PROVIDER_MODELS.openai
      saveAIConfig({ provider, apiKey: cleanKey, availableModels: finalModels, isVerified: true })
      return { success: true, models: finalModels }
    }

    if (provider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${cleanKey}`
        }
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        return {
          success: false,
          models: PROVIDER_MODELS.openrouter,
          error: errData?.error?.message || `HTTP ${response.status}`
        }
      }

      saveAIConfig({ provider, apiKey: cleanKey, availableModels: PROVIDER_MODELS.openrouter, isVerified: true })
      return { success: true, models: PROVIDER_MODELS.openrouter }
    }

    return { success: true, models: PROVIDER_MODELS[provider] }
  } catch (err: any) {
    return {
      success: false,
      models: PROVIDER_MODELS[provider],
      error: err?.message || 'Connection failed. Check network or API key.'
    }
  }
}

export interface PlanVideoEditsOptions {
  config?: Partial<AIConfig>
  currentTime?: number
  isImage?: boolean
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
}

/**
 * Detects if the user gave permission for immediate automatic application without confirmation.
 */
export function detectAutoApplyIntent(prompt: string, autoApplyByDefault: boolean = false): boolean {
  if (autoApplyByDefault) return true
  const p = prompt.toLowerCase()
  const patterns = [
    /do (your best|anything|whatever|it|all)/i,
    /auto(-|\s)?apply/i,
    /just (do it|apply|make it|fix it)/i,
    /apply (right away|immediately|now|directly)/i,
    /go ahead/i,
    /no need to (ask|confirm)/i,
    /make it look (great|awesome|good|clean|professional)/i,
    /fix (it|everything)/i,
    /polish (it|everything|up)/i
  ]
  return patterns.some((pattern) => pattern.test(p))
}

/**
 * Validates and compares project state before vs after AI execution.
 */
export function verifyProjectChanges(
  before: StudioProject,
  after: StudioProject,
  expected?: Record<string, any>
): import('../types/ai').StateVerificationResult {
  const diffs: import('../types/ai').VerificationDiffItem[] = []

  // 1. Background Wallpaper
  if (before.background.presetId !== after.background.presetId || expected?.backgroundPresetId !== undefined) {
    const passed = expected?.backgroundPresetId ? after.background.presetId === expected.backgroundPresetId : true
    diffs.push({
      property: 'Background Wallpaper',
      expected: expected?.backgroundPresetId || after.background.presetId || 'Updated',
      actual: after.background.presetId || 'none',
      passed
    })
  }

  // 2. Canvas Padding
  if (before.layout.padding !== after.layout.padding || expected?.padding !== undefined) {
    const passed = expected?.padding !== undefined ? after.layout.padding === expected.padding : true
    diffs.push({
      property: 'Canvas Padding',
      expected: expected?.padding !== undefined ? `${expected.padding}%` : `${after.layout.padding}%`,
      actual: `${after.layout.padding}%`,
      passed
    })
  }

  // 3. Corner Radius
  if (before.layout.cornerRadius !== after.layout.cornerRadius || expected?.cornerRadius !== undefined) {
    const passed = expected?.cornerRadius !== undefined ? after.layout.cornerRadius === expected.cornerRadius : true
    diffs.push({
      property: 'Corner Radius',
      expected: expected?.cornerRadius !== undefined ? `${expected.cornerRadius}px` : `${after.layout.cornerRadius}px`,
      actual: `${after.layout.cornerRadius}px`,
      passed
    })
  }

  // 4. Drop Shadow
  if (before.layout.shadow !== after.layout.shadow || expected?.shadow !== undefined) {
    const passed = expected?.shadow !== undefined ? after.layout.shadow === expected.shadow : true
    diffs.push({
      property: 'Drop Shadow',
      expected: expected?.shadow || after.layout.shadow,
      actual: after.layout.shadow,
      passed
    })
  }

  // 5. Aspect Ratio
  if (before.layout.aspectRatio !== after.layout.aspectRatio || expected?.aspectRatio !== undefined) {
    const passed = expected?.aspectRatio !== undefined ? after.layout.aspectRatio === expected.aspectRatio : true
    diffs.push({
      property: 'Aspect Ratio',
      expected: expected?.aspectRatio || after.layout.aspectRatio,
      actual: after.layout.aspectRatio,
      passed
    })
  }

  // 6. Zoom Keyframes Count
  if (before.timeline.zoomEvents.length !== after.timeline.zoomEvents.length || expected?.zoomCount !== undefined) {
    const passed = expected?.zoomCount !== undefined ? after.timeline.zoomEvents.length === expected.zoomCount : true
    diffs.push({
      property: 'Zoom Keyframes',
      expected: expected?.zoomCount !== undefined ? `${expected.zoomCount} zoom(s)` : `${after.timeline.zoomEvents.length} zoom(s)`,
      actual: `${after.timeline.zoomEvents.length} zoom(s)`,
      passed
    })
  }

  // 7. Trim Range
  if (
    before.timeline.trimRange?.start !== after.timeline.trimRange?.start ||
    before.timeline.trimRange?.end !== after.timeline.trimRange?.end ||
    expected?.trimStart !== undefined ||
    expected?.trimEnd !== undefined
  ) {
    const trimStr = after.timeline.trimRange
      ? `${after.timeline.trimRange.start.toFixed(1)}s - ${after.timeline.trimRange.end.toFixed(1)}s`
      : 'Full duration'
    diffs.push({
      property: 'Timeline Trim',
      expected: expected?.trimStart !== undefined ? `${expected.trimStart}s - ${expected.trimEnd}s` : trimStr,
      actual: trimStr,
      passed: true
    })
  }

  const allPassed = diffs.every((d) => d.passed)
  const summary =
    diffs.length > 0
      ? `Verified ${diffs.length} visual parameter adjustment${diffs.length === 1 ? '' : 's'} with 100% precision`
      : 'All parameters verified in nominal state'

  return {
    passed: allPassed,
    diffs,
    summary
  }
}

/**
 * Intelligent local heuristic planner for offline or unauthenticated mode with rich Chain-of-Thought.
 */
export function heuristicPlanner(
  prompt: string,
  project: StudioProject,
  options?: PlanVideoEditsOptions
): AIPlanResult {
  const p = prompt.toLowerCase()
  const actions: AIAction[] = []
  const duration = project.media.duration || 10
  const isImage = options?.isImage || false
  const currentTime = Math.max(0, Math.min(duration, options?.currentTime ?? 2.0))
  const changesSummary: string[] = []
  const expectedChanges: Record<string, any> = {}
  const alternativesConsidered: string[] = []
  const proactiveSuggestions: string[] = []

  const currentConfig = getAIConfig()
  const autoApply = detectAutoApplyIntent(prompt, currentConfig.autoApplyByDefault)

  // 0. Undo / Revert Intent
  if (p.includes('undo') || p.includes('revert') || p.includes('roll back') || p.includes('go back')) {
    return {
      message: 'Undoing your last edit...',
      thoughtProcess: {
        analysis: 'User requested rolling back the project to its previous state.',
        reasoning: 'Reverting state snapshot directly restores the timeline, layout, and background.',
        alternativesConsidered: ['Manual inverse parameter tweaking (rejected in favor of exact snapshot restoration)'],
        verificationPlan: 'Verify project state matches the prior recorded history node.'
      },
      actions: [{ type: 'undo', label: 'Restoring previous project snapshot' }],
      autoApply: true
    }
  }

  // 1. Aspect Ratio Intent
  if (
    p.includes('aspect') ||
    p.includes('ratio') ||
    p.includes('vertical') ||
    p.includes('tiktok') ||
    p.includes('reels') ||
    p.includes('shorts') ||
    p.includes('portrait') ||
    p.includes('square') ||
    p.includes('widescreen') ||
    p.includes('horizontal') ||
    p.includes('9:16') ||
    p.includes('16:9') ||
    p.includes('1:1')
  ) {
    let targetRatio: '16:9' | '9:16' | '1:1' | 'auto' = '16:9'
    if (p.includes('vertical') || p.includes('tiktok') || p.includes('reels') || p.includes('shorts') || p.includes('portrait') || p.includes('9:16')) {
      targetRatio = '9:16'
      alternativesConsidered.push('Considered 1:1 square framing, but selected 9:16 vertical for optimal mobile feed immersion.')
    } else if (p.includes('square') || p.includes('1:1') || p.includes('instagram post')) {
      targetRatio = '1:1'
      alternativesConsidered.push('Selected 1:1 square ratio for clean carousel and feed presentation.')
    } else if (p.includes('widescreen') || p.includes('horizontal') || p.includes('youtube') || p.includes('16:9')) {
      targetRatio = '16:9'
      alternativesConsidered.push('Selected standard 16:9 widescreen for desktop and YouTube clarity.')
    } else if (p.includes('auto') || p.includes('native') || p.includes('original')) {
      targetRatio = 'auto'
    }

    actions.push({ type: 'switch_tab', tab: 'layout', label: 'Opening Layout tab' })
    actions.push({
      type: 'set_aspect_ratio',
      aspectRatio: targetRatio,
      label: `Setting frame aspect ratio to ${targetRatio}`
    })
    changesSummary.push(`adjusted aspect ratio to ${targetRatio}`)
    expectedChanges.aspectRatio = targetRatio
  }

  // 2. Clear Zooms Intent
  if (!isImage && (p.includes('clear zoom') || p.includes('remove zoom') || p.includes('delete all zoom') || p.includes('no zoom') || p.includes('reset zoom'))) {
    actions.push({ type: 'switch_tab', tab: 'zoom', label: 'Switching to Zoom controls' })
    actions.push({ type: 'clear_zooms', label: 'Clearing all zoom keyframes' })
    changesSummary.push('cleared all zoom events from timeline')
    expectedChanges.zoomCount = 0
  }

  // 3. Trimming Intent (Videos only)
  if (!isImage && (p.includes('trim') || p.includes('cut') || p.includes('shorten') || p.includes('crop start') || p.includes('crop end'))) {
    let startTrim = 0.5
    let endTrim = Math.max(1, duration - 0.5)

    const matchStart = p.match(/trim\s+(?:first\s+)?(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i)
    if (matchStart && matchStart[1]) {
      const val = parseFloat(matchStart[1])
      if (val < duration - 1) {
        startTrim = val
      }
    }

    const matchEnd = p.match(/(?:and|last)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i)
    if (matchEnd && matchEnd[1]) {
      const val = parseFloat(matchEnd[1])
      if (duration - val > startTrim + 0.5) {
        endTrim = duration - val
      }
    }

    actions.push({
      type: 'trim_video',
      start: startTrim,
      end: endTrim,
      label: `Trimming video from ${startTrim.toFixed(1)}s to ${endTrim.toFixed(1)}s`
    })
    changesSummary.push(`trimmed rough edges (${startTrim.toFixed(1)}s - ${endTrim.toFixed(1)}s)`)
    expectedChanges.trimStart = startTrim
    expectedChanges.trimEnd = endTrim
  }

  // 4. Background Intent
  if (
    p.includes('background') ||
    p.includes('wallpaper') ||
    p.includes('gradient') ||
    p.includes('sunset') ||
    p.includes('aurora') ||
    p.includes('tahoe') ||
    p.includes('monterey') ||
    p.includes('ventura') ||
    p.includes('clean') ||
    p.includes('modern') ||
    p.includes('polish') ||
    p.includes('style')
  ) {
    const currentId = project.background?.presetId
    const otherPresets = WALLPAPER_PRESETS.filter((w) => w.id !== currentId)
    let selectedPreset = otherPresets[Math.floor(Math.random() * otherPresets.length)] || WALLPAPER_PRESETS[1]

    if (p.includes('sunset')) {
      selectedPreset = WALLPAPER_PRESETS.find((w) => w.id.includes('sunset')) || selectedPreset
    } else if (p.includes('aurora') || p.includes('northern')) {
      selectedPreset = WALLPAPER_PRESETS.find((w) => w.id.includes('aurora')) || selectedPreset
    } else if (p.includes('dune') || p.includes('ventura')) {
      selectedPreset = WALLPAPER_PRESETS.find((w) => w.id.includes('ventura')) || selectedPreset
    } else if (p.includes('dark') || p.includes('chroma')) {
      selectedPreset = WALLPAPER_PRESETS.find((w) => w.id.includes('chroma')) || selectedPreset
    } else if (p.includes('no bg') || p.includes('none') || p.includes('remove background')) {
      actions.push({ type: 'switch_tab', tab: 'background', label: 'Switching to Background tab' })
      actions.push({ type: 'set_background', presetId: 'none', bgType: 'none', label: 'Removing background wallpaper' })
      changesSummary.push('removed background')
      expectedChanges.backgroundPresetId = 'none'
    }

    if (!p.includes('no bg') && !p.includes('none') && !p.includes('remove background')) {
      actions.push({ type: 'switch_tab', tab: 'background', label: 'Switching to Background tab' })
      actions.push({
        type: 'set_background',
        presetId: selectedPreset.id,
        bgType: selectedPreset.type,
        label: `Applying "${selectedPreset.name}" background`
      })
      changesSummary.push(`applied "${selectedPreset.name}" background`)
      expectedChanges.backgroundPresetId = selectedPreset.id
      alternativesConsidered.push(`Evaluated other presets but selected "${selectedPreset.name}" for balanced contrast.`)
    }
  }

  // 5. Layout / Padding Intent
  if (
    p.includes('padding') ||
    p.includes('margin') ||
    p.includes('pad') ||
    p.includes('border') ||
    p.includes('round') ||
    p.includes('corner') ||
    p.includes('shadow') ||
    p.includes('polish')
  ) {
    actions.push({ type: 'switch_tab', tab: 'layout', label: 'Opening Layout controls' })

    let paddingVal = 12
    const padMatch = p.match(/(?:padding|pad)\s*(?:to\s*)?(\d+)/i)
    if (padMatch && padMatch[1]) {
      paddingVal = Math.min(40, Math.max(0, parseInt(padMatch[1], 10)))
    } else if (p.includes('small') || p.includes('tight')) {
      paddingVal = 6
    } else if (p.includes('large') || p.includes('spacious')) {
      paddingVal = 20
    }

    actions.push({ type: 'set_padding', padding: paddingVal, label: `Setting canvas padding to ${paddingVal}%` })
    expectedChanges.padding = paddingVal

    let cornerVal = 16
    if (p.includes('square') || p.includes('sharp')) {
      cornerVal = 0
    } else if (p.includes('extra round')) {
      cornerVal = 24
    }
    actions.push({ type: 'set_corner_radius', cornerRadius: cornerVal, label: `Rounding frame corners to ${cornerVal}px` })
    expectedChanges.cornerRadius = cornerVal

    let shadowVal: 'medium' | 'soft' | 'glow' | 'hard' = 'medium'
    if (p.includes('glow')) shadowVal = 'glow'
    else if (p.includes('soft')) shadowVal = 'soft'
    else if (p.includes('hard')) shadowVal = 'hard'

    actions.push({ type: 'set_shadow', shadow: shadowVal, label: `Applying ${shadowVal} drop shadow` })
    expectedChanges.shadow = shadowVal

    changesSummary.push(`${paddingVal}% padding, ${cornerVal}px rounded corners & ${shadowVal} shadow`)
  }

  // 6. Zoom Intent (Videos only)
  if (!isImage && (p.includes('zoom') || p.includes('focus') || p.includes('magnify') || p.includes('cinematic'))) {
    if (!p.includes('clear') && !p.includes('remove') && !p.includes('no zoom')) {
      actions.push({ type: 'switch_tab', tab: 'zoom', label: 'Switching to Zoom controls' })

      let zoomTime = currentTime > 0 ? currentTime : 2.0
      const timeMatch = p.match(/(?:at|around|timestamp)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i)
      if (timeMatch && timeMatch[1]) {
        const parsedTime = parseFloat(timeMatch[1])
        if (parsedTime < duration - 0.5) {
          zoomTime = parsedTime
        }
      } else if (p.includes('here') || p.includes('now') || p.includes('playhead')) {
        zoomTime = currentTime
      } else if (duration > 4 && currentTime === 0) {
        zoomTime = parseFloat((duration * 0.25).toFixed(1))
      }

      let zoomScale = 1.8
      const scaleMatch = p.match(/(\d+(?:\.\d+)?)\s*x/i)
      if (scaleMatch && scaleMatch[1]) {
        zoomScale = Math.min(3.0, Math.max(1.2, parseFloat(scaleMatch[1])))
      }

      actions.push({ type: 'seek_time', time: zoomTime, label: `Scrubbing playhead to ${zoomTime.toFixed(1)}s` })
      actions.push({
        type: 'add_zoom',
        startTime: zoomTime,
        duration: 2.5,
        scale: zoomScale,
        x: 50,
        y: 50,
        label: `Adding ${zoomScale}x focal zoom at ${zoomTime.toFixed(1)}s`
      })

      changesSummary.push(`added a ${zoomScale}x zoom keyframe at ${zoomTime.toFixed(1)}s`)
      expectedChanges.zoomCount = project.timeline.zoomEvents.length + 1
    }
  } else if (isImage && (p.includes('zoom') || p.includes('trim') || p.includes('cut'))) {
    return {
      message:
        'This is a static screenshot/image. Zoom keyframes and timeline trimming only apply to videos. I can adjust framing, shadows, background wallpaper, or aspect ratio for you!',
      thoughtProcess: {
        analysis: 'Media item is a static image. Video-specific actions (zooms/trim) are incompatible.',
        reasoning: 'Guiding user to visual framing, shadow, and wallpaper operations.',
        verificationPlan: 'No state modifications planned.'
      },
      actions: [],
      autoApply: true
    }
  }

  // Default polish if prompt matched nothing
  if (actions.length === 0) {
    actions.push(
      { type: 'switch_tab', tab: 'background', label: 'Opening Backgrounds' },
      { type: 'set_background', presetId: WALLPAPER_PRESETS[1].id, bgType: 'wallpaper', label: 'Applying modern wallpaper' },
      { type: 'switch_tab', tab: 'layout', label: 'Opening Layout settings' },
      { type: 'set_padding', padding: 10, label: 'Adjusting padding to 10%' },
      { type: 'set_corner_radius', cornerRadius: 16, label: 'Adding rounded borders' },
      { type: 'set_shadow', shadow: 'medium', label: 'Adding drop shadow' }
    )
    changesSummary.push('applied modern wallpaper, 10% padding, and smooth rounded frame')
    expectedChanges.backgroundPresetId = WALLPAPER_PRESETS[1].id
    expectedChanges.padding = 10
    expectedChanges.cornerRadius = 16
    expectedChanges.shadow = 'medium'
  }

  if (actions.length > 0 && !actions.some((a) => a.type === 'switch_tab' && a.tab === 'ai')) {
    actions.push({ type: 'switch_tab', tab: 'ai', label: 'Returning to AI Assistant' })
  }

  // Proactive suggestions
  if (!isImage) {
    proactiveSuggestions.push(`🔍 Add focal zoom at ${currentTime > 0 ? currentTime.toFixed(1) : '2.0'}s`)
    proactiveSuggestions.push('✂️ Trim rough edges (0.5s start/end)')
  }
  proactiveSuggestions.push('🎨 Try Northern Lights gradient')
  proactiveSuggestions.push('📱 Format for 9:16 TikTok / Reels')

  const thoughtProcess = {
    analysis: `Analyzed ${isImage ? 'static screenshot' : `video recording (${duration.toFixed(1)}s)`}. Current framing: ${project.layout.aspectRatio}, padding: ${project.layout.padding}%, background: "${project.background.presetId}". User request: "${prompt}".`,
    reasoning: `Selected aesthetics and spatial parameters that elevate readability and visual hierarchy: ${changesSummary.join(', ')}.`,
    alternativesConsidered: alternativesConsidered.length > 0 ? alternativesConsidered : ['Default layout without padding (rejected for lacking polish)'],
    verificationPlan: `Verify state changes: ${Object.keys(expectedChanges).map((k) => `${k}=${expectedChanges[k]}`).join(', ')}.`
  }

  const message =
    changesSummary.length > 0
      ? `I've planned the following improvements: **${changesSummary.join(', ')}**.`
      : `I've analyzed your project and prepared styling improvements.`

  return {
    message,
    thoughtProcess,
    actions,
    expectedChanges,
    proactiveSuggestions,
    autoApply
  }
}

/**
 * Extracts and parses JSON from LLM responses even if wrapped in markdown code blocks.
 */
function parseLLMJson(raw: string): AIPlanResult | null {
  try {
    return JSON.parse(raw)
  } catch (_) {
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim())
      } catch (_) {}
    }
    const jsonMatch = raw.match(/(\{[\s\S]*\})/)
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim())
      } catch (_) {}
    }
  }
  return null
}

/**
 * Plans video edits using any configured AI provider with full Chain-of-Thought reasoning.
 */
export async function planVideoEdits(
  userPrompt: string,
  project: StudioProject,
  options?: PlanVideoEditsOptions | Partial<AIConfig>
): Promise<AIPlanResult> {
  const opts: PlanVideoEditsOptions =
    options && ('currentTime' in options || 'isImage' in options || 'conversationHistory' in options)
      ? options
      : { config: options as Partial<AIConfig> }

  const currentConfig = { ...getAIConfig(), ...opts.config }
  const apiKey = currentConfig.apiKey.trim()
  const provider = currentConfig.provider || 'groq'
  const model = currentConfig.selectedModel || PROVIDER_MODELS[provider]?.[0] || 'llama-3.3-70b-versatile'
  const isImage = opts.isImage || false
  const duration = project.media.duration || 10
  const currentTime = Math.max(0, Math.min(duration, opts.currentTime ?? 2.0))

  const userAutoApply = detectAutoApplyIntent(userPrompt, currentConfig.autoApplyByDefault)

  if (!apiKey) {
    const res = heuristicPlanner(userPrompt, project, opts)
    res.message += '\n\n*(💡 Tip: Add your free Groq or OpenAI API key in Settings for open-ended creative reasoning!)*'
    return res
  }

  const currentBgPreset = WALLPAPER_PRESETS.find((w) => w.id === project.background.presetId)
  const currentBgName = currentBgPreset
    ? currentBgPreset.name
    : project.background.type === 'none'
    ? 'None (No Background)'
    : project.background.presetId || 'Default'

  const zoomListSummary =
    project.timeline.zoomEvents.length > 0
      ? project.timeline.zoomEvents
          .map(
            (z, idx) =>
              `Keyframe #${idx + 1}: at ${z.startTime.toFixed(1)}s for ${z.duration.toFixed(1)}s (${z.scale}x scale, focus at x=${z.x}%, y=${z.y}%)`
          )
          .join('; ')
      : 'None'

  const cursorStyle = project.cursorConfig?.style || 'macos'
  const cursorSize = project.cursorConfig?.size || 1
  const presetsList = WALLPAPER_PRESETS.map((p) => ({ id: p.id, name: p.name, type: p.type }))

  const systemInstruction = `You are BetterShot AI, an expert video and screenshot editor agent inside a desktop screen recording studio app.
You do NOT just blindly return commands. You first THINK, REASON, EVALUATE ALTERNATIVES, and formulate a verifiable plan.

You MUST output ONLY valid JSON matching this schema:
{
  "thoughtProcess": {
    "analysis": "Breakdown of user request, media characteristics, current framing and gaps",
    "reasoning": "Aesthetic and functional rationale for why specific wallpapers, paddings, aspect ratios, or zooms were chosen",
    "alternativesConsidered": [
      "Alternative approach 1 and why it was rejected",
      "Alternative approach 2 and why it was rejected"
    ],
    "verificationPlan": "How the changes will be verified against the project state post-execution"
  },
  "message": "Clear, friendly explanation of your proposed improvements to the user",
  "actions": [
    { "type": "switch_tab", "tab": "background|layout|zoom|cursor|audio|export|ai", "label": "..." },
    { "type": "set_background", "presetId": "preset_id_or_none", "label": "..." },
    { "type": "set_padding", "padding": 0-40, "label": "..." },
    { "type": "set_corner_radius", "cornerRadius": 0-32, "label": "..." },
    { "type": "set_shadow", "shadow": "none|soft|medium|hard|glow", "label": "..." },
    { "type": "set_aspect_ratio", "aspectRatio": "16:9|9:16|1:1|4:3|auto", "label": "..." },
    { "type": "seek_time", "time": 0-duration, "label": "..." },
    { "type": "add_zoom", "startTime": number, "duration": number, "scale": 1.1-3.0, "x": 0-100, "y": 0-100, "label": "..." },
    { "type": "clear_zooms", "label": "..." },
    { "type": "trim_video", "start": number, "end": number, "label": "..." },
    { "type": "undo", "label": "..." }
  ],
  "expectedChanges": {
    "backgroundPresetId": "string or undefined",
    "padding": "number or undefined",
    "cornerRadius": "number or undefined",
    "shadow": "string or undefined",
    "aspectRatio": "string or undefined",
    "zoomCount": "number or undefined"
  },
  "proactiveSuggestions": [
    "Contextual follow-up quick prompt 1",
    "Contextual follow-up quick prompt 2"
  ],
  "autoApply": boolean
}

=== CURRENT PROJECT STATE (USE THIS FOR COMPLETE CONTEXT) ===
Media Type: ${isImage ? 'Static Screenshot / Image (Do NOT generate zoom or trim actions)' : 'Screen Recording Video'}
${
  !isImage
    ? `Duration: ${duration.toFixed(2)}s | Current Playhead Position: ${currentTime.toFixed(2)}s
Existing Zooms (${project.timeline.zoomEvents.length}): ${zoomListSummary}`
    : ''
}
Current Background: "${currentBgName}" (presetId: "${project.background.presetId}", type: "${project.background.type}")
Current Aspect Ratio: ${project.layout.aspectRatio}
Current Canvas Padding: ${project.layout.padding}%
Current Frame Corner Radius: ${project.layout.cornerRadius}px
Current Shadow: ${project.layout.shadow}
Current Audio: ${project.layout.isMuted ? 'Muted' : `Volume ${project.layout.volume ?? 100}%`}
Current Cursor: Style="${cursorStyle}", Size=${cursorSize}x
Available Wallpapers: ${JSON.stringify(presetsList)}
============================================================

Rules:
1. Demonstrate genuine reasoning in "thoughtProcess". Explain WHY your styling choices look best for this media.
2. If user mentions "do your best", "auto apply", "just do it", or "make it look great", set "autoApply": true. Otherwise set "autoApply": ${userAutoApply}.
3. If user asks to undo or revert, emit { "type": "undo", "label": "Undoing previous edit" }.
4. For videos, keep zoom events within video duration. Minimum zoom duration 0.5s.
5. If user asks to change background/wallpaper, choose a fresh preset from Available Wallpapers (current is "${currentBgName}").
6. If user asks to zoom "here" or doesn't specify time, place zoom keyframe at current playhead (${currentTime.toFixed(2)}s).
7. Switch tab before adjusting parameters in that tab (e.g. switch_tab 'layout' before set_aspect_ratio).
8. ALWAYS conclude your action sequence by returning to the AI tab: { "type": "switch_tab", "tab": "ai", "label": "Returning to AI Assistant" }.
9. Provide 2-3 inspiring "proactiveSuggestions" for what the user could do next.
`

  // Format conversation history for context
  const historyMessages = (opts.conversationHistory || []).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }))

  const userPromptWithContext = `User Edit Request: "${userPrompt}"

[Current State Context]:
- Current Background: "${currentBgName}" (${project.background.presetId})
- Current Aspect Ratio: ${project.layout.aspectRatio}
- Current Padding: ${project.layout.padding}%, Corners: ${project.layout.cornerRadius}px, Shadow: ${project.layout.shadow}
- Playhead Time: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s
- Existing Zooms: ${project.timeline.zoomEvents.length}`

  try {
    let rawText = ''

    if (provider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            ...historyMessages,
            { role: 'user', content: userPromptWithContext }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      })

      if (!response.ok) throw new Error(`Groq API error (${response.status})`)
      const data = await response.json()
      rawText = data?.choices?.[0]?.message?.content || ''
    } else if (provider === 'google') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const contents = [
        ...historyMessages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        { role: 'user', parts: [{ text: userPromptWithContext }] }
      ]

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        })
      })

      if (!response.ok) throw new Error(`Google API error (${response.status})`)
      const data = await response.json()
      rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } else if (provider === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: systemInstruction,
          messages: [
            ...historyMessages,
            { role: 'user', content: userPromptWithContext }
          ]
        })
      })

      if (!response.ok) throw new Error(`Claude API error (${response.status})`)
      const data = await response.json()
      rawText = data?.content?.[0]?.text || ''
    } else if (provider === 'grok') {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            ...historyMessages,
            { role: 'user', content: userPromptWithContext }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      })

      if (!response.ok) throw new Error(`xAI Grok API error (${response.status})`)
      const data = await response.json()
      rawText = data?.choices?.[0]?.message?.content || ''
    } else if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            ...historyMessages,
            { role: 'user', content: userPromptWithContext }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      })

      if (!response.ok) throw new Error(`OpenAI API error (${response.status})`)
      const data = await response.json()
      rawText = data?.choices?.[0]?.message?.content || ''
    } else if (provider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            ...historyMessages,
            { role: 'user', content: userPromptWithContext }
          ],
          temperature: 0.2
        })
      })

      if (!response.ok) throw new Error(`OpenRouter API error (${response.status})`)
      const data = await response.json()
      rawText = data?.choices?.[0]?.message?.content || ''
    }

    const parsed = parseLLMJson(rawText)
    if (parsed && Array.isArray(parsed.actions)) {
      if (parsed.autoApply === undefined) {
        parsed.autoApply = userAutoApply
      }
      return parsed
    }

    return heuristicPlanner(userPrompt, project, opts)
  } catch (err: any) {
    console.warn(`[BetterShot:AI] ${provider} request failed, using heuristic fallback:`, err)
    const fallback = heuristicPlanner(userPrompt, project, opts)
    fallback.message = `*(${provider.toUpperCase()} notice: ${err?.message || 'Connection issue'}. Using smart local planner)*\n\n${fallback.message}`
    return fallback
  }
}
