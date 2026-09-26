import React from 'react'
import { MousePointer, Check } from 'lucide-react'
import { SliderRow } from '../../common/SliderRow'
import { CursorConfig, CursorStyleType } from '../../../types/cursor'

interface CursorTabProps {
  cursorConfig: CursorConfig
  onUpdateCursorConfig?: (updates: Partial<CursorConfig>) => void
}

const cursorStyles: { id: CursorStyleType; label: string; desc: string }[] = [
  { id: 'macos-arrow', label: 'macOS Arrow', desc: 'Crisp vector pointer' },
  { id: 'halo', label: 'Halo Glow', desc: 'Soft luminous ring' },
  { id: 'spotlight', label: 'Spotlight', desc: 'Radial focal light' },
  { id: 'dot', label: 'Accent Dot', desc: 'Minimal dot indicator' },
  { id: 'original', label: 'Original', desc: 'Raw captured cursor' }
]

export const CursorTab: React.FC<CursorTabProps> = ({
  cursorConfig,
  onUpdateCursorConfig
}) => {
  return (
    <div className="flex flex-col gap-5">
      {/* Header with Enable Switch */}
      <div className="p-3 bg-[#252525] border border-white/[0.06] rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#2373F4]/20 text-[#2373F4] flex items-center justify-center">
            <MousePointer className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-200">Cursor</div>
            <div className="text-[10px] text-gray-400">Pointer style and size</div>
          </div>
        </div>
        <button
          onClick={() =>
            onUpdateCursorConfig &&
            onUpdateCursorConfig({ enabled: !cursorConfig.enabled })
          }
          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
            cursorConfig.enabled ? 'bg-[#2373F4]' : 'bg-gray-700'
          }`}
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
              cursorConfig.enabled ? 'left-5' : 'left-1'
            }`}
          />
        </button>
      </div>

      {cursorConfig.enabled && (
        <>
          {/* Cursor Style Options */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-300">Cursor Style</span>
            <div className="grid grid-cols-2 gap-2">
              {cursorStyles.map((styleOpt) => {
                const isSelected = cursorConfig.style === styleOpt.id
                return (
                  <button
                    key={styleOpt.id}
                    onClick={() =>
                      onUpdateCursorConfig &&
                      onUpdateCursorConfig({ style: styleOpt.id })
                    }
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-[#2373F4]/20 border-[#2373F4]/50 shadow-sm'
                        : 'bg-[#252525] border-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-200">{styleOpt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#2373F4]" />}
                    </div>
                    <span className="text-[10px] text-gray-400">{styleOpt.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cursor Size Slider */}
          {cursorConfig.style !== 'original' && (
            <div className="bg-[#161922] p-3 rounded-xl border border-white/5">
              <SliderRow
                label="Pointer Size"
                value={cursorConfig.size}
                min={16}
                max={54}
                step={2}
                unit="px"
                decimals={0}
                onChange={(size) =>
                  onUpdateCursorConfig &&
                  onUpdateCursorConfig({ size })
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
