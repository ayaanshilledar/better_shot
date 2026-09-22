import {
  StudioProject,
  ExportSettings,
  ExportResolution,
  ExportBitratePreset,
  ExportProgress,
  AspectRatioType
} from '../types/editor'
import { calculateActiveZoom } from '../utils/zoomUtils'
import { WALLPAPER_PRESETS } from '../config/presets'
import { getInterpolatedCursorPosition, renderCursorOnCanvas } from '../utils/cursorRenderUtils'
import { DEFAULT_CURSOR_CONFIG } from '../types/cursor'
import { clickSoundService } from './clickSoundService'

// Preload image cache to avoid repeated image fetching during rendering
const imageCache = new Map<string, HTMLImageElement>()

export function preloadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageCache.set(src, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = src
  })
}

/**
 * Calculates pixel-exact target width and height taking the project's aspect ratio into account.
 * Guarantees even dimensions for video encoder compatibility (H.264/VP9 require even dimensions).
 */
export function calculateExportDimensions(
  aspectRatio: AspectRatioType,
  resolution: ExportResolution,
  nativeW: number = 1920,
  nativeH: number = 1080
): { width: number; height: number } {
  let baseWidth = 1920
  let baseHeight = 1080

  switch (resolution) {
    case '4k':
      baseWidth = 3840
      baseHeight = 2160
      break
    case '2k':
      baseWidth = 2560
      baseHeight = 1440
      break
    case '1080p':
      baseWidth = 1920
      baseHeight = 1080
      break
    case '720p':
      baseWidth = 1280
      baseHeight = 720
      break
    case 'original':
    default:
      baseWidth = nativeW || 1920
      baseHeight = nativeH || 1080
      break
  }

  // Derive aspect ratio decimal
  let ratio = 16 / 9
  switch (aspectRatio) {
    case '16:9':
      ratio = 16 / 9
      break
    case '9:16':
      ratio = 9 / 16
      break
    case '1:1':
      ratio = 1
      break
    case '4:3':
      ratio = 4 / 3
      break
    case '21:9':
      ratio = 21 / 9
      break
    case 'auto':
    default:
      ratio = (nativeW && nativeH) ? nativeW / nativeH : 16 / 9
      break
  }

  let finalW: number
  let finalH: number

  if (resolution === 'original' && aspectRatio === 'auto') {
    finalW = nativeW
    finalH = nativeH
  } else if (ratio >= 1) {
    // Landscape or square: base dimension is width
    finalW = baseWidth
    finalH = Math.round(baseWidth / ratio)
  } else {
    // Portrait / Vertical (e.g. 9:16): base dimension is height
    finalH = baseWidth // e.g. 1920 height for 1080p vertical
    finalW = Math.round(finalH * ratio) // e.g. 1080 width for 1080p vertical
  }

  // Ensure dimensions are even numbers
  finalW = Math.round(finalW / 2) * 2
  finalH = Math.round(finalH / 2) * 2

  return { width: Math.max(160, finalW), height: Math.max(160, finalH) }
}

/**
 * Calculates target video bitrate in bits per second.
 */
export function calculateTargetBitrate(
  resolution: ExportResolution,
  preset: ExportBitratePreset,
  customMbps?: number
): number {
  if (preset === 'custom') {
    const mbps = customMbps && customMbps > 0 ? customMbps : 12
    return Math.round(mbps * 1_000_000)
  }

  // Bitrates matrix in Mbps [Ultra, High, Standard, Economy]
  const matrix: Record<ExportResolution, { ultra: number; high: number; standard: number; economy: number }> = {
    '4k': { ultra: 50, high: 32, standard: 20, economy: 12 },
    '2k': { ultra: 28, high: 18, standard: 12, economy: 7 },
    '1080p': { ultra: 20, high: 12, standard: 8, economy: 4.5 },
    '720p': { ultra: 10, high: 6, standard: 4, economy: 2.5 },
    'original': { ultra: 24, high: 14, standard: 9, economy: 5 }
  }

  const resValues = matrix[resolution] || matrix['1080p']
  const mbps = resValues[preset] || resValues.high
  return Math.round(mbps * 1_000_000)
}

