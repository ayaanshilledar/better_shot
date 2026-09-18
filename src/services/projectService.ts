import { StudioProject } from '../types/editor'
import { WALLPAPER_PRESETS } from '../config/presets'
import { DEFAULT_CURSOR_CONFIG, CursorTelemetryData } from '../types/cursor'

export const createDefaultProject = (sourcePath: string, fileName: string): StudioProject => {
  const defaultPreset = WALLPAPER_PRESETS[0]
  const id = `project_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  return {
    id,
    title: fileName.replace(/\.[^/.]+$/, ''),
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    media: {
      sourcePath,
      fileName,
      duration: 0,
      width: 1920,
      height: 1080
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
      padding: 5, // 5% default padding
      cornerRadius: 12, // 12px rounded corners
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
      clips: [],
      zoomEvents: []
    },
    cursorConfig: { ...DEFAULT_CURSOR_CONFIG },
    exportSettings: {
      format: 'mp4',
      resolution: '1080p',
      fps: 60,
      bitratePreset: 'high',
      customBitrateMbps: 12,
      includeAudio: true,
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
      console.log(`[BetterShot:ProjectService] Loaded cursor telemetry for ${videoPath} (${data.samples.length} samples, ${data.clicks?.length || 0} clicks)`)
      return data
    }
  } catch (err) {
    console.warn('[BetterShot:ProjectService] Could not load cursor telemetry:', err)
  }
  return null
}

