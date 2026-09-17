import { CropRegion } from '../../electron/preload'

export interface CaptureConfig {
  sourceId: string | null
  isDisplay: boolean
  enableCamera: boolean
  enableMic: boolean
  enableSystemAudio: boolean
  cameraId?: string
  micId?: string
  cropRegion?: CropRegion
}

class ScreenRecorderService {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private combinedStream: MediaStream | null = null
  private rawDesktopStream: MediaStream | null = null
  private micAudioTracks: MediaStreamTrack[] = []
  private systemAudioTracks: MediaStreamTrack[] = []
  private audioContext: AudioContext | null = null
  private mixAudioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private animFrameId: number | null = null
  private cropAnimFrameId: number | null = null
  private cropVideoElement: HTMLVideoElement | null = null
  private audioLevelCallback: ((level: number) => void) | null = null
  private timerCallback: ((seconds: number) => void) | null = null
  private startTime: number = 0
  private timerInterval: NodeJS.Timeout | null = null
  private elapsedTime: number = 0
  private isPaused: boolean = false
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

      // 2b. Process Area Crop Mode if cropRegion is specified
      if (config.cropRegion && videoTrack) {
        console.log('[BetterShot:Recorder] Setting up real-time Area Canvas Cropping...', config.cropRegion)
        const croppedTrack = await this.setupAreaCropping(videoTrack, config.cropRegion)
        if (croppedTrack) {
          videoTrack = croppedTrack
          console.log('[BetterShot:Recorder] Canvas Area Cropped video track active!')
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
      console.log('[BetterShot:Recorder] MediaRecorder started successfully!')

      return true
    } catch (error) {
      console.error('[BetterShot:Recorder] Failed to start recording:', error)
      this.cleanup()
      throw error
    }
  }

  private async setupAreaCropping(rawVideoTrack: MediaStreamTrack, crop: CropRegion): Promise<MediaStreamTrack | null> {
    return new Promise((resolve) => {
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

      let isResolved = false

      const startCropping = async () => {
        if (isResolved) return
        isResolved = true

        try {
          await video.play()
        } catch (e) {
          console.warn('[BetterShot:Recorder] Video play error during area crop setup:', e)
        }

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const targetW = Math.max(2, Math.round(crop.width))
        const targetH = Math.max(2, Math.round(crop.height))
        canvas.width = targetW
        canvas.height = targetH

        const videoW = video.videoWidth > 0 ? video.videoWidth : crop.screenWidth
        const videoH = video.videoHeight > 0 ? video.videoHeight : crop.screenHeight

        const scaleX = videoW / crop.screenWidth
        const scaleY = videoH / crop.screenHeight

        const srcX = Math.round(crop.x * scaleX)
        const srcY = Math.round(crop.y * scaleY)
        const srcW = Math.round(crop.width * scaleX)
        const srcH = Math.round(crop.height * scaleY)

        console.log(`[BetterShot:Recorder] Canvas crop mapping: Screen ${crop.screenWidth}x${crop.screenHeight}, Video ${videoW}x${videoH}, Crop (${srcX}, ${srcY}, ${srcW}, ${srcH}) -> Canvas (${targetW}x${targetH})`)

        const renderFrame = () => {
          if (ctx) {
            try {
              ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH)
            } catch (err) {
              console.warn('[BetterShot:Recorder] drawImage error:', err)
            }
          }
        }

        // Render initial frame
        renderFrame()

        // Use setInterval (60fps) so rendering continues reliably even when launcher window is hidden
        if (this.cropAnimFrameId) {
          clearInterval(this.cropAnimFrameId as any)
          cancelAnimationFrame(this.cropAnimFrameId)
        }
        this.cropAnimFrameId = window.setInterval(renderFrame, 1000 / 60) as any

        const canvasStream = canvas.captureStream(60)
        const croppedTrack = canvasStream.getVideoTracks()[0] || null
        resolve(croppedTrack)
      }

      if (video.readyState >= 1 && video.videoWidth > 0) {
        startCropping()
      } else {
        video.onloadedmetadata = () => startCropping()
        video.onloadeddata = () => startCropping()
        setTimeout(() => {
          startCropping()
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