/**
 * Formats a bitrate number into a human-friendly string (e.g. "12 Mbps").
 */
export function formatBitrate(bps: number): string {
  const mbps = bps / 1_000_000
  if (mbps >= 1) {
    return `${mbps % 1 === 0 ? mbps : mbps.toFixed(1)} Mbps`
  }
  return `${Math.round(bps / 1000)} kbps`
}

/**
 * Calculates estimated file size in MB.
 */
export function estimateFileSize(
  durationSec: number,
  videoBitrateBps: number,
  audioBitrateKbps: number,
  includeAudio: boolean
): string {
  if (!durationSec || durationSec <= 0) return '0 MB'
  const totalBps = videoBitrateBps + (includeAudio ? audioBitrateKbps * 1000 : 0)
  const bytes = (totalBps * durationSec) / 8
  const mb = bytes / (1024 * 1024)

  if (mb < 1) {
    return `${Math.max(0.1, mb).toFixed(2)} MB`
  } else if (mb > 1024) {
    return `${(mb / 1024).toFixed(2)} GB`
  }
  return `${mb.toFixed(1)} MB`
}

/**
 * Resolves the background image URL or null if gradient/color/none.
 */
export function resolveBackgroundSource(project: StudioProject): { type: 'image' | 'gradient' | 'color' | 'none'; value: string } {
  if (project.background.type === 'none') {
    return { type: 'none', value: '' }
  }
  if (project.background.customImageUrl) {
    return { type: 'image', value: project.background.customImageUrl }
  }
  const preset = WALLPAPER_PRESETS.find((p) => p.id === project.background.presetId)
  if (preset?.url) {
    return { type: 'image', value: preset.url }
  }
  if (project.background.gradient) {
    return { type: 'gradient', value: project.background.gradient }
  }
  if (project.background.color) {
    return { type: 'color', value: project.background.color }
  }
  return { type: 'color', value: '#101216' }
}

/**
 * Draws rounded rectangle path on canvas.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, r)
  } else {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
  }
  ctx.closePath()
}

/**
 * Draws the shadow for the video container.
 */
function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  shadowType: StudioProject['layout']['shadow'],
  scaleFactor: number
) {
  if (shadowType === 'none') return

  ctx.save()
  let blur = 0
  let offsetY = 0
  let color = 'rgba(0, 0, 0, 0.4)'

  switch (shadowType) {
    case 'soft':
      blur = 24 * scaleFactor
      offsetY = 8 * scaleFactor
      color = 'rgba(0, 0, 0, 0.35)'
      break
    case 'medium':
      blur = 36 * scaleFactor
      offsetY = 14 * scaleFactor
      color = 'rgba(0, 0, 0, 0.55)'
      break
    case 'hard':
      blur = 42 * scaleFactor
      offsetY = 18 * scaleFactor
      color = 'rgba(0, 0, 0, 0.75)'
      break
    case 'glow':
      blur = 30 * scaleFactor
      offsetY = 0
      color = 'rgba(59, 130, 246, 0.5)'
      break
  }

  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = offsetY
  ctx.fillStyle = '#000000'

  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.fill()
  ctx.restore()
}

/**
 * Renders a single frame to the canvas at export resolution.
 */
