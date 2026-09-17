import { WallpaperPreset } from '../types/editor'

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'cosmic-cat',
    name: 'Cosmic Ocean',
    type: 'wallpaper',
    thumbnail: 'radial-gradient(circle at center, #1e3a8a 0%, #0f172a 100%)',
    cssValue: 'radial-gradient(circle at 50% 50%, #1d4ed8 0%, #090d16 80%)',
    dark: true
  },
  {
    id: 'aurora-borealis',
    name: 'Northern Lights',
    type: 'gradient',
    thumbnail: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #1e1b4b 100%)',
    cssValue: 'linear-gradient(135deg, #059669 0%, #0d9488 40%, #1e1b4b 100%)',
    dark: true
  },
  {
    id: 'sunset-glow',
    name: 'Sunset Glow',
    type: 'gradient',
    thumbnail: 'linear-gradient(135deg, #f43f5e 0%, #8b5cf6 50%, #0f172a 100%)',
    cssValue: 'linear-gradient(135deg, #f43f5e 0%, #8b5cf6 50%, #0f172a 100%)',
    dark: true
  },
  {
    id: 'deep-space',
    name: 'Deep Space Nebula',
    type: 'wallpaper',
    thumbnail: 'radial-gradient(circle at top right, #6366f1 0%, #1e1b4b 60%, #020617 100%)',
    cssValue: 'radial-gradient(circle at top right, #6366f1 0%, #1e1b4b 50%, #020617 100%)',
    dark: true
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    type: 'gradient',
    thumbnail: 'linear-gradient(135deg, #a5b4fc 0%, #f472b6 50%, #38bdf8 100%)',
    cssValue: 'linear-gradient(135deg, #a5b4fc 0%, #f472b6 50%, #38bdf8 100%)',
    dark: false
  },
  {
    id: 'minimal-dark',
    name: 'Studio Dark',
    type: 'color',
    thumbnail: '#12151c',
    cssValue: '#12151c',
    dark: true
  },
  {
    id: 'slate-mesh',
    name: 'Slate Mesh',
    type: 'gradient',
    thumbnail: 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)',
    cssValue: 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)',
    dark: true
  },
  {
    id: 'emerald-abyss',
    name: 'Emerald Abyss',
    type: 'gradient',
    thumbnail: 'linear-gradient(135deg, #064e3b 0%, #022c22 50%, #0f172a 100%)',
    cssValue: 'linear-gradient(135deg, #064e3b 0%, #022c22 50%, #0f172a 100%)',
    dark: true
  }
]
