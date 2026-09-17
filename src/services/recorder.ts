export interface CaptureConfig {
  sourceId: string | null
  isDisplay: boolean
  enableCamera: boolean
  enableMic: boolean
  enableSystemAudio: boolean
  cameraId?: string
  micId?: string
}

class ScreenRecorderService {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private combinedStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private animFrameId: number | null = null
  private audioLevelCallback: ((level: number) => void) | null = null
  private timerCallback: ((seconds: number) => void) | null = null
  private startTime: number = 0
  private timerInterval: NodeJS.Timeout | null = null
  private elapsedTime: number = 0
  private isPaused: boolean = false

  public async startRecording(config: CaptureConfig): Promise<boolean> {
    try {
      this.recordedChunks = []
      this.elapsedTime = 0
      this.isPaused = false

      let videoTrack: MediaStreamTrack | null = null
      let audioTracks: MediaStreamTrack[] = []

      // 1. Screen / Display or Window Capture Stream
      if (config.sourceId) {
        const desktopStream = await (navigator.mediaDevices as any).getUserMedia({
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

        const vTracks = desktopStream.getVideoTracks()
        if (vTracks.length > 0) {
          videoTrack = vTracks[0]
        }

        if (config.enableSystemAudio) {
          const aTracks = desktopStream.getAudioTracks()
          if (aTracks.length > 0) {
            audioTracks.push(...aTracks)
          }
        }
      } else {
        // Fallback or Display media standard API
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: config.enableSystemAudio
        })
        videoTrack = displayStream.getVideoTracks()[0]
        if (config.enableSystemAudio && displayStream.getAudioTracks().length > 0) {
          audioTracks.push(displayStream.getAudioTracks()[0])
        }
      }

      // 2. Microphone Stream
      if (config.enableMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: config.micId ? { deviceId: { exact: config.micId } } : true,
            video: false
          })
          audioTracks.push(...micStream.getAudioTracks())
          this.setupAudioMeter(micStream)
        } catch (micErr) {
          console.warn('Microphone stream error:', micErr)
        }
      }

      // 3. Camera Stream (if Camera Only or Picture-in-Picture)
      if (config.enableCamera && !videoTrack) {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: config.cameraId ? { deviceId: { exact: config.cameraId } } : true,
          audio: false
        })
        videoTrack = camStream.getVideoTracks()[0]
      }

      if (!videoTrack) {
        throw new Error('No video stream source found')
      }

      // 4. Create Combined MediaStream
      this.combinedStream = new MediaStream([videoTrack, ...audioTracks])

      // 5. Select best supported mime type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ]
      let selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm'

      this.mediaRecorder = new MediaRecorder(this.combinedStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 5000000 // 5 Mbps quality
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(1000) // 1 second slice chunks
      this.startTimer()

      return true
    } catch (error) {
      console.error('Failed to start recording:', error)
      this.cleanup()
      throw error
    }
  }

  public pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause()
      this.isPaused = true
      if (this.timerInterval) clearInterval(this.timerInterval)
    }
  }

  public resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume()
      this.isPaused = false
      this.startTimer()
    }
  }

  public async stopRecording(): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanup()
        resolve(null)
        return
      }

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'video/webm' })
        const arrayBuffer = await blob.arrayBuffer()
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
      console.warn('Audio context setup error:', e)
    }
  }

  private cleanup() {
    if (this.timerInterval) clearInterval(this.timerInterval)
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId)
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(track => track.stop())
      this.combinedStream = null
    }

    this.mediaRecorder = null
    this.recordedChunks = []
    this.elapsedTime = 0
    this.isPaused = false
  }
}

export const recorderService = new ScreenRecorderService()