export function renderFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | HTMLImageElement,
  project: StudioProject,
  currentTime: number,
  exportW: number,
  exportH: number,
  bgImage: HTMLImageElement | null
) {
  const scaleRef = exportW / 1920

  // 1. Clear background
  ctx.clearRect(0, 0, exportW, exportH)

  // 2. Draw Background
  const bgSource = resolveBackgroundSource(project)
  if (bgSource.type === 'image' && bgImage) {
    if (project.background.blurAmount > 0) {
      ctx.save()
      const blurPx = Math.round(project.background.blurAmount * 0.25 * scaleRef)
      ctx.filter = `blur(${blurPx}px)`
      // Draw slightly larger to cover blur edges
      const bleed = blurPx * 2
      ctx.drawImage(bgImage, -bleed, -bleed, exportW + bleed * 2, exportH + bleed * 2)
      ctx.restore()
    } else {
      ctx.drawImage(bgImage, 0, 0, exportW, exportH)
    }
  } else if (bgSource.type === 'gradient' || bgSource.type === 'color') {
    ctx.save()
    if (bgSource.type === 'color') {
      ctx.fillStyle = bgSource.value
    } else {
      const grad = ctx.createLinearGradient(0, 0, exportW, exportH)
      grad.addColorStop(0, '#1a1e29')
      grad.addColorStop(1, '#0d0f14')
      ctx.fillStyle = grad
    }
    ctx.fillRect(0, 0, exportW, exportH)
    ctx.restore()
  } else if (bgSource.type === 'none') {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, exportW, exportH)
  }

  // 3. Calculate Video Dimensions & Frame Geometry
  const nativeW = project.media.width || (video as HTMLVideoElement).videoWidth || (video as HTMLImageElement).naturalWidth || 1920
  const nativeH = project.media.height || (video as HTMLVideoElement).videoHeight || (video as HTMLImageElement).naturalHeight || 1080

  const crop = project.layout.cropRegion
  const isCropped = Boolean(
    crop &&
    crop.width > 20 &&
    crop.height > 20 &&
    (Math.abs(crop.width - nativeW) > 2 || Math.abs(crop.height - nativeH) > 2 || crop.x > 2 || crop.y > 2)
  )

  const cropW = Math.max(20, isCropped ? crop!.width : nativeW)
  const cropH = Math.max(20, isCropped ? crop!.height : nativeH)
  const cropX = Math.max(0, isCropped ? crop!.x : 0)
  const cropY = Math.max(0, isCropped ? crop!.y : 0)
  const videoRatio = cropW / cropH

  // Padding scale (0 to 40 mapped from 1.0 to 0.65)
  const canvasScale = project.background.type === 'none'
    ? 1.0
    : Math.max(0.5, 1 - (project.layout.padding / 40) * 0.35)

  const paddingMargin = 48 * scaleRef
  const availableW = Math.max(40, (exportW - paddingMargin) * canvasScale)
  const availableH = Math.max(40, (exportH - paddingMargin) * canvasScale)

  let frameW = availableW
  let frameH = Math.round(availableW / videoRatio)
  if (frameH > availableH) {
    frameH = availableH
    frameW = Math.round(availableH * videoRatio)
  }

  // Center position with user drag offset
  const userOffsetX = (project.layout.x || 0) * scaleRef
  const userOffsetY = (project.layout.y || 0) * scaleRef
  const frameX = Math.round((exportW - frameW) / 2 + userOffsetX)
  const frameY = Math.round((exportH - frameH) / 2 + userOffsetY)

  const cornerRadius = Math.round((project.layout.cornerRadius || 0) * scaleRef)

  // 4. Draw Shadow behind video
  drawShadow(ctx, frameX, frameY, frameW, frameH, cornerRadius, project.layout.shadow, scaleRef)

  // 5. Calculate Zoom Animation
  const activeZoom = calculateActiveZoom(project.timeline.zoomEvents, currentTime)
  const zoomScale = activeZoom.scale
  const focalX = activeZoom.x / 100 // 0 to 1
  const focalY = activeZoom.y / 100 // 0 to 1

  // 6. Draw Clipped Video
  ctx.save()
  drawRoundedRect(ctx, frameX, frameY, frameW, frameH, cornerRadius)
  ctx.clip()

  // Apply zoom transformation around focal point
  if (zoomScale > 1.001) {
    const originX = frameX + frameW * focalX
    const originY = frameY + frameH * focalY
    ctx.translate(originX, originY)
    ctx.scale(zoomScale, zoomScale)
    ctx.translate(-originX, -originY)
  }

  // Draw video frame (with crop slicing if active)
  if (isCropped) {
    ctx.drawImage(video, cropX, cropY, cropW, cropH, frameX, frameY, frameW, frameH)
  } else {
    ctx.drawImage(video, 0, 0, nativeW, nativeH, frameX, frameY, frameW, frameH)
  }

  // 6b. Draw Cursor & Click Ripples (Single-Cursor Replacement)
  const cursorConfig = project.cursorConfig || DEFAULT_CURSOR_CONFIG
  if (cursorConfig.enabled) {
    const cursor = getInterpolatedCursorPosition(project.cursorData, currentTime)
    if (cursor) {
      renderCursorOnCanvas(
        ctx,
        cursor,
        project.cursorData,
        cursorConfig,
        frameX,
        frameY,
        frameW,
        frameH,
        currentTime,
        scaleRef
      )
    }
  }

  ctx.restore()


  // 7. Draw Outer Border Stroke
  const borderWidth = project.layout.borderWidth ?? 1
  const borderOpacity = project.layout.borderOpacity ?? 25
  if (borderWidth > 0 && borderOpacity > 0) {
    ctx.save()
    const strokeW = Math.max(1, Math.round(borderWidth * scaleRef))
    ctx.strokeStyle = `rgba(255, 255, 255, ${borderOpacity / 100})`
    ctx.lineWidth = strokeW
    drawRoundedRect(
      ctx,
      frameX - strokeW / 2,
      frameY - strokeW / 2,
      frameW + strokeW,
      frameH + strokeW,
      cornerRadius + strokeW / 2
    )
    ctx.stroke()
    ctx.restore()
  }
}

