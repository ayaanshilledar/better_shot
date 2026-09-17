import { WallpaperPreset } from '../types/editor'

import macAsset3 from '../public/wallpaper/mac-asset-3.jpg'
import macAsset5 from '../public/wallpaper/mac-asset-5.jpg'
import macAsset6 from '../public/wallpaper/mac-asset-6.jpeg'
import macAsset8 from '../public/wallpaper/mac-asset-8.jpg'
import macAsset9 from '../public/wallpaper/mac-asset-9.jpg'
import macAsset10 from '../public/wallpaper/mac-asset-10.jpg'

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'mac-tahoe-blue',
    name: 'Tahoe Blue',
    type: 'wallpaper',
    thumbnail: `url(${macAsset10}) center/cover no-repeat`,
    cssValue: `url(${macAsset10}) center/cover no-repeat`,
    url: macAsset10,
    dark: true
  },
  {
    id: 'mac-monterey-waves',
    name: 'Monterey Waves',
    type: 'wallpaper',
    thumbnail: `url(${macAsset6}) center/cover no-repeat`,
    cssValue: `url(${macAsset6}) center/cover no-repeat`,
    url: macAsset6,
    dark: true
  },
  {
    id: 'mac-sunset-flow',
    name: 'Sunset Flow',
    type: 'wallpaper',
    thumbnail: `url(${macAsset3}) center/cover no-repeat`,
    cssValue: `url(${macAsset3}) center/cover no-repeat`,
    url: macAsset3,
    dark: true
  },
  {
    id: 'mac-ventura-dunes',
    name: 'Ventura Dunes',
    type: 'wallpaper',
    thumbnail: `url(${macAsset5}) center/cover no-repeat`,
    cssValue: `url(${macAsset5}) center/cover no-repeat`,
    url: macAsset5,
    dark: true
  },
  {
    id: 'mac-chroma-dark',
    name: 'Chroma Dark',
    type: 'wallpaper',
    thumbnail: `url(${macAsset8}) center/cover no-repeat`,
    cssValue: `url(${macAsset8}) center/cover no-repeat`,
    url: macAsset8,
    dark: true
  },
  {
    id: 'mac-horizon-drift',
    name: 'Horizon Drift',
    type: 'wallpaper',
    thumbnail: `url(${macAsset9}) center/cover no-repeat`,
    cssValue: `url(${macAsset9}) center/cover no-repeat`,
    url: macAsset9,
    dark: false
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
  }
]
