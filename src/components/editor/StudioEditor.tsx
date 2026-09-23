import React, { useState, useEffect, useRef } from 'react'
import { StudioProject, StudioRuntimeState, CropRegionData, ExportProgress } from '../../types/editor'
import { createDefaultProject, loadCursorTelemetryForVideo } from '../../services/projectService'
import { createExportProcess, exportScreenshotImage } from '../../services/exportService'
import { CursorConfig, DEFAULT_CURSOR_CONFIG } from '../../types/cursor'
import { EditorTopBar } from './EditorTopBar'
import { StudioCanvas } from './StudioCanvas'
import { EditorSidebar } from './EditorSidebar'
import { EditorTimeline } from './EditorTimeline'
import { CropModal } from './CropModal'
import { ExportModal } from './ExportModal'
import { AIChatDrawer } from './AIChatDrawer'
import { AICursorOverlay, AICursorState } from './AICursorOverlay'
import { AISettingsModal } from '../AISettingsModal'
import { AIChatMessage, AIAction } from '../../types/ai'
import { planVideoEdits } from '../../services/aiService'
import { WALLPAPER_PRESETS } from '../../config/presets'

interface StudioEditorProps {
  recordingFilePath?: string
  onCloseEditor?: () => void
}

export const StudioEditor: React.FC<StudioEditorProps> = ({
  recordingFilePath,
  onCloseEditor
}) => {
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false)
  const defaultPath = recordingFilePath || 'c:\\Users\\ayaan\\Videos\\Velo\\Velo_demo.webm'
  const defaultFileName = defaultPath.split(/[\\/]/).pop() || 'recording.webm'

  // Master Project State (Persistent)
  const [project, setProject] = useState<StudioProject>(() =>
    createDefaultProject(defaultPath, defaultFileName)
  )

  useEffect(() => {
    if (recordingFilePath) {
      const fileName = recordingFilePath.split(/[\\/]/).pop() || 'recording'
      const newProj = createDefaultProject(recordingFilePath, fileName)
      setProject(newProj)
      setHistory([newProj])
      setHistoryIndex(0)
    }
  }, [recordingFilePath])

  const isImage = Boolean(
    project.media.mediaType === 'image' ||
    /\.(png|jpe?g|webp|bmp|gif)$/i.test(project.media.sourcePath || '')
  )

  // Undo / Redo History Stack
  const [history, setHistory] = useState<StudioProject[]>([project])
  const [historyIndex, setHistoryIndex] = useState<number>(0)
  const isUndoRedoRef = useRef<boolean>(false)

  // Runtime UI State (Ephemeral)
  const [runtime, setRuntime] = useState<StudioRuntimeState>({
    status: 'ready',
    currentTime: 0,
    isPlaying: false,
    selectedTab: 'background',
    selectedClipId: null,
    previewScale: 'full',
    timelineZoom: 1.0,
    hoverState: { element: null },
    isVideoSelected: false
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)

  // AI Assistant States
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false)
  const [isAISettingsOpen, setIsAISettingsOpen] = useState<boolean>(false)
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>([])
  const [isAIExecuting, setIsAIExecuting] = useState<boolean>(false)
  const [currentActionIndex, setCurrentActionIndex] = useState<number>(0)
  const [currentActions, setCurrentActions] = useState<AIAction[]>([])
  const [lastAISnapshot, setLastAISnapshot] = useState<StudioProject | null>(null)
  const [activePlanMap, setActivePlanMap] = useState<Record<string, { plan: import('../../types/ai').AIPlanResult; beforeSnapshot: StudioProject }>>({})
  const [aiCursorState, setAiCursorState] = useState<AICursorState>({
    visible: false,
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
    isClicking: false,
    currentLabel: ''
  })

  // Synchronous Project Reference for accurate verification comparisons
  const projectRef = useRef<StudioProject>(project)
  useEffect(() => {
    projectRef.current = project
  }, [project])

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const executeAIPlan = async (
    assistantMsgId: string,
    plan: import('../../types/ai').AIPlanResult,
    beforeSnapshot: StudioProject
  ) => {
    if (!plan.actions || plan.actions.length === 0) {
      setRuntime((r) => ({ ...r, selectedTab: 'ai' }))
      setAiMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, status: 'completed' } : m))
      )
      return
    }

    setIsAIExecuting(true)
    setCurrentActions(plan.actions)
    setAiMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgId
          ? {
              ...m,
              status: 'executing',
              activeActionIndex: 0
            }
          : m
      )
    )

    try {
      // Animate AI Cursor taking control of the React DOM
      for (let i = 0; i < plan.actions.length; i++) {
        const action = plan.actions[i]
        setCurrentActionIndex(i)
        setAiMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, activeActionIndex: i } : m))
        )

        // 1. Locate Target Element in DOM
        let targetSelector = ''
        if (action.type === 'switch_tab') {
          targetSelector = `button[data-tab="${action.tab}"]`
        } else if (action.type === 'set_background') {
          targetSelector = `button[data-preset-id="${action.presetId}"]`
        } else if (action.type === 'set_padding') {
          targetSelector = `input[data-control="padding"]`
        } else if (action.type === 'set_corner_radius') {
          targetSelector = `input[data-control="cornerRadius"]`
        } else if (action.type === 'set_shadow') {
          targetSelector = `button[data-control="shadow"][data-shadow-id="${action.shadow}"]`
        } else if (action.type === 'set_aspect_ratio') {
          targetSelector = `button[data-aspect-ratio="${action.aspectRatio}"]`
        } else if (action.type === 'trim_video') {
          targetSelector = `div[data-track="video"]`
        } else if (action.type === 'seek_time') {
          targetSelector = `div[data-track="video"]`
        }

        let targetRect: DOMRect | undefined
        if (targetSelector) {
          const el = document.querySelector(targetSelector)
          if (el) {
            targetRect = el.getBoundingClientRect()
          }
        }

        const fallbackX = window.innerWidth - 180
        const fallbackY = 300
        const targetX = targetRect ? targetRect.left + targetRect.width / 2 : fallbackX
        const targetY = targetRect ? targetRect.top + targetRect.height / 2 : fallbackY

        // 2. Move AI Cursor to Target
        setAiCursorState({
          visible: true,
          x: targetX,
          y: targetY,
          isClicking: false,
          currentLabel: action.label,
          targetElementRect: targetRect
            ? {
                top: targetRect.top,
                left: targetRect.left,
                width: targetRect.width,
                height: targetRect.height
              }
            : undefined
        })

        // Wait for cursor flight animation
        await sleep(450)

        // 3. Trigger Click Ripple
        setAiCursorState((prev) => ({ ...prev, isClicking: true }))
        await sleep(150)
        setAiCursorState((prev) => ({ ...prev, isClicking: false }))

        // 4. Apply Project / Runtime Update
        if (action.type === 'switch_tab') {
          setRuntime((r) => ({ ...r, selectedTab: action.tab }))
        } else if (action.type === 'set_background') {
          if (action.presetId === 'none') {
            updateProject((p) => ({
              ...p,
              background: {
                ...p.background,
                type: 'none',
                presetId: 'none',
                gradient: '',
                color: 'transparent',
                blurAmount: 0
              },
              layout: { ...p.layout, padding: 0 }
            }))
          } else {
            const preset = WALLPAPER_PRESETS.find((p) => p.id === action.presetId)
            if (preset) {
              updateProject((p) => ({
                ...p,
                background: {
                  ...p.background,
                  presetId: preset.id,
                  gradient: preset.cssValue,
                  customImageUrl: preset.url || '',
                  type: preset.type
                }
              }))
            }
          }
        } else if (action.type === 'set_padding') {
          updateProject((p) => ({
            ...p,
            layout: { ...p.layout, padding: action.padding }
          }))
        } else if (action.type === 'set_corner_radius') {
          updateProject((p) => ({
            ...p,
            layout: { ...p.layout, cornerRadius: action.cornerRadius }
          }))
        } else if (action.type === 'set_shadow') {
          updateProject((p) => ({
            ...p,
            layout: { ...p.layout, shadow: action.shadow }
          }))
        } else if (action.type === 'set_aspect_ratio') {
          updateProject((p) => ({
            ...p,
            layout: { ...p.layout, aspectRatio: action.aspectRatio }
          }))
        } else if (action.type === 'trim_video') {
          updateProject((p) => ({
            ...p,
            timeline: {
              ...p.timeline,
              trimRange: { start: action.start, end: action.end }
            }
          }))
          handleSeek(action.start)
        } else if (action.type === 'seek_time') {
          handleSeek(action.time)
        } else if (action.type === 'undo') {
          handleUndoLastAIEdit()
        }

        // Short pause between actions for visual observation
        await sleep(300)
      }

      // 5. Verification Phase: Compare state diff and validate expectations
      setAiCursorState((prev) => ({ ...prev, visible: false, targetElementRect: undefined }))
      setAiMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, status: 'verifying' } : m))
      )
      await sleep(350)

      const verification = (await import('../../services/aiService')).verifyProjectChanges(
        beforeSnapshot,
        projectRef.current,
        plan.expectedChanges
      )

      setIsAIExecuting(false)
      setRuntime((r) => ({ ...r, selectedTab: 'ai' }))
      setAiMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                status: 'completed',
                verification,
                suggestions: plan.proactiveSuggestions
              }
            : m
        )
      )
    } catch (err: any) {
      console.error('[BetterShot:AI] Action execution error:', err)
      setAiCursorState((prev) => ({ ...prev, visible: false }))
      setIsAIExecuting(false)
      setRuntime((r) => ({ ...r, selectedTab: 'ai' }))
      setAiMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, status: 'failed', error: err?.message || 'Failed to complete actions' }
            : m
        )
      )
    }
  }

  const handleSendMessage = async (text: string) => {
    const userMsgId = `user_${Date.now()}`
    const assistantMsgId = `ai_${Date.now()}`

    const userMessage: AIChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: text,
      timestamp: Date.now()
    }

    const initialAssistantMessage: AIChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      content: 'Analyzing your video framing, aesthetics & intent...',
      timestamp: Date.now(),
      status: 'thinking'
    }

    setAiMessages((prev) => [...prev, userMessage, initialAssistantMessage])

    // Take snapshot for Undo & Verification
    const beforeSnapshot = JSON.parse(JSON.stringify(project))
    setLastAISnapshot(beforeSnapshot)

    try {
      const recentHistory = aiMessages
        .filter((m) => m.status === 'completed' || (m.sender === 'user' && m.id !== userMsgId))
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content
        }))

      const plan = await planVideoEdits(text, project, {
        currentTime: runtime.currentTime,
        isImage,
        conversationHistory: recentHistory
      })

      // Store plan in activePlanMap for potential confirmation
      setActivePlanMap((prev) => ({
        ...prev,
        [assistantMsgId]: { plan, beforeSnapshot }
      }))

      if (plan.autoApply) {
        // User explicitly permitted immediate execution or toggle is active
        setAiMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: plan.message,
                  thoughtProcess: plan.thoughtProcess,
                  actions: plan.actions,
                  suggestions: plan.proactiveSuggestions,
                  status: 'executing'
                }
              : m
          )
        )
        await executeAIPlan(assistantMsgId, plan, beforeSnapshot)
      } else {
        // Require interactive confirmation for full transparency & credibility
        setAiMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: plan.message,
                  thoughtProcess: plan.thoughtProcess,
                  actions: plan.actions,
                  suggestions: plan.proactiveSuggestions,
                  status: 'awaiting_confirmation'
                }
              : m
          )
        )
      }
    } catch (err: any) {
      console.error('[BetterShot:AI] Planning error:', err)
      setAiMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, status: 'failed', error: err?.message || 'Failed to plan actions' }
            : m
        )
      )
    }
  }

  const handleConfirmAIPlan = async (messageId: string) => {
    const entry = activePlanMap[messageId]
    if (!entry) return
    const { plan, beforeSnapshot } = entry
    setLastAISnapshot(beforeSnapshot)
    await executeAIPlan(messageId, plan, beforeSnapshot)
  }

  const handleDismissAIPlan = (messageId: string) => {
    setAiMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              status: 'completed',
              content: m.content + '\n\n*(Plan dismissed without applying changes)*'
            }
          : m
      )
    )
  }

  const handleUndoLastAIEdit = () => {
    if (lastAISnapshot) {
      setProject(lastAISnapshot)
      setLastAISnapshot(null)
      setAiMessages((prev) => [
        ...prev,
        {
          id: `sys_${Date.now()}`,
          sender: 'system',
          content: '↺ Successfully reverted the last AI edits.',
          timestamp: Date.now()
        }
      ])
    } else {
      handleUndo()
    }
  }

  // Update project & push to history stack (supports skipHistory for smooth drag rendering)
  const updateProject = (
    updater: (prev: StudioProject) => StudioProject,
    skipHistory = false
  ) => {
    setProject((prevProject) => {
      const next = updater(prevProject)
      next.updatedAt = Date.now()

      if (!isUndoRedoRef.current && !skipHistory) {
        setHistory((prevHistory) => {
          const validIndex = Math.max(0, Math.min(historyIndex, prevHistory.length - 1))
          const sliced = prevHistory.slice(0, validIndex + 1)
          return [...sliced, next]
        })
        setHistoryIndex((prevIndex) => prevIndex + 1)
      }
      isUndoRedoRef.current = false
      return next
    })
  }

  // Handle Undo (Ctrl+Z)
  const handleUndo = () => {
    if (historyIndex > 0 && history[historyIndex - 1]) {
      isUndoRedoRef.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setProject(history[newIndex])
    }
  }

  // Handle Redo (Ctrl+Y)
  const handleRedo = () => {
    if (historyIndex < history.length - 1 && history[historyIndex + 1]) {
      isUndoRedoRef.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setProject(history[newIndex])
    }
  }

  // Keybindings for Space (Play/Pause), Undo, Redo, AI Assistant (Ctrl+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        handleTogglePlay()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setIsAIOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        if (isAIOpen) setIsAIOpen(false)
        else if (onCloseEditor) onCloseEditor()
        else if (window.electronAPI?.closeEditorWindow) window.electronAPI.closeEditorWindow()
        else window.electronAPI?.closeLauncher()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history, runtime.isPlaying, isAIOpen])

  // 60FPS Smooth playback loop for continuous playhead & time animation
  useEffect(() => {
    if (!runtime.isPlaying) return

    let animId: number
    const syncTime = () => {
      if (videoRef.current && !videoRef.current.paused) {
        const curTime = videoRef.current.currentTime
        const trimEnd = project.timeline.trimRange?.end
        if (trimEnd && curTime >= trimEnd) {
          const trimStart = project.timeline.trimRange?.start ?? 0
          videoRef.current.currentTime = trimStart
          setRuntime((r) => ({ ...r, currentTime: trimStart }))
        } else {
          setRuntime((r) => ({ ...r, currentTime: curTime }))
        }
      }
      animId = requestAnimationFrame(syncTime)
    }

    animId = requestAnimationFrame(syncTime)
    return () => cancelAnimationFrame(animId)
  }, [runtime.isPlaying, project.timeline.trimRange])

  // Play/Pause Video toggle
  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (runtime.isPlaying) {
        videoRef.current.pause()
        setRuntime((r) => ({ ...r, isPlaying: false }))
      } else {
        videoRef.current.play().catch((err) => console.warn('Video play error:', err))
        setRuntime((r) => ({ ...r, isPlaying: true }))
      }
    }
  }

  // Video duration & time listener
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      let dur = video.duration
      if (!Number.isFinite(dur) || dur <= 0) {
        if (video.seekable && video.seekable.length > 0) {
          dur = video.seekable.end(0)
        }
      }

      const w = video.videoWidth || 1920
      const h = video.videoHeight || 1080

      updateProject((p) => ({
        ...p,
        media: {
          ...p.media,
          duration: Number.isFinite(dur) && dur > 0 ? dur : p.media.duration,
          width: w,
          height: h
        }
      }))
    }

    const handleEnded = () => {
      setRuntime((r) => ({ ...r, isPlaying: false, currentTime: 0 }))
      if (videoRef.current) videoRef.current.currentTime = 0
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('durationchange', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('durationchange', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
    }
  }, [videoRef.current])

  // Automatically load sidecar cursor telemetry if available
  useEffect(() => {
    if (project.media.sourcePath) {
      loadCursorTelemetryForVideo(project.media.sourcePath).then((data) => {
        if (data && Array.isArray(data.samples)) {
          updateProject((p) => ({ ...p, cursorData: data }), true)
        }
      })
    }
  }, [project.media.sourcePath])

  const handleUpdateCursorConfig = (updates: Partial<CursorConfig>) => {
    updateProject((p) => ({
      ...p,
      cursorConfig: {
        ...(p.cursorConfig || DEFAULT_CURSOR_CONFIG),
        ...updates
      }
    }))
  }

  const handleSeek = (time: number) => {
    if (videoRef.current && Number.isFinite(time)) {
      videoRef.current.currentTime = time
    }

    setRuntime((r) => ({ ...r, currentTime: Number.isFinite(time) ? time : 0 }))
  }

  const handleDeleteProject = async () => {
    if (confirm(`Are you sure you want to delete "${project.title}"?`)) {
      if (window.electronAPI?.deleteRecording && project.media.sourcePath) {
        await window.electronAPI.deleteRecording(project.media.sourcePath)
      }
      if (onCloseEditor) onCloseEditor()
      else if (window.electronAPI?.closeEditorWindow) window.electronAPI.closeEditorWindow()
      else window.electronAPI?.closeLauncher()
    }
  }

  const handleAutoFormat = () => {
    updateProject((p) => ({
      ...p,
      layout: {
        ...p.layout,
        padding: 10,
        cornerRadius: 12,
        shadow: 'medium'
      }
    }))
  }

  const handleToggleCrop = () => {
    setIsCropModalOpen(true)
  }

  const handleApplyCrop = (cropData: CropRegionData) => {
    updateProject((p) => ({
      ...p,
      layout: {
        ...p.layout,
        aspectRatio: cropData.aspectRatio as any,
        cropRegion: cropData
      }
    }))
  }

  const handleToggleFrame = () => {
    const nextRadius = project.layout.cornerRadius > 0 ? 0 : 16
    updateProject((p) => ({
      ...p,
      layout: { ...p.layout, cornerRadius: nextRadius }
    }))
  }

  // Export State and Handlers
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    progress: 0,
    currentTime: 0,
    totalDuration: 1,
    fps: 60,
    etaSeconds: 0,
    phase: 'preparing'
  })
  const exportCancelRef = useRef<(() => void) | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const handleStartExport = () => {
    setIsExportModalOpen(true)
    const currentSettings = {
      format: project.exportSettings?.format || 'mp4',
      resolution: project.exportSettings?.resolution || '1080p',
      fps: project.exportSettings?.fps || 60,
      bitratePreset: project.exportSettings?.bitratePreset || 'high',
      customBitrateMbps: project.exportSettings?.customBitrateMbps || 12,
      includeAudio: project.exportSettings?.includeAudio ?? true,
      audioBitrateKbps: project.exportSettings?.audioBitrateKbps || 192,
      saveLocation: project.exportSettings?.saveLocation
    }

    const { promise, cancel } = createExportProcess(
      project,
      currentSettings,
      (prog) => setExportProgress(prog),
      (canvas) => {
        previewCanvasRef.current = canvas
      }
    )

    exportCancelRef.current = cancel
    promise.catch((err) => {
      console.error('Export error:', err)
    })
  }

  const handleCancelExport = () => {
    if (exportCancelRef.current) {
      exportCancelRef.current()
      exportCancelRef.current = null
    }
  }

  const handleCloseExportModal = () => {
    handleCancelExport()
    setIsExportModalOpen(false)
  }

  const handleExportImage = async (action: 'save' | 'copy') => {
    try {
      const blob = await exportScreenshotImage(project, project.exportSettings.resolution)
      const arrayBuffer = await blob.arrayBuffer()
      const format = project.exportSettings.format === 'jpeg' ? 'jpeg' : 'png'
      const defaultName = `${project.title || 'screenshot'}.${format}`

      if (action === 'copy') {
        if (window.electronAPI?.copyImageToClipboard) {
          const success = await window.electronAPI.copyImageToClipboard(arrayBuffer)
          if (success) {
            alert('Framed screenshot copied to clipboard!')
          } else {
            alert('Failed to copy screenshot to clipboard.')
          }
        } else {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob })
            ])
            alert('Framed screenshot copied to clipboard!')
          } catch (e) {
            alert('Clipboard copy not supported in this environment.')
          }
        }
      } else if (action === 'save') {
        let targetPath: string | undefined = undefined
        if (window.electronAPI?.showSaveDialog) {
          const saveDialogRes = await window.electronAPI.showSaveDialog(defaultName, format)
          if (saveDialogRes.canceled || !saveDialogRes.filePath) {
            return
          }
          targetPath = saveDialogRes.filePath
        }

        if (window.electronAPI?.saveExportedImage) {
          const res = await window.electronAPI.saveExportedImage(arrayBuffer, defaultName, targetPath)
          if (res?.success) {
            alert('Framed screenshot saved successfully!')
          } else if (res?.error && res.error !== 'Cancelled') {
            alert('Failed to save image: ' + res.error)
          }
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = defaultName
          a.click()
          URL.revokeObjectURL(url)
        }
      }
    } catch (err: any) {
      console.error('Image export error:', err)
      alert('Failed to export screenshot: ' + (err?.message || 'Unknown error'))
    }
  }

  // Sidebar Resizing State & Handlers (Min: 280px, Max: 600px, Default: 340px)
  const DEFAULT_SIDEBAR_WIDTH = 340
  const MIN_SIDEBAR_WIDTH = 280
  const MAX_SIDEBAR_WIDTH = 600

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('velo_sidebar_width') || localStorage.getItem('bettershot_sidebar_width')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          return parsed
        }
      }
    }
    return DEFAULT_SIDEBAR_WIDTH
  })
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false)

  const handleSidebarResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsResizingSidebar(true)

    const startX = e.clientX
    const startWidth = sidebarWidth

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = startX - moveEvent.clientX
      const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.48))
      const nextWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, startWidth + deltaX))
      setSidebarWidth(nextWidth)
    }

    const onPointerUp = () => {
      setIsResizingSidebar(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      setSidebarWidth((latestWidth) => {
        try {
          localStorage.setItem('velo_sidebar_width', latestWidth.toString())
        } catch {}
        return latestWidth
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleResetSidebarWidth = () => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
    try {
      localStorage.setItem('velo_sidebar_width', DEFAULT_SIDEBAR_WIDTH.toString())
    } catch {}
  }

  return (
    <div className={`w-screen h-screen bg-slate-100 dark:bg-[#0d0d11] text-slate-900 dark:text-white flex flex-col overflow-hidden font-sans select-none relative ${isResizingSidebar ? 'cursor-col-resize select-none' : ''}`}>
      {/* Top Navigation & Action Header */}
      <EditorTopBar
        project={project}
        runtime={runtime}
        onUpdateTitle={(title) => updateProject((p) => ({ ...p, title }))}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onExport={() => setRuntime((r) => ({ ...r, selectedTab: 'export' }))}
        onScaleChange={(scale) => setRuntime((r) => ({ ...r, previewScale: scale }))}
        onClose={() => {
          if (onCloseEditor) onCloseEditor()
          else if (window.electronAPI?.closeEditorWindow) window.electronAPI.closeEditorWindow()
          else window.electronAPI?.closeLauncher()
        }}
        onMinimize={() => window.electronAPI?.minimizeLauncher()}
        onDeleteProject={handleDeleteProject}
        onSelectTab={(tab) => setRuntime((r) => ({ ...r, selectedTab: tab }))}
        onAutoFormat={handleAutoFormat}
        onToggleCrop={handleToggleCrop}
        onToggleFrame={handleToggleFrame}
        onToggleAI={() => setIsAIOpen((prev) => !prev)}
        isAIOpen={isAIOpen}
      />

      {/* Main Studio Middle Area: Stage + Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <StudioCanvas
          project={project}
          runtime={runtime}
          videoRef={videoRef}
          onTogglePlay={handleTogglePlay}
          onTimeUpdate={(t) => setRuntime((r) => ({ ...r, currentTime: t }))}
          onSeek={handleSeek}
          onZoomChange={(zoom) => setRuntime((r) => ({ ...r, timelineZoom: zoom }))}
          onSelectVideo={() => setRuntime((r) => ({ ...r, isVideoSelected: true }))}
          onDeselectVideo={() => setRuntime((r) => ({ ...r, isVideoSelected: false }))}
          onUpdateLayout={(updates, skipHistory) =>
            updateProject(
              (p) => ({
                ...p,
                layout: { ...p.layout, ...updates }
              }),
              skipHistory
            )
          }
          onToggleCrop={handleToggleCrop}
          onScaleChange={(scale) => setRuntime((r) => ({ ...r, previewScale: scale }))}
        />

        {/* Resizable Divider Handle */}
        <div
          onPointerDown={handleSidebarResizeStart}
          onDoubleClick={handleResetSidebarWidth}
          className="relative group w-2 bg-transparent hover:bg-blue-500/10 active:bg-blue-500/20 cursor-col-resize z-30 flex items-center justify-center transition-colors shrink-0 -ml-1 -mr-1"
          title="Drag to resize panel (Double-click to reset)"
        >
          {/* Visual indicator bar */}
          <div
            className={`w-[2px] h-8 rounded-full transition-all ${
              isResizingSidebar
                ? 'bg-blue-500 shadow-sm shadow-blue-500/50 scale-y-125'
                : 'bg-transparent group-hover:bg-slate-400/60 dark:group-hover:bg-zinc-500/60'
            }`}
          />
        </div>

        <EditorSidebar
          width={sidebarWidth}
          project={project}
          runtime={runtime}
          onExport={handleStartExport}
          onExportImage={handleExportImage}
          onUpdateExportSettings={(updates) =>
            updateProject((p) => ({
              ...p,
              exportSettings: { ...p.exportSettings, ...updates }
            }))
          }
          onUpdateBackground={(updates) =>
            updateProject((p) => ({
              ...p,
              background: { ...p.background, ...updates }
            }))
          }
          onUpdateLayout={(updates) =>
            updateProject((p) => ({
              ...p,
              layout: { ...p.layout, ...updates }
            }))
          }
          onSelectTab={(tab) => setRuntime((r) => ({ ...r, selectedTab: tab }))}
          onUpdateCursorConfig={handleUpdateCursorConfig}
          onToggleAI={() => setIsAIOpen((prev) => !prev)}
          isAIOpen={isAIOpen}
          onOpenAISettings={() => setIsAISettingsOpen(true)}
          onSendMessage={handleSendMessage}
          onConfirmPlan={handleConfirmAIPlan}
          onDismissPlan={handleDismissAIPlan}
          isAIExecuting={isAIExecuting}
          onUndoLastAIEdit={handleUndoLastAIEdit}
          canUndoAI={Boolean(lastAISnapshot || historyIndex > 0)}
          aiMessages={aiMessages}
        />

      </div>

      {/* Bottom Timeline Section (Videos only) */}
      {!isImage && (
        <EditorTimeline
          project={project}
          runtime={runtime}
          onSeek={handleSeek}
        />
      )}

      {/* Crop Modal Dialog */}
      <CropModal
        isOpen={isCropModalOpen}
        onClose={() => setIsCropModalOpen(false)}
        project={project}
        onApplyCrop={handleApplyCrop}
      />

      {/* Export Progress Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        onCancel={handleCancelExport}
        progress={exportProgress}
        project={project}
        settings={project.exportSettings}
        previewCanvasRef={previewCanvasRef}
      />

      {/* Visual AI Cursor DOM Overlay */}
      <AICursorOverlay cursorState={aiCursorState} />

      {/* Floating AI Chat Drawer */}
      <AIChatDrawer
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        onSendMessage={handleSendMessage}
        onConfirmPlan={handleConfirmAIPlan}
        onDismissPlan={handleDismissAIPlan}
        messages={aiMessages}
        isExecuting={isAIExecuting}
        currentActionIndex={currentActionIndex}
        currentActions={currentActions}
        onOpenSettings={() => setIsAISettingsOpen(true)}
        onUndoLastAIEdit={handleUndoLastAIEdit}
        canUndo={Boolean(lastAISnapshot || historyIndex > 0)}
      />

      {/* Standalone AI Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
      />
    </div>
  )
}