/**
 * Detects supported MediaRecorder MIME types with fallback.
 */
export function getSupportedMimeType(preferredFormat?: string): { mimeType: string; format: 'mp4' | 'webm' } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', format: 'webm' }
  }

  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264,aac',
    'video/mp4'
  ]

  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ]

  if (preferredFormat === 'mp4') {
    for (const t of mp4Types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return { mimeType: t, format: 'mp4' }
      }
    }
    // Fallback to WebM if MP4 not supported
    for (const t of webmTypes) {
      if (MediaRecorder.isTypeSupported(t)) {
        return { mimeType: t, format: 'webm' }
      }
    }
  } else {
    for (const t of webmTypes) {
      if (MediaRecorder.isTypeSupported(t)) {
        return { mimeType: t, format: 'webm' }
      }
    }
    for (const t of mp4Types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return { mimeType: t, format: 'mp4' }
      }
    }
  }

  return { mimeType: 'video/webm', format: 'webm' }
}

export interface ExportController {
  cancel: () => void
}

/**
 * Main Video Export Pipeline.
 * Renders the project frame-by-frame, mixes audio, records via MediaRecorder, and saves to file.
 */
export function createExportProcess(
  project: StudioProject,
  settings: ExportSettings,
  onProgress: (progress: ExportProgress) => void,
  onPreviewFrame?: (canvas: HTMLCanvasElement) => void
): { promise: Promise<{ success: boolean; filePath?: string; fileSize?: number; error?: string }>; cancel: () => void } {
  let isCancelled = false
  let mediaRecorder: MediaRecorder | null = null
  let audioCtx: AudioContext | null = null
  let hiddenVideo: HTMLVideoElement | null = null

  const cancel = () => {
    isCancelled = true
    if (hiddenVideo) {
      hiddenVideo.pause()
      if (hiddenVideo.parentNode) {
        hiddenVideo.parentNode.removeChild(hiddenVideo)
      }
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      } catch (e) {}
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {})
    }
    onProgress({
      progress: 0,
      currentTime: 0,
      totalDuration: project.media.duration || 1,
      fps: settings.fps,
      etaSeconds: 0,
      phase: 'cancelled'
    })
  }

  const promise = (async () => {
    try {
      onProgress({
        progress: 0,
        currentTime: 0,
        totalDuration: project.media.duration || 1,
        fps: settings.fps,
        etaSeconds: 0,
        phase: 'preparing'
      })

      // 1. Resolve Target Dimensions and Bitrate
      const { width: exportW, height: exportH } = calculateExportDimensions(
        project.layout.aspectRatio,
        settings.resolution,
        project.media.width,
        project.media.height
      )

      const videoBitrate = calculateTargetBitrate(
        settings.resolution,
        settings.bitratePreset,
        settings.customBitrateMbps
      )

      // 2. Preload Wallpaper Image if needed
      let bgImage: HTMLImageElement | null = null
      const bgSource = resolveBackgroundSource(project)
      if (bgSource.type === 'image' && bgSource.value) {
        try {
          bgImage = await preloadImage(bgSource.value)
        } catch (err) {
          console.warn('Could not preload background image for export, using solid fallback:', err)
        }
      }

      if (isCancelled) return { success: false, error: 'Export cancelled by user' }

      // 3. Setup Offscreen Canvas
      const canvas = document.createElement('canvas')
      canvas.width = exportW
      canvas.height = exportH
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
      if (!ctx) throw new Error('Could not initialize 2D canvas context')

      // 4. Setup Video Element for playback (attached invisibly so Chromium allocates decoder and renders frames)
      hiddenVideo = document.createElement('video')
      hiddenVideo.crossOrigin = 'anonymous'
      hiddenVideo.playsInline = true
      hiddenVideo.muted = false
      hiddenVideo.style.position = 'fixed'
      hiddenVideo.style.top = '-9999px'
      hiddenVideo.style.left = '-9999px'
      hiddenVideo.style.width = '320px'
      hiddenVideo.style.height = '180px'
      hiddenVideo.style.opacity = '0'
      hiddenVideo.style.pointerEvents = 'none'
      document.body.appendChild(hiddenVideo)

      hiddenVideo.src = project.media.sourcePath
        ? `file:///${project.media.sourcePath.replace(/\\/g, '/')}`
        : ''

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), 4000)
        hiddenVideo!.onloadeddata = () => {
          clearTimeout(timeout)
          resolve()
        }
        hiddenVideo!.onloadedmetadata = () => {
          clearTimeout(timeout)
          resolve()
        }
        hiddenVideo!.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('Failed to load source video stream'))
        }
      })

      // Resolve a strict, guaranteed finite duration (handles WebM Chromium duration: Infinity issue)
      let duration = 0
      if (Number.isFinite(project.media.duration) && project.media.duration > 0) {
        duration = project.media.duration
      } else if (Number.isFinite(hiddenVideo.duration) && hiddenVideo.duration > 0) {
        duration = hiddenVideo.duration
      }

      // Check seekable buffer for real WebM duration
      if (!Number.isFinite(duration) || duration <= 0) {
        try {
          if (hiddenVideo.seekable && hiddenVideo.seekable.length > 0) {
            const end = hiddenVideo.seekable.end(hiddenVideo.seekable.length - 1)
            if (Number.isFinite(end) && end > 0) {
              duration = end
            }
          }
        } catch (e) {}
      }

      // If still not finite, perform quick seek to end to let Chromium compute duration
      if (!Number.isFinite(duration) || duration <= 0) {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            hiddenVideo!.removeEventListener('seeked', onSeeked)
            if (Number.isFinite(hiddenVideo!.duration) && hiddenVideo!.duration > 0) {
              duration = hiddenVideo!.duration
            } else if (Number.isFinite(hiddenVideo!.currentTime) && hiddenVideo!.currentTime > 0) {
              duration = hiddenVideo!.currentTime
            }
            hiddenVideo!.currentTime = 0
            resolve()
          }
          hiddenVideo!.addEventListener('seeked', onSeeked)
          hiddenVideo!.currentTime = 1e101
          setTimeout(() => {
            hiddenVideo!.removeEventListener('seeked', onSeeked)
            hiddenVideo!.currentTime = 0
            resolve()
          }, 300)
        })
      }

      if (!Number.isFinite(duration) || duration <= 0) {
        duration = 5.0
      }

      if (isCancelled) return { success: false, error: 'Export cancelled by user' }

      // 5. Setup Audio Routing
      let audioStreamTrack: MediaStreamTrack | null = null
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass && settings.includeAudio && !project.layout.isMuted) {
          audioCtx = new AudioContextClass()
          const sourceNode = audioCtx.createMediaElementSource(hiddenVideo)
          const gainNode = audioCtx.createGain()
          const vol = (project.layout.volume ?? 100) / 100
          gainNode.gain.value = vol

          const destination = audioCtx.createMediaStreamDestination()
          sourceNode.connect(gainNode)
          gainNode.connect(destination)

          // Setup Click Audio FX mixing into export stream
          let clickGainNode: GainNode | null = null
          let clickSoundBuffer: AudioBuffer | null = null
          const cursorConfig = project.cursorConfig || DEFAULT_CURSOR_CONFIG
          if (cursorConfig.sound?.enabled && project.cursorData?.clicks?.length) {
            try {
              clickGainNode = audioCtx.createGain()
              clickGainNode.gain.value = (cursorConfig.sound.volume / 100) * 0.5
              clickGainNode.connect(destination)
              clickSoundBuffer = clickSoundService.renderToBuffer(audioCtx, cursorConfig.sound.soundType)
            } catch (err) {
              console.warn('Could not initialize click sound buffer for export:', err)
            }
          }

          const tracks = destination.stream.getAudioTracks()
          if (tracks.length > 0) {
            audioStreamTrack = tracks[0]
          }
        }
      } catch (e) {
        console.warn('Could not initialize audio mixing for export:', e)
      }

      // 6. Capture Stream & MediaRecorder Setup
      const canvasStream = canvas.captureStream(settings.fps)
      const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]
      if (audioStreamTrack) {
        combinedTracks.push(audioStreamTrack)
      }

      const outputStream = new MediaStream(combinedTracks)
      const videoFormat = settings.format === 'mp4' ? 'mp4' : 'webm'
      const { mimeType, format: resolvedFormat } = getSupportedMimeType(videoFormat)

      mediaRecorder = new MediaRecorder(outputStream, {
        mimeType,
        videoBitsPerSecond: videoBitrate,
        audioBitsPerSecond: settings.audioBitrateKbps * 1000
      })

      const recordedChunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data)
        }
      }

      // 7. Start Playback and Frame Recording Loop
      const exportStartTime = performance.now()
      const trimStart = project.timeline.trimRange?.start ?? 0
      const rawEnd = project.timeline.trimRange?.end ?? duration
      const trimEnd = Math.min(duration, Math.max(trimStart + 0.1, rawEnd))
      const targetDuration = trimEnd - trimStart

      mediaRecorder.start(250)

      onProgress({
        progress: 0,
        currentTime: 0,
        totalDuration: targetDuration,
        fps: settings.fps,
        etaSeconds: Math.round(targetDuration),
        phase: 'rendering'
      })

      hiddenVideo.currentTime = trimStart
      await hiddenVideo.play()

      let lastExportClickMs = -1

      await new Promise<void>((resolve, reject) => {
        let animFrameId: number

        const renderLoop = () => {
          if (isCancelled) {
            cancelAnimationFrame(animFrameId)
            reject(new Error('Export cancelled by user'))
            return
          }

          const currTime = hiddenVideo!.currentTime
          renderFrameToCanvas(ctx, hiddenVideo!, project, currTime, exportW, exportH, bgImage)

          // Mix click sound into audio stream when click timestamp is crossed
          if (audioCtx && project.cursorData?.clicks && project.cursorConfig?.sound?.enabled) {
            const currMs = currTime * 1000
            const recentClicks = project.cursorData.clicks.filter(
              c => c.t <= currMs && c.t > lastExportClickMs
            )
            if (recentClicks.length > 0) {
              lastExportClickMs = currMs
              try {
                clickSoundService.play(project.cursorConfig.sound.soundType, project.cursorConfig.sound.volume)
              } catch (_) {}
            }
          }

          if (onPreviewFrame) {
            onPreviewFrame(canvas)
          }

          const progressPercent = Math.min(99, Math.max(0, Math.round(((currTime - trimStart) / targetDuration) * 100)))
          const elapsedSec = (performance.now() - exportStartTime) / 1000
          const processedDuration = currTime - trimStart
          const rate = processedDuration > 0 ? elapsedSec / processedDuration : 1
          const rawRemaining = (targetDuration - processedDuration) * rate
          const remainingSec = Number.isFinite(rawRemaining) ? Math.max(0, Math.round(rawRemaining)) : 0

          onProgress({
            progress: progressPercent,
            currentTime: processedDuration,
            totalDuration: targetDuration,
            fps: settings.fps,
            etaSeconds: remainingSec,
            phase: 'rendering'
          })

          if (currTime >= trimEnd - 0.05 || hiddenVideo!.ended) {
            cancelAnimationFrame(animFrameId)
            resolve()
          } else {
            animFrameId = requestAnimationFrame(renderLoop)
          }
        }

        hiddenVideo!.onended = () => {
          cancelAnimationFrame(animFrameId)
          resolve()
        }

        animFrameId = requestAnimationFrame(renderLoop)
      })

      if (isCancelled) return { success: false, error: 'Export cancelled by user' }

      // 8. Finalize MediaRecorder
      onProgress({
        progress: 99,
        currentTime: duration,
        totalDuration: duration,
        fps: settings.fps,
        etaSeconds: 1,
        phase: 'encoding'
      })

      const blob = await new Promise<Blob>((resolve) => {
        mediaRecorder!.onstop = () => {
          const finalBlob = new Blob(recordedChunks, { type: mimeType })
          resolve(finalBlob)
        }
        mediaRecorder!.stop()
      })

      // 9. Save via Electron IPC
      onProgress({
        progress: 99,
        currentTime: duration,
        totalDuration: duration,
        fps: settings.fps,
        etaSeconds: 0,
        phase: 'saving'
      })

      const arrayBuffer = await blob.arrayBuffer()
      const cleanTitle = (project.title || 'BetterShot').replace(/[<>:"/\\|?*]+/g, '_')
      const defaultFileName = `${cleanTitle}_${settings.resolution}_${Date.now()}.${resolvedFormat}`

      let saveResult: { success: boolean; filePath?: string; error?: string }
      if (window.electronAPI?.saveExportedVideo) {
        saveResult = await window.electronAPI.saveExportedVideo(
          arrayBuffer,
          defaultFileName,
          settings.saveLocation
        )
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultFileName
        a.click()
        URL.revokeObjectURL(url)
        saveResult = { success: true, filePath: defaultFileName }
      }

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save exported file')
      }

      onProgress({
        progress: 100,
        currentTime: duration,
        totalDuration: duration,
        fps: settings.fps,
        etaSeconds: 0,
        phase: 'completed',
        filePath: saveResult.filePath,
        fileSize: arrayBuffer.byteLength
      })

      return {
        success: true,
        filePath: saveResult.filePath,
        fileSize: arrayBuffer.byteLength
      }
    } catch (error: any) {
      if (isCancelled) {
        return { success: false, error: 'Export cancelled by user' }
      }
      const errorMsg = error?.message || 'Export process failed'
      onProgress({
        progress: 0,
        currentTime: 0,
        totalDuration: 1,
        fps: settings.fps,
        etaSeconds: 0,
        phase: 'error',
        error: errorMsg
      })
      return { success: false, error: errorMsg }
    } finally {
      if (hiddenVideo) {
        hiddenVideo.pause()
        hiddenVideo.src = ''
        if (hiddenVideo.parentNode) {
          hiddenVideo.parentNode.removeChild(hiddenVideo)
        }
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {})
      }
    }
  })()

  return { promise, cancel }
}

