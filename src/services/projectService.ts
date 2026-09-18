import { StudioProject } from '../types/editor'
import { WALLPAPER_PRESETS } from '../config/presets'

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
