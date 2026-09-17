import React, { useState, useEffect } from 'react'
import { Monitor, AppWindow as WindowIcon, X, Check, RefreshCw } from 'lucide-react'
import { DesktopSource } from '../../electron/preload'

interface SourcePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectSource: (source: DesktopSource) => void
  selectedSourceId: string | null
}

export const SourcePickerModal: React.FC<SourcePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSource,
  selectedSourceId
}) => {
  const [activeTab, setActiveTab] = useState<'screen' | 'window'>('screen')
  const [sources, setSources] = useState<DesktopSource[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const fetchSources = async () => {
    setLoading(true)
    try {
      if (window.electronAPI?.getDesktopSources) {
        const desktopSources = await window.electronAPI.getDesktopSources()
        setSources(desktopSources)
      }
    } catch (err) {
      console.error('Error fetching desktop sources:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchSources()
    }
  }, [isOpen])

  if (!isOpen) return null

  const filteredSources = sources.filter(s =>
    activeTab === 'screen' ? s.isDisplay : !s.isDisplay
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#181a20] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#121316]">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Select Capture Target
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSources}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Refresh sources"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-[#121316]/50 gap-2 border-b border-white/5">
          <button
            onClick={() => setActiveTab('screen')}
            className={`flex-1 py-2 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'screen'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Displays ({sources.filter(s => s.isDisplay).length})
          </button>
          <button
            onClick={() => setActiveTab('window')}
            className={`flex-1 py-2 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'window'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <WindowIcon className="w-4 h-4" />
            Windows ({sources.filter(s => !s.isDisplay).length})
          </button>
        </div>

        {/* Sources Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-2 gap-3 flex-1 min-h-[220px]">
          {filteredSources.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-10 text-gray-500 text-sm">
              No available {activeTab === 'screen' ? 'displays' : 'windows'} found.
            </div>
          ) : (
            filteredSources.map(source => {
              const isSelected = selectedSourceId === source.id
              return (
                <button
                  key={source.id}
                  onClick={() => {
                    onSelectSource(source)
                    onClose()
                  }}
                  className={`group relative flex flex-col rounded-xl overflow-hidden border p-2 text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/50'
                      : 'border-white/10 bg-[#20232b]/60 hover:border-white/30 hover:bg-[#20232b]'
                  }`}
                >
                  <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black/50 mb-2 border border-white/5">
                    <img
                      src={source.thumbnailUrl}
                      alt={source.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 rounded-full bg-blue-600 text-white shadow-md">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    {source.appIconUrl && (
                      <img src={source.appIconUrl} alt="" className="w-4 h-4 rounded" />
                    )}
                    <span className="text-xs font-semibold text-gray-200 truncate flex-1">
                      {source.name}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