/**
 * Renders a pixel-perfect export of a static screenshot/image project with backgrounds, padding, and drop shadows.
 */
export async function exportScreenshotImage(
  project: StudioProject,
  resolution: ExportResolution = 'original'
): Promise<Blob> {
  const mediaPath = project.media.sourcePath ? `file:///${project.media.sourcePath.replace(/\\/g, '/')}` : ''
  const img = await preloadImage(mediaPath)
  const dims = calculateExportDimensions(
    project.layout.aspectRatio,
    resolution,
    img.naturalWidth || project.media.width || 1920,
    img.naturalHeight || project.media.height || 1080
  )

  const canvas = document.createElement('canvas')
  canvas.width = dims.width
  canvas.height = dims.height
  const ctx = canvas.getContext('2d')!

  let bgImage: HTMLImageElement | null = null
  const bgSource = resolveBackgroundSource(project)
  if (bgSource.type === 'image') {
    try {
      bgImage = await preloadImage(bgSource.value)
    } catch (e) {
      console.warn('Could not preload background image:', e)
    }
  }

  renderFrameToCanvas(ctx, img, project, 0, dims.width, dims.height, bgImage)

  const mime = project.exportSettings?.format === 'jpeg' ? 'image/jpeg' : 'image/png'
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, mime, 0.95)
  })
}
