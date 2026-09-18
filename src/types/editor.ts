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
  cropRegion?: CropRegionData
  x?: number
  y?: number
  width?: number
  height?: number
  scale?: number
  volume?: number // 0 to 100
  isMuted?: boolean
}

export interface ExportSettings {
  format: 'mp4' | 'webm'
  resolution: 'original' | '1080p' | '4k'
  fps: number
}

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
  exportSettings: ExportSettings
}

export type EditorStatus = 'loading' | 'ready' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface StudioRuntimeState {
  status: EditorStatus
  errorMessage?: string
  currentTime: number
  isPlaying: boolean
  selectedTab: 'background' | 'layout' | 'zoom' | 'audio' | 'export'
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
