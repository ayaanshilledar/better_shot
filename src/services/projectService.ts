import { StudioProject } from '../types/editor'
import { WALLPAPER_PRESETS } from '../config/presets'
import { DEFAULT_CURSOR_CONFIG, CursorTelemetryData } from '../types/cursor'

export const createDefaultProject = (sourcePath: string, fileName: string): StudioProject => {
  const defaultPreset = WALLPAPER_PRESETS[0]
  const id = `project_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const isImage = /\.(png|jpe?g|webp|bmp|gif)$/i.test(fileName) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(sourcePath)

  return {
    id,
    title: fileName.replace(/\.[^/.]+$/, ''),
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    media: {
      sourcePath,
      fileName,
      duration: isImage ? 1 : 0,
      width: 1920,
      height: 1080,
      mediaType: isImage ? 'image' : 'video'
    },
    background: {
      type: 'wallpaper',
      presetId: defaultPreset.id,
      gradient: defaultPreset.cssValue,
      customImageUrl: defaultPreset.url || '',
      color: '#101216',
      blurAmount: 0
    },
    layout: {
      padding: isImage ? 8 : 5, // 8% default padding for screenshot to highlight wallpaper
      cornerRadius: isImage ? 16 : 12, // 16px smooth rounded corners for screenshot
      shadow: 'medium',
      aspectRatio: 'auto',
      borderWidth: 1, // 1px clean subtle border
      borderOpacity: 25, // 25% glassy opacity
      x: 0,
      y: 0,
      scale: 1,
      volume: 100,
      isMuted: false
    },
    timeline: {
      clips: []
    },
    cursorConfig: { ...DEFAULT_CURSOR_CONFIG },
    exportSettings: {
      format: isImage ? 'png' : 'mp4',
      resolution: '1080p',
      fps: 60,
      bitratePreset: 'high',
      customBitrateMbps: 12,
      includeAudio: !isImage,
      audioBitrateKbps: 192
    }
  }
}

/**
 * Attempts to load cursor telemetry data from the sidecar .cursor.json file via Electron IPC.
 */
export const loadCursorTelemetryForVideo = async (videoPath: string): Promise<CursorTelemetryData | null> => {
  if (typeof window === 'undefined' || !(window as any).electronAPI?.loadCursorTelemetry) {
    return null
  }
  try {
    const data = await (window as any).electronAPI.loadCursorTelemetry(videoPath)
    if (data && Array.isArray(data.samples)) {
      console.log(`[Velo:ProjectService] Loaded cursor telemetry for ${videoPath} (${data.samples.length} samples, ${data.clicks?.length || 0} clicks)`)
      return data
    }
  } catch (err) {
    console.warn('[Velo:ProjectService] Could not load cursor telemetry:', err)
  }
  return null
}

