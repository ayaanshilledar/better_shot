import React, { useState, useEffect } from 'react'
import {
  Square,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Trash2
} from 'lucide-react'
import { recorderService } from '../services/recorder'

interface RecordingOverlayProps {
  onStop: () => void
  onCancel: () => void
}

export const RecordingOverlay: React.FC<RecordingOverlayProps> = ({
  onStop,
  onCancel
}) => {
  const [seconds, setSeconds] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    // Listen for live timer relay from main process
    if (window.electronAPI?.onTimerUpdate) {
      const unsubTimer = window.electronAPI.onTimerUpdate((sec) => {
        setSeconds(sec)
        // Reset countdown when active recording timer starts
        setCountdown(null)
      })
      const unsubAudio = window.electronAPI.onAudioLevelUpdate?.((level) => {
        setAudioLevel(level)
      })
      const unsubPaused = window.electronAPI.onPausedStateUpdate?.((paused) => {
        setIsPaused(paused)
      })
      const unsubMuted = window.electronAPI.onMutedStateUpdate?.((muted) => {
        setIsMuted(muted)
      })
      return () => {
        unsubTimer()
        if (unsubAudio) unsubAudio()
        if (unsubPaused) unsubPaused()
        if (unsubMuted) unsubMuted()
      }
    }
  }, [])

  // Listen for countdown updates from main process
  useEffect(() => {
    if (window.electronAPI?.onCountdownUpdate) {
      const unsub = window.electronAPI.onCountdownUpdate((val) => {
        console.log('[BetterShot:Overlay] Countdown value received:', val)
        setCountdown(val > 0 ? val : null)
      })
      return () => unsub()
    }
  }, [])

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleTogglePause = () => {
    if (isPaused) {
      console.log('[BetterShot:Overlay] Resume button clicked -> IPC relay')
      window.electronAPI?.sendOverlayControl('resume')
      setIsPaused(false)
    } else {
      console.log('[BetterShot:Overlay] Pause button clicked -> IPC relay')
      window.electronAPI?.sendOverlayControl('pause')
      setIsPaused(true)
    }
  }

  const handleToggleMicMute = () => {
    const nextMuted = !isMuted
    console.log(`[BetterShot:Overlay] Mic mute toggle clicked -> IPC relay (${nextMuted ? 'MUTE' : 'UNMUTE'})`)
    setIsMuted(nextMuted)
    window.electronAPI?.sendOverlayControl(nextMuted ? 'mute-mic' : 'unmute-mic')
  }

  const handleStopRecording = () => {
    console.log('[BetterShot:Overlay] Stop & Save Recording clicked -> IPC relay')
    window.electronAPI?.sendOverlayControl('stop')
    if (onStop) onStop()
  }

  const handleRestartRecording = () => {
    console.log('[BetterShot:Overlay] Restart Recording clicked -> IPC relay')
    setSeconds(0)
    setIsPaused(false)
    window.electronAPI?.sendOverlayControl('restart')
  }

  const handleDiscardRecording = () => {
    console.log('[BetterShot:Overlay] Discard Recording clicked -> IPC relay')
    window.electronAPI?.sendOverlayControl('discard')
    if (onCancel) onCancel()
  }

  if (countdown !== null && countdown > 0) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-transparent select-none font-sans pointer-events-none">
        <div className="w-28 h-28 rounded-3xl bg-[#101216]/90 border border-white/20 backdrop-blur-2xl flex items-center justify-center shadow-2xl animate-in zoom-in-75 duration-150">
          <span className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">
            {countdown}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="drag-region w-full h-full flex items-center justify-center select-none font-sans">
      <div className="bg-[#101216]/95 backdrop-blur-xl border border-white/10 px-3.5 py-1.5 rounded-xl flex items-center gap-2.5 shadow-2xl text-white">
        {/* Stop Recording & Live Timer */}
        <button
          onClick={handleStopRecording}
          className="no-drag flex items-center gap-1.5 group px-1.5 py-0.5 rounded-lg hover:bg-rose-500/10 transition-colors"
          title="Stop & Save Recording"
        >
          <div className="relative flex items-center justify-center w-4 h-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
            <div className="relative inline-flex rounded-full w-3.5 h-3.5 bg-rose-500 items-center justify-center text-white shadow-md">
              <Square className="w-1.5 h-1.5 fill-white text-white" />
            </div>
          </div>
          <span className="font-bold text-xs text-rose-400 tracking-tight font-mono">
            {formatTimer(seconds)}
          </span>
        </button>

        {/* Mic toggle & Live Level Meter */}
        <div className="no-drag relative flex flex-col items-center group">
          <button
            onClick={handleToggleMicMute}
            className="p-1 rounded-md text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? (
              <MicOff className="w-4 h-4 text-rose-400" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Dynamic Audio Level Meter Line below mic */}
          {!isMuted && (
            <div className="w-4 h-0.5 bg-white/20 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-blue-500 transition-all duration-75"
                style={{ width: `${Math.max(10, audioLevel)}%` }}
              />
            </div>
          )}
        </div>

        {/* Pause / Resume Button */}
        <button
          onClick={handleTogglePause}
          className="p-1 rounded-md text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          title={isPaused ? 'Resume Recording' : 'Pause Recording'}
        >
          {isPaused ? (
            <Play className="w-4 h-4 fill-gray-300" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
        </button>

        {/* Restart Button */}
        <button
          onClick={handleRestartRecording}
          className="p-1 rounded-md text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          title="Restart Recording"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Trash / Delete Button */}
        <button
          onClick={handleDiscardRecording}
          className="p-1 rounded-md text-gray-300 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
          title="Discard Recording"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
