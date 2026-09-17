import React, { useState, useEffect, useRef } from 'react'
import { X, RotateCcw, Maximize2, Check } from 'lucide-react'
import { StudioProject, CropRegionData } from '../../types/editor'

interface CropModalProps {
  isOpen: boolean
  onClose: () => void
  project: StudioProject
  onApplyCrop: (cropData: CropRegionData) => void
}

const ASPECT_RATIO_PRESETS = [
  { id: 'Free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 / 1 },
  { id: '2:1', label: '2:1', ratio: 2 / 1 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '16:10', label: '16:10', ratio: 16 / 10 },
  { id: '21:9', label: '21:9', ratio: 21 / 9 }
]

export const CropModal: React.FC<CropModalProps> = ({
  isOpen,
  onClose,
  project,
  onApplyCrop
}) => {
  const [selectedRatio, setSelectedRatio] = useState<string>('4:3')
  const [snapToRatios, setSnapToRatios] = useState<boolean>(true)

  // Crop Region State (relative to video dimensions, e.g. 1920x1080)
  const videoW = project.media.width || 1920
  const videoH = project.media.height || 1080

  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 241,
    y: 0,
    width: 1441,
    height: 1080
  })

  // Dragging state
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragHandle, setDragHandle] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; initialCrop: typeof crop }>({
    mouseX: 0,
    mouseY: 0,
    initialCrop: crop
  })

  const videoStageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (project.layout.cropRegion) {
      setCrop({
        x: project.layout.cropRegion.x,
        y: project.layout.cropRegion.y,
        width: project.layout.cropRegion.width,
        height: project.layout.cropRegion.height
      })
      if (project.layout.cropRegion.aspectRatio) {
        setSelectedRatio(project.layout.cropRegion.aspectRatio)
      }
    }
  }, [project.layout.cropRegion, isOpen])

  if (!isOpen) return null

  const mediaUrl = project.media.sourcePath ? `file:///${project.media.sourcePath.replace(/\\/g, '/')}` : ''

  // Aspect ratio change handler
  const handleSelectAspect = (presetId: string, ratioVal: number | null) => {
    setSelectedRatio(presetId)
    if (ratioVal) {
      let newW = crop.width
      let newH = Math.round(newW / ratioVal)
      if (newH > videoH) {
        newH = videoH
        newW = Math.round(newH * ratioVal)
      }
      setCrop((prev) => ({
        ...prev,
        width: newW,
        height: newH,
        x: Math.max(0, Math.min(videoW - newW, prev.x)),
        y: Math.max(0, Math.min(videoH - newH, prev.y))
      }))
    }
  }

  // Quick Action Handlers
  const handleCenter = () => {
    setCrop((prev) => ({
      ...prev,
      x: Math.round((videoW - prev.width) / 2),
      y: Math.round((videoH - prev.height) / 2)
    }))
  }

  const handleFull = () => {
    setSelectedRatio('Free')
    setCrop({
      x: 0,
      y: 0,
      width: videoW,
      height: videoH
    })
  }

  const handleReset = () => {
    setSelectedRatio('4:3')
    setCrop({
      x: 241,
      y: 0,
      width: 1441,
      height: 1080
    })
  }

  // Handle Dragging Crop Handles
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragHandle(handle)
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialCrop: { ...crop }
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !videoStageRef.current) return
    const rect = videoStageRef.current.getBoundingClientRect()
    const scaleX = videoW / rect.width
    const scaleY = videoH / rect.height

    const dx = Math.round((e.clientX - dragStart.mouseX) * scaleX)
    const dy = Math.round((e.clientY - dragStart.mouseY) * scaleY)

    const init = dragStart.initialCrop

    if (dragHandle === 'move') {
      const newX = Math.max(0, Math.min(videoW - init.width, init.x + dx))
      const newY = Math.max(0, Math.min(videoH - init.height, init.y + dy))
      setCrop((prev) => ({ ...prev, x: newX, y: newY }))
    } else if (dragHandle === 'top') {
      const newY = Math.max(0, Math.min(init.y + init.height - 100, init.y + dy))
      const newH = init.height - (newY - init.y)
      setCrop((prev) => ({ ...prev, y: newY, height: newH }))
    } else if (dragHandle === 'bottom') {
      const newH = Math.max(100, Math.min(videoH - init.y, init.height + dy))
      setCrop((prev) => ({ ...prev, height: newH }))
    } else if (dragHandle === 'left') {
      const newX = Math.max(0, Math.min(init.x + init.width - 100, init.x + dx))
      const newW = init.width - (newX - init.x)
      setCrop((prev) => ({ ...prev, x: newX, width: newW }))
    } else if (dragHandle === 'right') {
      const newW = Math.max(100, Math.min(videoW - init.x, init.width + dx))
      setCrop((prev) => ({ ...prev, width: newW }))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragHandle(null)
  }

  const handleSave = () => {
    onApplyCrop({
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
      aspectRatio: selectedRatio
    })
    onClose()
  }

  // Calculate percentages for render handles overlay
  const leftPct = (crop.x / videoW) * 100
  const topPct = (crop.y / videoH) * 100
  const widthPct = (crop.width / videoW) * 100
  const heightPct = (crop.height / videoH) * 100

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none font-sans"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="w-full max-w-5xl bg-[#14161f] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#161922]">
          <h2 className="text-sm font-bold text-white">Crop</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          {/* Left Side Interactive Crop Stage */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div
              ref={videoStageRef}
              className="relative w-full h-[450px] bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/10 shadow-inner group"
            >
              {/* Raw Video Layer */}
              {mediaUrl ? (
                <video
                  src={mediaUrl}
                  playsInline
                  muted
                  className="w-full h-full object-contain pointer-events-none"
                />
              ) : (
                <div className="text-gray-500 text-xs">No media loaded</div>
              )}

              {/* Dark dim overlay outside crop area */}
              <div className="absolute inset-0 bg-black/50 pointer-events-none" />

              {/* Draggable Crop Rectangle Frame */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                className="absolute border-2 border-white shadow-2xl cursor-move group/crop"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                }}
              >
                {/* Edge Handles */}
                <div
                  onMouseDown={(e) => handleMouseDown(e, 'top')}
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2 bg-white rounded-full cursor-ns-resize shadow-md"
                />
                <div
                  onMouseDown={(e) => handleMouseDown(e, 'bottom')}
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-2 bg-white rounded-full cursor-ns-resize shadow-md"
                />
                <div
                  onMouseDown={(e) => handleMouseDown(e, 'left')}
                  className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-8 bg-white rounded-full cursor-ew-resize shadow-md"
                />
                <div
                  onMouseDown={(e) => handleMouseDown(e, 'right')}
                  className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-8 bg-white rounded-full cursor-ew-resize shadow-md"
                />

                {/* Corner Handles */}
                <div
                  onMouseDown={(e) => handleMouseDown(e, 'top-left')}
                  className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize shadow-md"
                />
                <div
                  onMouseDown={(e) => handleMouseDown(e, 'top-right')}
                  className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nesw-resize shadow-md"
                />
                <div
                  onMouseDown={(e) => handleMouseDown(e, 'bottom-left')}
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nesw-resize shadow-md"
                />
                <div
                  onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize shadow-md"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-400 mt-3">
              Drag to move • Arrow keys nudge • Hold <span className="font-mono bg-white/10 px-1 py-0.5 rounded text-white">⇧</span> to skip snapping
            </p>
          </div>

          {/* Right Side Crop Controls Panel */}
          <div className="w-72 flex flex-col gap-5 border-l border-white/10 pl-6">
            {/* Live Mini Preview Box */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-300">Preview</span>
              <div className="h-28 bg-black rounded-xl overflow-hidden border border-white/10 relative flex items-center justify-center shadow-md">
                {mediaUrl && (
                  <div
                    className="relative overflow-hidden w-full h-full flex items-center justify-center"
                    style={{
                      transform: `scale(${100 / (widthPct || 100)})`,
                      transformOrigin: `${leftPct}% ${topPct}%`
                    }}
                  >
                    <video src={mediaUrl} playsInline muted className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Aspect Ratio Presets Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-300">Aspect ratio</span>
              <div className="grid grid-cols-3 gap-1.5 bg-[#101216] p-1.5 rounded-xl border border-white/5">
                {ASPECT_RATIO_PRESETS.map((preset) => {
                  const isSelected = selectedRatio === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectAspect(preset.id, preset.ratio)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${isSelected
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-[#181a22] text-gray-400 hover:text-white hover:bg-[#20242e]'
                        }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Snap to Ratios Toggle */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-gray-300">Snap to ratios</span>
              <button
                onClick={() => setSnapToRatios(!snapToRatios)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${snapToRatios ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${snapToRatios ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Size Inputs (Width x Height) */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-300">Size</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={crop.width}
                  onChange={(e) => setCrop((p) => ({ ...p, width: parseInt(e.target.value, 10) || 100 }))}
                  className="w-16 bg-[#101216] border border-white/10 rounded-lg px-2 py-1 text-center text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-500">×</span>
                <input
                  type="number"
                  value={crop.height}
                  onChange={(e) => setCrop((p) => ({ ...p, height: parseInt(e.target.value, 10) || 100 }))}
                  className="w-16 bg-[#101216] border border-white/10 rounded-lg px-2 py-1 text-center text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Position Inputs (X x Y) */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-300">Position</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={crop.x}
                  onChange={(e) => setCrop((p) => ({ ...p, x: parseInt(e.target.value, 10) || 0 }))}
                  className="w-16 bg-[#101216] border border-white/10 rounded-lg px-2 py-1 text-center text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={crop.y}
                  onChange={(e) => setCrop((p) => ({ ...p, y: parseInt(e.target.value, 10) || 0 }))}
                  className="w-16 bg-[#101216] border border-white/10 rounded-lg px-2 py-1 text-center text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick Actions (Center, Full, Reset) */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={handleCenter}
                className="py-1.5 bg-[#181a22] hover:bg-[#20242e] text-xs font-semibold text-gray-300 hover:text-white rounded-lg border border-white/5 transition-colors cursor-pointer"
              >
                Center
              </button>
              <button
                onClick={handleFull}
                className="py-1.5 bg-[#181a22] hover:bg-[#20242e] text-xs font-semibold text-gray-300 hover:text-white rounded-lg border border-white/5 transition-colors cursor-pointer"
              >
                Full
              </button>
              <button
                onClick={handleReset}
                className="py-1.5 bg-[#181a22] hover:bg-[#20242e] text-xs font-semibold text-gray-300 hover:text-white rounded-lg border border-white/5 transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-3.5 bg-[#161922] border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1f2330] hover:bg-[#282d3e] text-gray-300 hover:text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
