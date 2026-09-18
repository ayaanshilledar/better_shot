import { CursorTelemetryData, CursorConfig, CursorSample, CursorClickEvent } from '../types/cursor'

export interface InterpolatedCursor {
  x: number // normalized 0.0 to 1.0
  y: number // normalized 0.0 to 1.0
  visible: boolean
}

/**
 * Interpolates cursor position at the given video playback time (in seconds).
 */
export const getInterpolatedCursorPosition = (
  cursorData: CursorTelemetryData | undefined,
  timeSeconds: number
): InterpolatedCursor | null => {
  if (!cursorData || !cursorData.samples || cursorData.samples.length === 0) {
    return null
  }

  const timeMs = timeSeconds * 1000
  const samples = cursorData.samples

  // If before first sample
  if (timeMs <= samples[0].t) {
    return { x: samples[0].x, y: samples[0].y, visible: samples[0].visible }
  }

  // If after last sample
  const last = samples[samples.length - 1]
  if (timeMs >= last.t) {
    return { x: last.x, y: last.y, visible: last.visible }
  }

  // Binary search for surrounding samples
  let low = 0
  let high = samples.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (samples[mid].t <= timeMs) {
      if (mid + 1 < samples.length && samples[mid + 1].t > timeMs) {
        // Interpolate between mid and mid + 1
        const s0 = samples[mid]
        const s1 = samples[mid + 1]
        const factor = (timeMs - s0.t) / (s1.t - s0.t)

        return {
          x: s0.x + (s1.x - s0.x) * factor,
          y: s0.y + (s1.y - s0.y) * factor,
          visible: s0.visible || s1.visible
        }
      }
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return { x: samples[low].x, y: samples[low].y, visible: samples[low].visible }
}

/**
 * Draws the active cursor style and click ripple effects on a Canvas 2D context.
 */
export const renderCursorOnCanvas = (
  ctx: CanvasRenderingContext2D,
  cursor: InterpolatedCursor,
  cursorData: CursorTelemetryData | undefined,
  config: CursorConfig,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  timeSeconds: number,
  scaleRef: number = 1.0
) => {
  if (!config.enabled || !cursor.visible) return

  // Calculate pixel position on the canvas frame
  const cx = frameX + cursor.x * frameW
  const cy = frameY + cursor.y * frameH
  const size = Math.round(config.size * scaleRef)

  // 1. Draw Click Ripples if enabled
  if (config.showClickRipple && cursorData?.clicks) {
    const currentMs = timeSeconds * 1000
    const rippleDuration = 400 // ms

    for (const click of cursorData.clicks) {
      const elapsed = currentMs - click.t
      if (elapsed >= 0 && elapsed <= rippleDuration) {
        const progress = elapsed / rippleDuration
        const easeOut = 1 - Math.pow(1 - progress, 3)
        const radius = Math.round((8 + 36 * easeOut) * scaleRef)
        const alpha = Math.max(0, (1 - easeOut) * 0.75)

        const clickX = frameX + click.x * frameW
        const clickY = frameY + click.y * frameH

        ctx.save()
        ctx.beginPath()
        ctx.arc(clickX, clickY, radius, 0, Math.PI * 2)
        ctx.strokeStyle = config.rippleColor || '#3b82f6'
        ctx.globalAlpha = alpha
        ctx.lineWidth = Math.max(1.5, 2.5 * (1 - easeOut) * scaleRef)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  // 2. Draw Cursor Effect / Pointer Replacement
  ctx.save()

  switch (config.style) {
    case 'halo': {
      // Glowing halo ring around the cursor coordinate
      const haloRadius = Math.round(size * 0.7)
      const blur = Math.round((config.haloBlur || 16) * scaleRef)
      const opacity = (config.haloOpacity || 50) / 100

      ctx.save()
      ctx.shadowColor = config.color || '#3b82f6'
      ctx.shadowBlur = blur
      ctx.beginPath()
      ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2)
      ctx.fillStyle = config.color || '#3b82f6'
      ctx.globalAlpha = opacity * 0.4
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx, cy, haloRadius * 0.5, 0, Math.PI * 2)
      ctx.globalAlpha = opacity * 0.8
      ctx.fill()
      ctx.restore()
      break
    }

    case 'spotlight': {
      // Soft radial spotlight focusing on the cursor
      const spotRadius = Math.round(size * 1.6)
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, spotRadius)
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)')
      grad.addColorStop(0.4, 'rgba(59, 130, 246, 0.25)')
      grad.addColorStop(1, 'rgba(59, 130, 246, 0)')

      ctx.beginPath()
      ctx.arc(cx, cy, spotRadius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      break
    }

    case 'dot': {
      // Sleek modern accent dot
      const dotRadius = Math.round(size * 0.25)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 4 * scaleRef
      ctx.beginPath()
      ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = config.color || '#3b82f6'
      ctx.fill()
      ctx.lineWidth = Math.max(1.5, 2 * scaleRef)
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      break
    }

    case 'macos-arrow': {
      // Crisp macOS styled arrow cursor that cleanly replaces the underlying pointer
      const s = size / 24 // Base SVG viewBox is 24x24
      ctx.translate(cx, cy)
      ctx.scale(s, s)

      // Drop shadow for pointer
      ctx.shadowColor = 'rgba(0, 0, 0, 0.38)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 2

      // Draw macOS cursor path
      // Exact vector path for macOS mouse arrow
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, 20)
      ctx.lineTo(4.8, 15.6)
      ctx.lineTo(8.8, 24)
      ctx.lineTo(12.4, 22.4)
      ctx.lineTo(8.4, 14)
      ctx.lineTo(15.2, 14)
      ctx.closePath()

      // Fill with solid black body
      ctx.fillStyle = '#000000'
      ctx.fill()

      // Outer crisp white border stroke
      ctx.shadowColor = 'transparent'
      ctx.lineWidth = 1.8
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      break
    }

    case 'original':
    default:
      // Keep original screen capture cursor without covering
      break
  }

  ctx.restore()
}
