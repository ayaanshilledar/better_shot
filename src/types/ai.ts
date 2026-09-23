import { ShadowType, StudioProject } from './editor'

export type AIActionType =
  | 'switch_tab'
  | 'set_background'
  | 'set_padding'
  | 'set_corner_radius'
  | 'set_shadow'
  | 'set_aspect_ratio'
  | 'trim_video'
  | 'seek_time'
  | 'undo'

export interface SwitchTabAction {
  type: 'switch_tab'
  tab: 'background' | 'layout' | 'cursor' | 'audio' | 'ai' | 'export'
  label: string
}

export interface SetBackgroundAction {
  type: 'set_background'
  presetId: string
  bgType?: 'wallpaper' | 'gradient' | 'none' | 'color'
  label: string
}

export interface SetPaddingAction {
  type: 'set_padding'
  padding: number
  label: string
}

export interface SetCornerRadiusAction {
  type: 'set_corner_radius'
  cornerRadius: number
  label: string
}

export interface SetShadowAction {
  type: 'set_shadow'
  shadow: ShadowType
  label: string
}

export interface SetAspectRatioAction {
  type: 'set_aspect_ratio'
  aspectRatio: 'auto' | '16:9' | '9:16' | '1:1' | '4:3' | '21:9'
  label: string
}

export interface TrimVideoAction {
  type: 'trim_video'
  start: number
  end: number
  label: string
}

export interface SeekTimeAction {
  type: 'seek_time'
  time: number
  label: string
}

export interface UndoAction {
  type: 'undo'
  label: string
}

export type AIAction =
  | SwitchTabAction
  | SetBackgroundAction
  | SetPaddingAction
  | SetCornerRadiusAction
  | SetShadowAction
  | SetAspectRatioAction
  | TrimVideoAction
  | SeekTimeAction
  | UndoAction

export interface ThoughtProcess {
  analysis: string
  reasoning: string
  alternativesConsidered?: string[]
  verificationPlan?: string
}

export interface VerificationDiffItem {
  property: string
  expected: string
  actual: string
  passed: boolean
}

export interface StateVerificationResult {
  passed: boolean
  diffs: VerificationDiffItem[]
  summary: string
}

export interface AIChatMessage {
  id: string
  sender: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  actions?: AIAction[]
  thoughtProcess?: ThoughtProcess
  status?: 'thinking' | 'awaiting_confirmation' | 'executing' | 'verifying' | 'completed' | 'failed'
  activeActionIndex?: number
  verification?: StateVerificationResult
  suggestions?: string[]
  error?: string
}

export type AIProvider = 'groq' | 'google' | 'claude' | 'grok' | 'openai' | 'openrouter'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  selectedModel: string
  availableModels: string[]
  isVerified: boolean
  lastChecked?: number
  customBaseUrl?: string
  autoApplyByDefault?: boolean
}

export interface AICursorTarget {
  x: number
  y: number
  width?: number
  height?: number
  label: string
  isClicking?: boolean
  selector?: string
}

export interface AIPlanResult {
  message: string
  thoughtProcess?: ThoughtProcess
  actions: AIAction[]
  expectedChanges?: Record<string, any>
  proactiveSuggestions?: string[]
  autoApply?: boolean
}
