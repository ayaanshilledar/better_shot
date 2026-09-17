import React, { useState, useEffect } from 'react'
import {
  Square,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Settings,
  MoreVertical
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

  useEffect(() => {
    recorderService.setTimerCallback((sec) => {
      setSeconds(sec)
    })

    recorderService.setAudioLevelCallback((level) => {
      setAudioLevel(level)
    })
  }, [])

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleTogglePause = () => {
    if (isPaused) {
      recorderService.resumeRecording()
      setIsPaused(false)
    } else {
      recorderService.pauseRecording()
      setIsPaused(true)
    }
  }

  return (
    <div className="drag-region w-full h-full flex items-center justify-center p-1 select-none">
      <div className="glass-pill px-4 py-2 rounded-full flex items-center gap-3.5 shadow-2xl text-gray-800 border border-white/60">
        {/* Stop Recording & Live Timer */}
        <button
          onClick={onStop}
          className="no-drag flex items-center gap-2 group p-1 -ml-1 rounded-full hover:bg-rose-50 transition-colors"
          title="Stop & Save Recording"
        >
          <div className="relative flex items-center justify-center w-6 h-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <div className="relative inline-flex rounded-full w-5 h-5 bg-rose-500 items-center justify-center text-white shadow-md">
              <Square className="w-2.5 h-2.5 fill-white" />
            </div>
          </div>
          <span className="font-bold text-sm text-rose-500 tracking-tight font-mono">
            {formatTimer(seconds)}
          </span>
        </button>

        {/* Mic toggle & Live Level Meter */}
        <div className="no-drag relative flex flex-col items-center group">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-full text-gray-700 hover:text-black hover:bg-black/5 transition-colors"
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? (
              <MicOff className="w-4 h-4 text-rose-500" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Dynamic Audio Level Meter Line below mic */}
          {!isMuted && (
            <div className="w-4 h-0.5 bg-gray-200 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-blue-600 transition-all duration-75"
                style={{ width: `${Math.max(10, audioLevel)}%` }}
              />
            </div>
          )}
        </div>

        {/* Pause / Resume Button */}
        <button
          onClick={handleTogglePause}
          className="no-drag p-1.5 rounded-full text-gray-700 hover:text-black hover:bg-black/5 transition-colors"
          title={isPaused ? 'Resume Recording' : 'Pause Recording'}
        >
          {isPaused ? (
            <Play className="w-4 h-4 fill-gray-700" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
        </button>

        {/* Restart Button */}
        <button
          onClick={() => {
            setSeconds(0)
            recorderService.startRecording({
              sourceId: null,
              isDisplay: true,
              enableCamera: false,
              enableMic: true,
              enableSystemAudio: true
            })
          }}
          className="no-drag p-1.5 rounded-full text-gray-700 hover:text-black hover:bg-black/5 transition-colors"
          title="Restart Recording"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Trash / Delete Button */}
        <button
          onClick={onCancel}
          className="no-drag p-1.5 rounded-full text-gray-700 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="Discard Recording"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />

        {/* Settings Button */}
        <button
          className="no-drag p-1.5 rounded-full text-gray-700 hover:text-black hover:bg-black/5 transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Overflow Menu */}
        <button
          className="no-drag p-1.5 rounded-full text-gray-700 hover:text-black hover:bg-black/5 transition-colors"
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
