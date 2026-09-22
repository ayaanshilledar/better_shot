import { CropRegion } from '../../electron/preload'
import { CameraOverlayConfig, DEFAULT_CAMERA_CONFIG } from '../types/editor'

export interface CaptureConfig {
  sourceId: string | null
  isDisplay: boolean
  enableCamera: boolean
  enableMic: boolean
  enableSystemAudio: boolean
  cameraId?: string
  micId?: string
  cropRegion?: CropRegion
  cameraConfig?: CameraOverlayConfig
}

class ScreenRecorderService {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private combinedStream: MediaStream | null = null
  private rawDesktopStream: MediaStream | null = null
  private cameraStream: MediaStream | null = null
  private micAudioTracks: MediaStreamTrack[] = []
  private systemAudioTracks: MediaStreamTrack[] = []
  private audioContext: AudioContext | null = null
  private mixAudioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private animFrameId: number | null = null
  private cropAnimFrameId: number | null = null
  private cropVideoElement: HTMLVideoElement | null = null
  private cameraVideoElement: HTMLVideoElement | null = null
  private audioLevelCallback: ((level: number) => void) | null = null
  private timerCallback: ((seconds: number) => void) | null = null
  private startTime: number = 0
  private timerInterval: NodeJS.Timeout | null = null
  private elapsedTime: number = 0
  private isPaused: boolean = false
  private isCameraMuted: boolean = false
  private activeCameraConfig: CameraOverlayConfig = DEFAULT_CAMERA_CONFIG
  private lastConfig: CaptureConfig | null = null

