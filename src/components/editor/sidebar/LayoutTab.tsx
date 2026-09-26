import React from 'react'
import { SliderRow } from '../../common/SliderRow'
import { StudioProject, ShadowType } from '../../../types/editor'

interface LayoutTabProps {
  project: StudioProject
  onUpdateBackground: (updates: Partial<StudioProject['background']>) => void
  onUpdateLayout: (updates: Partial<StudioProject['layout']>) => void
}

const shadowOptions: { id: ShadowType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'soft', label: 'Soft' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'glow', label: 'Glow' }
]

export const LayoutTab: React.FC<LayoutTabProps> = ({
  project,
  onUpdateBackground,
  onUpdateLayout
}) => {
  return (
    <div className="flex flex-col gap-4">
      <SliderRow
        label="Blur"
        value={project.background.blurAmount}
        min={0}
        max={100}
        step={0.5}
        unit="%"
        decimals={1}
        onChange={(blurAmount) => onUpdateBackground({ blurAmount })}
      />

      <SliderRow
        dataControl="padding"
        label="Padding"
        value={project.layout.padding}
        min={0}
        max={40}
        step={0.1}
        unit="%"
        decimals={1}
        onChange={(padding) => onUpdateLayout({ padding })}
      />

      <SliderRow
        dataControl="cornerRadius"
        label="Corner Radius"
        value={project.layout.cornerRadius}
        min={0}
        max={32}
        step={1}
        unit="px"
        decimals={0}
        onChange={(cornerRadius) => onUpdateLayout({ cornerRadius })}
      />

      <SliderRow
        label="Border Width"
        value={project.layout.borderWidth ?? 1}
        min={0}
        max={8}
        step={1}
        unit="px"
        decimals={0}
        onChange={(borderWidth) => onUpdateLayout({ borderWidth })}
      />

      <SliderRow
        label="Border Opacity"
        value={project.layout.borderOpacity ?? 25}
        min={0}
        max={100}
        step={5}
        unit="%"
        decimals={0}
        onChange={(borderOpacity) => onUpdateLayout({ borderOpacity })}
      />

      {/* Drop Shadow Preset Buttons */}
      <div className="flex flex-col gap-2 pt-2 border-t border-black/5 dark:border-white/5">
        <span className="text-xs font-semibold text-slate-800 dark:text-gray-300">Drop Shadow</span>
        <div className="grid grid-cols-5 gap-1 bg-slate-100 dark:bg-[#252525] p-[3px] rounded-xl border border-black/5 dark:border-white/[0.06]">
          {shadowOptions.map((opt) => (
            <button
              key={opt.id}
              data-control="shadow"
              data-shadow-id={opt.id}
              onClick={() => onUpdateLayout({ shadow: opt.id })}
              className={`py-1 text-[11px] font-medium rounded-[8px] capitalize transition-all cursor-pointer ${
                project.layout.shadow === opt.id
                  ? 'bg-[#2373F4] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
