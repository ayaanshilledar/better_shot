import { useState, useEffect, useCallback } from 'react'

export interface DeviceInfo {
  deviceId: string
  label: string
}

export function useMediaDevices() {
  const [cameras, setCameras] = useState<DeviceInfo[]>([])
  const [mics, setMics] = useState<DeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [selectedMicId, setSelectedMicId] = useState<string>('')

  const refreshDevices = useCallback(async () => {
    try {
      // Prompt permissions if needed to get full device labels
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      const videoDevices = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`
        }))

      const audioDevices = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`
        }))

      setCameras(videoDevices)
      setMics(audioDevices)

      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId)
      }
      if (audioDevices.length > 0 && !selectedMicId) {
        setSelectedMicId(audioDevices[0].deviceId)
      }
    } catch (err) {
      console.warn('Error enumerating media devices:', err)
    }
  }, [selectedCameraId, selectedMicId])

  useEffect(() => {
    refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
    }
  }, [refreshDevices])

  return {
    cameras,
    mics,
    selectedCameraId,
    setSelectedCameraId,
    selectedMicId,
    setSelectedMicId,
    refreshDevices
  }
}
