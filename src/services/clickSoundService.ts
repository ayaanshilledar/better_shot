import { ClickSoundType } from '../types/cursor'

class ClickSoundService {
  private audioContext: AudioContext | null = null
  private lastPlayTime = 0

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.audioContext = new AudioCtx()
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {})
    }
    return this.audioContext
  }

  /**
   * Plays a synthesized click sound in real time.
   */
  public play(type: ClickSoundType = 'mac', volume = 75) {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Debounce to prevent audio distortion on rapid spam clicks (min 40ms)
    if (now - this.lastPlayTime < 0.04) return
    this.lastPlayTime = now

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume / 100)) * 0.45, now)
    masterGain.connect(ctx.destination)

    this.synthesizeSound(ctx, masterGain, type, now)
  }

  /**
   * Renders the click sound waveform into an AudioBuffer for offline export audio mixing.
   */
  public renderToBuffer(
    ctx: BaseAudioContext,
    type: ClickSoundType = 'mac'
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate
    const duration = 0.08 // 80ms is plenty for a crisp click
    const length = Math.ceil(sampleRate * duration)
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate
      let sample = 0

      switch (type) {
        case 'mac': {
          // Sharp exponential pitch drop with snappy envelope
          const freq = 1200 * Math.exp(-t * 120) + 180
          const env = Math.exp(-t * 90)
          sample = Math.sin(2 * Math.PI * freq * t) * env
          break
        }
        case 'tap': {
          // Tactile click with rapid noise transient and high pitch ping
          const env = Math.exp(-t * 110)
          const tone = Math.sin(2 * Math.PI * 2200 * t) * 0.6
          const noise = (Math.random() * 2 - 1) * 0.4
          sample = (tone + noise) * env
          break
        }
        case 'bubble': {
          // Smooth rounded pop with upward frequency sweep
          const freq = 450 + 600 * (1 - Math.exp(-t * 80))
          const env = Math.exp(-t * 50) * Math.sin(Math.PI * Math.min(1, t / 0.02))
          sample = Math.sin(2 * Math.PI * freq * t) * env
          break
        }
        case 'mechanical':
        default: {
          // Dual tactile click: initial transient click + resonant body
          const env = Math.exp(-t * 70)
          const primary = Math.sin(2 * Math.PI * 1600 * t) * 0.7
          const body = Math.sin(2 * Math.PI * 480 * t) * 0.3
          sample = (primary + body) * env
          break
        }
      }

      data[i] = Math.max(-1, Math.min(1, sample))
    }

    return buffer
  }

  private synthesizeSound(
    ctx: AudioContext,
    destination: AudioNode,
    type: ClickSoundType,
    startTime: number
  ) {
    switch (type) {
      case 'mac': {
        // Crisp wooden pop (macOS style)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(1100, startTime)
        osc.frequency.exponentialRampToValueAtTime(160, startTime + 0.018)

        gain.gain.setValueAtTime(1.0, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.025)

        osc.connect(gain)
        gain.connect(destination)

        osc.start(startTime)
        osc.stop(startTime + 0.03)
        break
      }

      case 'tap': {
        // High frequency tactile tap
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(2200, startTime)
        osc.frequency.exponentialRampToValueAtTime(300, startTime + 0.015)

        gain.gain.setValueAtTime(0.9, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.02)

        osc.connect(gain)
        gain.connect(destination)

        osc.start(startTime)
        osc.stop(startTime + 0.025)
        break
      }

      case 'bubble': {
        // Gentle popping bubble
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(450, startTime)
        osc.frequency.exponentialRampToValueAtTime(1050, startTime + 0.02)
        osc.frequency.exponentialRampToValueAtTime(350, startTime + 0.04)

        gain.gain.setValueAtTime(0.8, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.045)

        osc.connect(gain)
        gain.connect(destination)

        osc.start(startTime)
        osc.stop(startTime + 0.05)
        break
      }

      case 'mechanical':
      default: {
        // Mechanical switch click
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()

        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(1800, startTime)
        osc1.frequency.exponentialRampToValueAtTime(400, startTime + 0.02)

        osc2.type = 'triangle'
        osc2.frequency.setValueAtTime(600, startTime)
        osc2.frequency.exponentialRampToValueAtTime(120, startTime + 0.035)

        gain.gain.setValueAtTime(0.9, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.035)

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(destination)

        osc1.start(startTime)
        osc2.start(startTime)
        osc1.stop(startTime + 0.04)
        osc2.stop(startTime + 0.04)
        break
      }
    }
  }
}

export const clickSoundService = new ClickSoundService()