  public async startRecording(config: CaptureConfig): Promise<boolean> {
    console.log('[BetterShot:Recorder] Starting recording with config:', config)
    try {
      this.lastConfig = config
      this.recordedChunks = []
      this.elapsedTime = 0
      this.isPaused = false
      this.micAudioTracks = []
      this.systemAudioTracks = []

      let videoTrack: MediaStreamTrack | null = null
      const rawAudioTracks: MediaStreamTrack[] = []

      // 1. Camera Only Mode
      if (config.enableCamera && !config.sourceId && config.isDisplay === false) {
        console.log('[BetterShot:Recorder] Capturing Camera Stream...')
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: config.cameraId ? { deviceId: { exact: config.cameraId } } : true,
          audio: false
        })
        videoTrack = camStream.getVideoTracks()[0]
      }
      // 2. Screen / Display or Window Capture Stream
      else if (config.sourceId) {
        console.log(`[BetterShot:Recorder] Capturing Desktop Stream for sourceId: ${config.sourceId}`)
        let desktopStream: MediaStream | null = null
        try {
          desktopStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: config.enableSystemAudio ? {
              mandatory: {
                chromeMediaSource: 'desktop'
              }
            } : false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: config.sourceId,
                minWidth: 1280,
                maxWidth: 3840,
                minHeight: 720,
                maxHeight: 2160,
                maxFrameRate: 60
              }
            }
          })
        } catch (err) {
          console.warn('[BetterShot:Recorder] Desktop getUserMedia with system audio failed, retrying video only:', err)
          desktopStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: config.sourceId
              }
            }
          })
        }

        if (desktopStream) {
          this.rawDesktopStream = desktopStream
          const vTracks = desktopStream.getVideoTracks()
          if (vTracks.length > 0) {
            videoTrack = vTracks[0]
            console.log(`[BetterShot:Recorder] Desktop video track acquired (${vTracks[0].label})`)
          }

          if (config.enableSystemAudio) {
            const sysTracks = desktopStream.getAudioTracks()
            if (sysTracks.length > 0) {
              this.systemAudioTracks = sysTracks
              rawAudioTracks.push(...sysTracks)
              console.log(`[BetterShot:Recorder] System audio tracks acquired (${sysTracks.length})`)
            }
          }
        }
      } else {
        // Fallback or Display media standard API
        console.log('[BetterShot:Recorder] Capturing standard displayMedia stream...')
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: config.enableSystemAudio
        })
        this.rawDesktopStream = displayStream
        videoTrack = displayStream.getVideoTracks()[0]
        if (config.enableSystemAudio && displayStream.getAudioTracks().length > 0) {
          const sysTracks = displayStream.getAudioTracks()
          this.systemAudioTracks = sysTracks
          rawAudioTracks.push(...sysTracks)
        }
      }

      if (!videoTrack) {
        throw new Error('No video stream source found')
      }

      // 2b. Camera Stream (Webcam Overlay)
      let camTrack: MediaStreamTrack | null = null
      if (config.enableCamera) {
        try {
          console.log('[BetterShot:Recorder] Capturing Webcam Stream...')
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: config.cameraId ? { deviceId: { exact: config.cameraId } } : true,
            audio: false
          })
          this.cameraStream = camStream
          if (config.cameraConfig) {
            this.activeCameraConfig = { ...config.cameraConfig }
          }
          camTrack = camStream.getVideoTracks()[0] || null
          if (camTrack) {
            camTrack.onended = () => {
              console.warn('[BetterShot:Recorder] Webcam disconnected mid-recording')
              this.isCameraMuted = true
            }
          }
        } catch (camErr) {
          console.warn('[BetterShot:Recorder] Webcam stream error or permission denied:', camErr)
        }
      }

      // 2c. Real-Time Compositing Pipeline (Area Crop and/or Camera Overlay)
      if ((config.cropRegion || camTrack) && videoTrack) {
        console.log('[BetterShot:Recorder] Setting up real-time Video Compositor (Crop + Camera Overlay)...')
        const compositedTrack = await this.setupCompositedVideoTrack(videoTrack, config.cropRegion, camTrack)
        if (compositedTrack) {
          videoTrack = compositedTrack
          console.log('[BetterShot:Recorder] Composited video track active!')
        }
      }

      // 3. Microphone Stream
      try {
        console.log(`[BetterShot:Recorder] Capturing Microphone Stream (enableMic = ${config.enableMic})...`)
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: config.micId ? { deviceId: { exact: config.micId } } : true,
          video: false
        })
        const mTracks = micStream.getAudioTracks()
        this.micAudioTracks = mTracks

        // Set initial track enabled state to match config.enableMic
        mTracks.forEach((track) => {
          track.enabled = config.enableMic
        })

        rawAudioTracks.push(...mTracks)
        this.setupAudioMeter(micStream)
        console.log(`[BetterShot:Recorder] Microphone stream acquired (${mTracks.length} tracks), initial enabled = ${config.enableMic}`)
      } catch (micErr) {
        console.warn('[BetterShot:Recorder] Microphone stream error or permission denied:', micErr)
      }

      // 4. Combine & Mix Audio Tracks
      // MediaRecorder in Chromium only encodes the FIRST audio track in a MediaStream.
      // If multiple audio sources (e.g. Mic + System Audio) exist, we mix them using Web Audio API.
      let finalAudioTrack: MediaStreamTrack | null = null

      if (rawAudioTracks.length > 1) {
        console.log(`[BetterShot:Recorder] Mixing ${rawAudioTracks.length} audio tracks using Web Audio API...`)
        const mixContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        this.mixAudioContext = mixContext
        const destination = mixContext.createMediaStreamDestination()

        rawAudioTracks.forEach((track) => {
          const stream = new MediaStream([track])
          const source = mixContext.createMediaStreamSource(stream)
          source.connect(destination)
        })

        const mixedTracks = destination.stream.getAudioTracks()
        if (mixedTracks.length > 0) {
          finalAudioTrack = mixedTracks[0]
          console.log('[BetterShot:Recorder] Web Audio API track mixing successful!')
        }
      } else if (rawAudioTracks.length === 1) {
        finalAudioTrack = rawAudioTracks[0]
      }

      const tracksToCombine: MediaStreamTrack[] = [videoTrack]
      if (finalAudioTrack) {
        tracksToCombine.push(finalAudioTrack)
      }

      this.combinedStream = new MediaStream(tracksToCombine)

      // 5. Select best supported mime type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ]
      const selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm'
      console.log(`[BetterShot:Recorder] Selected MediaRecorder MIME type: ${selectedMime}`)

      this.mediaRecorder = new MediaRecorder(this.combinedStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 5000000 // 5 Mbps quality
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
          console.log(`[BetterShot:Recorder] Chunk received: ${event.data.size} bytes (Total chunks: ${this.recordedChunks.length})`)
        }
      }

      this.mediaRecorder.start(1000) // 1 second slice chunks
      this.startTimer()

      // Start synchronized cursor and click telemetry tracking
      if (typeof window !== 'undefined' && (window as any).electronAPI?.startCursorTracking) {
        (window as any).electronAPI.startCursorTracking({
          sourceId: config.sourceId,
          cropRegion: config.cropRegion
        }).catch((err: any) => console.warn('[BetterShot:Recorder] Error starting cursor tracking:', err))
      }

      console.log('[BetterShot:Recorder] MediaRecorder started successfully!')

      return true
    } catch (error) {
      console.error('[BetterShot:Recorder] Failed to start recording:', error)
      this.cleanup()
      throw error
    }
  }

  private async setupCompositedVideoTrack(
    rawVideoTrack: MediaStreamTrack,
    crop?: CropRegion,
    cameraTrack?: MediaStreamTrack | null
  ): Promise<MediaStreamTrack | null> {
    return new Promise((resolve) => {
      // 1. Offscreen video element for desktop/screen stream
      const video = document.createElement('video')
      video.autoplay = true
      video.muted = true
      video.playsInline = true
      video.style.position = 'fixed'
      video.style.top = '-9999px'
      video.style.left = '-9999px'
      video.style.width = '1px'
      video.style.height = '1px'
      video.style.opacity = '0'
      video.style.pointerEvents = 'none'
      document.body.appendChild(video)

      video.srcObject = new MediaStream([rawVideoTrack])
      this.cropVideoElement = video

      // 2. Offscreen video element for camera stream (if cameraTrack provided)
      let camVideo: HTMLVideoElement | null = null
      if (cameraTrack) {
        camVideo = document.createElement('video')
        camVideo.autoplay = true
        camVideo.muted = true
        camVideo.playsInline = true
        camVideo.style.position = 'fixed'
        camVideo.style.top = '-9999px'
        camVideo.style.left = '-9999px'
        camVideo.style.width = '1px'
        camVideo.style.height = '1px'
        camVideo.style.opacity = '0'
        camVideo.style.pointerEvents = 'none'
        document.body.appendChild(camVideo)

        camVideo.srcObject = new MediaStream([cameraTrack])
        this.cameraVideoElement = camVideo
      }

      let isResolved = false

      const startCompositing = async () => {
        if (isResolved) return
        isResolved = true

        try {
          await video.play()
        } catch (e) {
          console.warn('[BetterShot:Recorder] Desktop video play error during compositor setup:', e)
        }

        if (camVideo) {
          try {
            await camVideo.play()
          } catch (e) {
            console.warn('[BetterShot:Recorder] Camera video play error during compositor setup:', e)
          }
        }

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { alpha: false })

        const videoW = video.videoWidth > 0 ? video.videoWidth : (crop ? crop.screenWidth : 1920)
        const videoH = video.videoHeight > 0 ? video.videoHeight : (crop ? crop.screenHeight : 1080)

        let targetW = videoW
        let targetH = videoH
        let srcX = 0
        let srcY = 0
        let srcW = videoW
        let srcH = videoH

        if (crop) {
          targetW = Math.max(2, Math.round(crop.width))
          targetH = Math.max(2, Math.round(crop.height))
          const scaleX = videoW / crop.screenWidth
          const scaleY = videoH / crop.screenHeight
          srcX = Math.round(crop.x * scaleX)
          srcY = Math.round(crop.y * scaleY)
          srcW = Math.round(crop.width * scaleX)
          srcH = Math.round(crop.height * scaleY)
        }

        canvas.width = targetW
        canvas.height = targetH

        console.log(`[BetterShot:Recorder] Compositor initialized: Canvas (${targetW}x${targetH}), Camera: ${Boolean(camVideo)}`)

        const renderFrame = () => {
          if (!ctx) return
          try {
            // 1. Draw Base Screen Video Frame
            if (crop) {
              ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH)
            } else {
              ctx.drawImage(video, 0, 0, targetW, targetH)
            }

            // 2. Draw Camera Overlay (if camera active and not muted)
            if (camVideo && !this.isCameraMuted && camVideo.readyState >= 2) {
              const camCfg = this.activeCameraConfig
              const baseW = targetW
              const baseH = targetH

              // Scale bubble proportionally to recording dimensions
              const sizeMultiplier = camCfg.size === 'small' ? 0.14 : camCfg.size === 'large' ? 0.22 : 0.18
              const bubbleSize = Math.max(120, Math.min(Math.round(baseW * sizeMultiplier), Math.round(baseH * 0.42)))
              const pad = Math.max(16, Math.round(baseW * 0.022))

              let bubbleX = targetW - bubbleSize - pad
              let bubbleY = targetH - bubbleSize - pad

              if (camCfg.position === 'bottom-left') {
                bubbleX = pad
                bubbleY = targetH - bubbleSize - pad
              } else if (camCfg.position === 'top-right') {
                bubbleX = targetW - bubbleSize - pad
                bubbleY = pad
              } else if (camCfg.position === 'top-left') {
                bubbleX = pad
                bubbleY = pad
              }

              // Draw Drop Shadow
              ctx.save()
              ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
              ctx.shadowBlur = Math.round(18 * (bubbleSize / 200))
              ctx.shadowOffsetY = Math.round(6 * (bubbleSize / 200))

              ctx.beginPath()
              if (camCfg.shape === 'circle') {
                const cx = bubbleX + bubbleSize / 2
                const cy = bubbleY + bubbleSize / 2
                ctx.arc(cx, cy, bubbleSize / 2, 0, Math.PI * 2)
              } else {
                const r = Math.round(bubbleSize * 0.16)
                if ((ctx as any).roundRect) {
                  (ctx as any).roundRect(bubbleX, bubbleY, bubbleSize, bubbleSize, r)
                } else {
                  ctx.rect(bubbleX, bubbleY, bubbleSize, bubbleSize)
                }
              }
              ctx.fillStyle = '#0f1117'
              ctx.fill()
              ctx.restore()

              // Clip and Draw Video Frame
              ctx.save()
              ctx.beginPath()
              if (camCfg.shape === 'circle') {
                const cx = bubbleX + bubbleSize / 2
                const cy = bubbleY + bubbleSize / 2
                ctx.arc(cx, cy, bubbleSize / 2, 0, Math.PI * 2)
              } else {
                const r = Math.round(bubbleSize * 0.16)
                if ((ctx as any).roundRect) {
                  (ctx as any).roundRect(bubbleX, bubbleY, bubbleSize, bubbleSize, r)
                } else {
                  ctx.rect(bubbleX, bubbleY, bubbleSize, bubbleSize)
                }
              }
              ctx.clip()

              // Mirror camera horizontally if enabled
              if (camCfg.mirror !== false) {
                const cx = bubbleX + bubbleSize / 2
                ctx.translate(cx, 0)
                ctx.scale(-1, 1)
                ctx.translate(-cx, 0)
              }

              // Center-crop camera feed (cover behavior)
              const cW = camVideo.videoWidth || 640
              const cH = camVideo.videoHeight || 480
              const minDim = Math.min(cW, cH)
              const sx = Math.round((cW - minDim) / 2)
              const sy = Math.round((cH - minDim) / 2)
              ctx.drawImage(camVideo, sx, sy, minDim, minDim, bubbleX, bubbleY, bubbleSize, bubbleSize)
              ctx.restore()

              // Draw Sleek Outer Ring Border
              ctx.save()
              ctx.beginPath()
              if (camCfg.shape === 'circle') {
                const cx = bubbleX + bubbleSize / 2
                const cy = bubbleY + bubbleSize / 2
                ctx.arc(cx, cy, bubbleSize / 2, 0, Math.PI * 2)
              } else {
                const r = Math.round(bubbleSize * 0.16)
                if ((ctx as any).roundRect) {
                  (ctx as any).roundRect(bubbleX, bubbleY, bubbleSize, bubbleSize, r)
                } else {
                  ctx.rect(bubbleX, bubbleY, bubbleSize, bubbleSize)
                }
              }
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
              ctx.lineWidth = Math.max(2, Math.round(3 * (bubbleSize / 200)))
              ctx.stroke()
              ctx.restore()
            }
          } catch (err) {
            console.warn('[BetterShot:Recorder] Compositor frame render error:', err)
          }
        }

        renderFrame()

        // 60fps compositor interval
        if (this.cropAnimFrameId) {
          clearInterval(this.cropAnimFrameId as any)
          cancelAnimationFrame(this.cropAnimFrameId)
        }
        this.cropAnimFrameId = window.setInterval(renderFrame, 1000 / 60) as any

        const canvasStream = canvas.captureStream(60)
        const compositedTrack = canvasStream.getVideoTracks()[0] || null
        resolve(compositedTrack)
      }

      if (video.readyState >= 1 && video.videoWidth > 0) {
        startCompositing()
      } else {
        video.onloadedmetadata = () => startCompositing()
        video.onloadeddata = () => startCompositing()
        setTimeout(() => {
          startCompositing()
        }, 300)
      }
    })
  }

  public isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state !== 'inactive'
  }

  public isPausedState(): boolean {
    return this.isPaused
  }

  public toggleMicMute(muted: boolean) {
    console.log(`[BetterShot:Recorder] toggleMicMute: ${muted ? 'MUTED' : 'UNMUTED'}`)
    this.micAudioTracks.forEach(track => {
      track.enabled = !muted
    })
  }

  public toggleSystemAudioMute(muted: boolean) {
    console.log(`[BetterShot:Recorder] toggleSystemAudioMute: ${muted ? 'MUTED' : 'UNMUTED'}`)
    this.systemAudioTracks.forEach(track => {
      track.enabled = !muted
    })
  }

  public toggleCameraMute(muted: boolean) {
    console.log(`[BetterShot:Recorder] toggleCameraMute: ${muted ? 'MUTED' : 'UNMUTED'}`)
    this.isCameraMuted = muted
  }

  public isCameraMutedState(): boolean {
    return this.isCameraMuted
  }

  public updateCameraConfig(updates: Partial<CameraOverlayConfig>) {
    this.activeCameraConfig = {
      ...this.activeCameraConfig,
      ...updates
    }
    console.log('[BetterShot:Recorder] Camera config updated:', this.activeCameraConfig)
  }

  public async restartRecording(): Promise<boolean> {
    console.log('[BetterShot:Recorder] Restarting recording...')
    this.cleanup()
    if (this.lastConfig) {
      return this.startRecording(this.lastConfig)
    }
    return false
  }

  public pauseRecording() {
    console.log('[BetterShot:Recorder] Pausing recording...')
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause()
      this.isPaused = true
      if (this.timerInterval) clearInterval(this.timerInterval)
    }
  }

  public resumeRecording() {
    console.log('[BetterShot:Recorder] Resuming recording...')
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume()
      this.isPaused = false
      this.startTimer()
    }
  }

  public async stopRecording(): Promise<ArrayBuffer | null> {
    console.log('[BetterShot:Recorder] Stopping recording requested...')

    // Signal cursor tracker to stop and finalize telemetry
    if (typeof window !== 'undefined' && (window as any).electronAPI?.stopCursorTracking) {
      (window as any).electronAPI.stopCursorTracking().catch((err: any) => console.warn('[BetterShot:Recorder] Error stopping cursor tracking:', err))
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        console.log('[BetterShot:Recorder] No active mediaRecorder found to stop.')
        this.cleanup()
        resolve(null)
        return
      }

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'video/webm' })
        console.log(`[BetterShot:Recorder] MediaRecorder stopped. Created Blob of size ${blob.size} bytes across ${this.recordedChunks.length} chunks.`)
        const arrayBuffer = blob.size > 0 ? await blob.arrayBuffer() : null
        this.cleanup()
        resolve(arrayBuffer)
      }

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop()
      } else {
        this.cleanup()
        resolve(null)
      }
    })
  }

  public setAudioLevelCallback(cb: (level: number) => void) {
    this.audioLevelCallback = cb
  }

  public setTimerCallback(cb: (seconds: number) => void) {
    this.timerCallback = cb
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval)
    this.startTime = Date.now() - (this.elapsedTime * 1000)

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000)
        if (this.timerCallback) {
          this.timerCallback(this.elapsedTime)
        }
      }
    }, 500)
  }

  private setupAudioMeter(stream: MediaStream) {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = this.audioContext.createMediaStreamSource(stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 64
      source.connect(this.analyser)

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

      const updateMeter = () => {
        if (!this.analyser) return
        this.analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length
        const normalized = Math.min(100, Math.round((average / 128) * 100))
        if (this.audioLevelCallback) {
          this.audioLevelCallback(normalized)
        }
        this.animFrameId = requestAnimationFrame(updateMeter)
      }

      updateMeter()
    } catch (e) {
      console.warn('[BetterShot:Recorder] Audio context setup error:', e)
    }
  }

  private cleanup() {
    console.log('[BetterShot:Recorder] Cleaning up recording streams and animation loops...')
    if (this.timerInterval) clearInterval(this.timerInterval)
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId)
    if (this.cropAnimFrameId) {
      clearInterval(this.cropAnimFrameId as any)
      cancelAnimationFrame(this.cropAnimFrameId)
      this.cropAnimFrameId = null
    }
    if (this.cropVideoElement) {
      this.cropVideoElement.pause()
      this.cropVideoElement.srcObject = null
      this.cropVideoElement = null
    }
    if (this.cameraVideoElement) {
      this.cameraVideoElement.pause()
      this.cameraVideoElement.srcObject = null
      this.cameraVideoElement = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
    if (this.mixAudioContext) {
      this.mixAudioContext.close().catch(() => {})
      this.mixAudioContext = null
    }

    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(track => track.stop())
      this.combinedStream = null
    }

    if (this.rawDesktopStream) {
      this.rawDesktopStream.getTracks().forEach(track => track.stop())
      this.rawDesktopStream = null
    }

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop())
      this.cameraStream = null
    }

    this.micAudioTracks = []
    this.systemAudioTracks = []
    this.mediaRecorder = null
    this.recordedChunks = []
    this.elapsedTime = 0
    this.isPaused = false
    console.log('[BetterShot:Recorder] Cleanup finished.')
  }
}

export const recorderService = new ScreenRecorderService()
