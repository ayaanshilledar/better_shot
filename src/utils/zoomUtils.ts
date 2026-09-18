import { ZoomEvent, ZoomEasingType } from '../types/editor'

export interface AutoZoomOptions {
  density?: 'subtle' | 'balanced' | 'dynamic'
  maxScale?: number // e.g. 1.5 to 2.5
  easeSpeed?: number // duration of ease in/out in sec (e.g. 0.3 or 0.5)
}

/**
 * Applies easing curve mathematics to a normalized 0-1 progress input.
 */
export const applyEasing = (t: number, easing: ZoomEasingType): number => {
  const clamped = Math.max(0, Math.min(1, t))
  switch (easing) {
    case 'ease-in-out':
      // Smooth cubic ease-in-out
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2

    case 'ease-in':
      // Smooth cubic acceleration
      return clamped * clamped * clamped

    case 'ease-out':
      // Smooth cubic deceleration (landing)
      return 1 - Math.pow(1 - clamped, 3)

    case 'elastic': {
      // Elastic spring effect
      if (clamped === 0) return 0
      if (clamped === 1) return 1
      const p = 0.3
      return Math.pow(2, -10 * clamped) * Math.sin(((clamped - p / 4) * (2 * Math.PI)) / p) + 1
    }

    case 'linear':
    default:
      return clamped
  }
}

export interface ActiveZoomResult {
  scale: number
  x: number // 0-100%
  y: number // 0-100%
  activeEventId: string | null
  isTransitioning: boolean
}

/**
 * Computes active zoom scale and origin focal point (x, y) with smooth easing at `currentTime`.
 */
export const calculateActiveZoom = (
  zoomEvents: ZoomEvent[],
  currentTime: number
): ActiveZoomResult => {
  if (!zoomEvents || zoomEvents.length === 0) {
    return { scale: 1.0, x: 50, y: 50, activeEventId: null, isTransitioning: false }
  }

  // Sort events by startTime
  const sorted = [...zoomEvents].sort((a, b) => a.startTime - b.startTime)

  // Find active event at currentTime
  const activeEvent = sorted.find(
    (z) => currentTime >= z.startTime && currentTime <= z.startTime + z.duration
  )

  if (!activeEvent) {
    return { scale: 1.0, x: 50, y: 50, activeEventId: null, isTransitioning: false }
  }

  const easeIn = Math.max(0.05, Math.min(activeEvent.duration / 2, activeEvent.easeInDuration ?? 0.4))
  const easeOut = Math.max(0.05, Math.min(activeEvent.duration / 2, activeEvent.easeOutDuration ?? 0.4))

  const elapsed = currentTime - activeEvent.startTime
  const remaining = activeEvent.startTime + activeEvent.duration - currentTime

  const targetScale = activeEvent.scale
  const targetX = activeEvent.x
  const targetY = activeEvent.y

  let scale = targetScale
  let isTransitioning = false

  // Ease-In phase: smooth ramp up from 1.0x to targetScale around fixed target (x, y)
  if (elapsed < easeIn) {
    isTransitioning = true
    const progress = elapsed / easeIn
    const eased = applyEasing(progress, activeEvent.easing)
    scale = 1.0 + (targetScale - 1.0) * eased
  }
  // Ease-Out phase: smooth ramp down from targetScale back to 1.0x around fixed target (x, y)
  else if (remaining < easeOut) {
    isTransitioning = true
    const progress = (easeOut - remaining) / easeOut
    const eased = applyEasing(progress, activeEvent.easing)
    scale = targetScale - (targetScale - 1.0) * eased
  }

  return {
    scale: Math.max(1.0, scale),
    x: Math.max(0, Math.min(100, targetX)),
    y: Math.max(0, Math.min(100, targetY)),
    activeEventId: activeEvent.id,
    isTransitioning
  }
}

/**
 * Smart Auto-Zoom Generator Algorithm.
 * Creates intelligent auto zoom events across video duration.
 */
export const generateAutoZooms = (
  totalDuration: number,
  options: AutoZoomOptions = {}
): ZoomEvent[] => {
  if (!Number.isFinite(totalDuration) || totalDuration < 2.0) {
    return []
  }

  const density = options.density || 'balanced'
  const maxScale = options.maxScale || 1.6
  const easeSpeed = options.easeSpeed || 0.4

  let intervalSec = 4.0
  let zoomDuration = 2.0

  if (density === 'subtle') {
    intervalSec = 6.0
    zoomDuration = 2.5
  } else if (density === 'dynamic') {
    intervalSec = 3.0
    zoomDuration = 1.6
  }

  const focalPresets = [
    { x: 35, y: 35, label: 'Top-Left Focus' },
    { x: 65, y: 35, label: 'Top-Right Focus' },
    { x: 50, y: 50, label: 'Center Focus' },
    { x: 40, y: 65, label: 'Bottom-Left Focus' },
    { x: 60, y: 65, label: 'Bottom-Right Focus' }
  ]

  const newEvents: ZoomEvent[] = []
  let currentTime = 1.0
  let presetIdx = 0

  while (currentTime + zoomDuration < totalDuration - 0.5) {
    const focal = focalPresets[presetIdx % focalPresets.length]
    const scaleFactor = Math.min(maxScale, 1.25 + (presetIdx % 3) * 0.15)

    newEvents.push({
      id: `auto_zoom_${Date.now()}_${presetIdx}_${Math.random().toString(36).substring(2, 6)}`,
      startTime: parseFloat(currentTime.toFixed(2)),
      duration: zoomDuration,
      easeInDuration: easeSpeed,
      easeOutDuration: easeSpeed,
      x: focal.x,
      y: focal.y,
      scale: parseFloat(scaleFactor.toFixed(2)),
      easing: 'ease-in-out',
      type: 'auto',
      label: `Auto Zoom #${presetIdx + 1}: ${focal.label}`
    })

    currentTime += zoomDuration + intervalSec
    presetIdx++
  }

  return newEvents
}
