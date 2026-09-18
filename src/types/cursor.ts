export interface CursorSample {
  t: number // timestamp in ms relative to recording start
  x: number // normalized 0.0 to 1.0
  y: number // normalized 0.0 to 1.0
  visible: boolean
}

export interface CursorClickEvent {
  id: string
  t: number // timestamp in ms relative to recording start
  x: number // normalized 0.0 to 1.0
  y: number // normalized 0.0 to 1.0
  button: 'left' | 'right' | 'middle'
  type: 'click' | 'double_click'
}

export interface CursorTelemetryData {
  version: 1
  recordedAt: number
  duration: number
  sourceBounds: {
    x: number
    y: number
    width: number
    height: number
  }
  samples: CursorSample[]
  clicks: CursorClickEvent[]
}

export type CursorStyleType = 'original' | 'macos-arrow' | 'dot' | 'spotlight' | 'halo'
export type ClickSoundType = 'mac' | 'tap' | 'bubble' | 'mechanical'

export interface CursorSoundConfig {
  enabled: boolean
  soundType: ClickSoundType
  volume: number // 0 to 100
}

export interface CursorConfig {
  enabled: boolean
  style: CursorStyleType
  size: number // 16 to 64px (default ~28)
  color: string // accent color for dot, halo, or spotlight
  haloBlur: number // 5 to 40
  haloOpacity: number // 10 to 100
  showClickRipple: boolean
  rippleColor: string
  sound: CursorSoundConfig
}

export const DEFAULT_CURSOR_CONFIG: CursorConfig = {
  enabled: true,
  style: 'macos-arrow',
  size: 28,
  color: '#3b82f6',
  haloBlur: 16,
  haloOpacity: 45,
  showClickRipple: true,
  rippleColor: '#3b82f6',
  sound: {
    enabled: true,
    soundType: 'mac',
    volume: 75
  }
}
