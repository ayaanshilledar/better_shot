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

import { CursorTelemetryData, CursorClickEvent } from '../types/cursor'

/**
 * Clamps focal coordinates so the zoomed viewport does not reveal out-of-bounds space.
 */
export const clampFocalCoordinates = (x: number, y: number, scale: number): { x: number; y: number } => {
  if (scale <= 1.01) {
    return { x: 50, y: 50 }
  }
  const halfSpan = 50 / scale
  const minX = halfSpan
  const maxX = 100 - halfSpan
  const minY = halfSpan
  const maxY = 100 - halfSpan

  return {
    x: parseFloat(Math.max(minX, Math.min(maxX, x)).toFixed(1)),
    y: parseFloat(Math.max(minY, Math.min(maxY, y)).toFixed(1))
  }
}

/**
 * Generates intelligent auto-zoom keyframes driven by real cursor clicks and dwell positions.
 */
export const generateAutoZoomsFromCursor = (
  totalDuration: number,
  cursorData?: CursorTelemetryData,
  options: AutoZoomOptions = {}
): ZoomEvent[] => {
  if (!Number.isFinite(totalDuration) || totalDuration < 2.0) {
    return []
  }

  // If no cursor telemetry or no click events, fallback to smart preset generation
  if (!cursorData || !cursorData.clicks || cursorData.clicks.length === 0) {
    return generateAutoZooms(totalDuration, options)
  }

  const density = options.density || 'balanced'
  const maxScale = options.maxScale || 1.75
  const easeSpeed = options.easeSpeed || 0.4

  let minClusterGap = 3.5 // min seconds between separate zoom events
  let defaultZoomDuration = 2.4

  if (density === 'subtle') {
    minClusterGap = 5.5
    defaultZoomDuration = 2.8
  } else if (density === 'dynamic') {
    minClusterGap = 2.2
    defaultZoomDuration = 1.8
  }

  // 1. Group rapid clicks into clusters
  const clicks = [...cursorData.clicks].sort((a, b) => a.t - b.t)
  const clusters: { startTime: number; clicks: CursorClickEvent[] }[] = []

  for (const click of clicks) {
    const clickSec = click.t / 1000
    if (clickSec >= totalDuration - 0.5) continue

    const lastCluster = clusters[clusters.length - 1]
    if (lastCluster && clickSec - lastCluster.startTime < minClusterGap) {
      lastCluster.clicks.push(click)
    } else {
      clusters.push({
        startTime: clickSec,
        clicks: [click]
      })
    }
  }

  // 2. Turn clusters into ZoomEvents
  const events: ZoomEvent[] = []

  clusters.forEach((cluster, idx) => {
    // Average coordinate of clicks in this cluster
    const avgX = (cluster.clicks.reduce((sum, c) => sum + c.x, 0) / cluster.clicks.length) * 100
    const avgY = (cluster.clicks.reduce((sum, c) => sum + c.y, 0) / cluster.clicks.length) * 100

    // Scale dynamically between 1.35 and maxScale
    const scale = Math.min(maxScale, 1.4 + (cluster.clicks.length > 1 ? 0.25 : 0))
    const clamped = clampFocalCoordinates(avgX, avgY, scale)

    // Zoom lead-in: start 0.25s before click
    const startTime = Math.max(0.2, cluster.startTime - 0.25)
    const duration = Math.min(defaultZoomDuration, totalDuration - startTime - 0.2)

    if (duration > 0.8) {
      events.push({
        id: `cursor_zoom_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        startTime: parseFloat(startTime.toFixed(2)),
        duration: parseFloat(duration.toFixed(2)),
        easeInDuration: easeSpeed,
        easeOutDuration: easeSpeed,
        x: clamped.x,
        y: clamped.y,
        scale: parseFloat(scale.toFixed(2)),
        easing: 'ease-in-out',
        type: 'auto',
        label: `Click Focus #${idx + 1} (${Math.round(clamped.x)}%, ${Math.round(clamped.y)}%)`
      })
    }
  })

  // If no clusters generated (clicks occurred at start/end), fallback
  if (events.length === 0) {
    return generateAutoZooms(totalDuration, options)
  }

  return events
}

/**
 * Smart Auto-Zoom Generator Algorithm using presets.
 * Creates intelligent auto zoom events across video duration when no clicks exist.
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


