export type ZoomEasingType = 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear' | 'elastic'
export type ZoomType = 'manual' | 'auto'

export interface ZoomEvent {
  id: string
  startTime: number
  duration: number
  easeInDuration?: number // duration in sec to ease in (default 0.4s)
  easeOutDuration?: number // duration in sec to ease out (default 0.4s)
  x: number // percentage 0-100
  y: number // percentage 0-100
  scale: number // e.g. 1.25, 2.0, 3.0
  easing: ZoomEasingType
  type?: ZoomType
  label?: string
}

export interface ClipSegment {
  id: string
  startTime: number
  endTime: number
  speed: number
}

export type BackgroundType = 'desktop' | 'wallpaper' | 'image' | 'color' | 'gradient' | 'animated' | 'none'
export type ShadowType = 'none' | 'soft' | 'medium' | 'hard' | 'glow'
export type AspectRatioType = 'auto' | '16:9' | '9:16' | '1:1' | '4:3' | '21:9'

export interface BackgroundConfig {
  type: BackgroundType
  presetId: string
  customImageUrl?: string
  color: string
  gradient: string
  blurAmount: number // 0 to 100%
}

export interface CropRegionData {
  x: number
  y: number
  width: number
  height: number
  aspectRatio: string
}

export interface LayoutConfig {
  padding: number // 0% to 50%
  cornerRadius: number // 0px to 48px
  shadow: ShadowType
  aspectRatio: AspectRatioType
  borderWidth?: number // 0px to 10px
  borderOpacity?: number // 0% to 100%
  cropRegion?: CropRegionData
  x?: number
  y?: number
  width?: number
  height?: number
  scale?: number
  volume?: number // 0 to 100
  isMuted?: boolean
}

export type ExportResolution = 'original' | '4k' | '2k' | '1080p' | '720p'
export type ExportFps = 60 | 30 | 24
export type ExportBitratePreset = 'ultra' | 'high' | 'standard' | 'economy' | 'custom'
export type ExportFormat = 'mp4' | 'webm'

export interface ExportSettings {
  format: ExportFormat
  resolution: ExportResolution
  fps: ExportFps
  bitratePreset: ExportBitratePreset
  customBitrateMbps?: number
  includeAudio: boolean
  audioBitrateKbps: 128 | 192 | 256 | 320
  saveLocation?: string
}

export interface ExportProgress {
  progress: number // 0 to 100
  currentTime: number
  totalDuration: number
  fps: number
  etaSeconds: number
  phase: 'preparing' | 'rendering' | 'encoding' | 'saving' | 'completed' | 'error' | 'cancelled'
  error?: string
  filePath?: string
  fileSize?: number
}

import { CursorConfig, CursorTelemetryData } from './cursor'

export interface StudioProject {
  id: string
  title: string
  version: number
  createdAt: number
  updatedAt: number
  media: {
    sourcePath: string
    fileName: string
    duration: number
    width: number
    height: number
  }
  background: BackgroundConfig
  layout: LayoutConfig
  timeline: {
    clips: ClipSegment[]
    zoomEvents: ZoomEvent[]
  }
  cursorConfig?: CursorConfig
  cursorData?: CursorTelemetryData
  exportSettings: ExportSettings
}

export type EditorStatus = 'loading' | 'ready' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface StudioRuntimeState {
  status: EditorStatus
  errorMessage?: string
  currentTime: number
  isPlaying: boolean
  selectedTab: 'background' | 'layout' | 'zoom' | 'cursor' | 'audio' | 'export'
  selectedClipId: string | null
  selectedZoomId?: string | null
  activeZoomMode?: 'manual' | 'auto'
  previewScale: 'full' | 'half' | 'quarter'
  timelineZoom?: number
  hoverState: { element: string | null }
  isVideoSelected?: boolean
}

export interface WallpaperPreset {
  id: string
  name: string
  type: 'wallpaper' | 'gradient' | 'color'
  thumbnail: string
  cssValue: string
  url?: string
  dark?: boolean
}
