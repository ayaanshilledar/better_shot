import React from 'react'

export interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  decimals?: number
  onChange: (val: number) => void
  dataControl?: string
  className?: string
  labelWidth?: string
  valueWidth?: string
}

export const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  decimals = 0,
  onChange,
  dataControl,
  className = '',
  labelWidth = 'w-24',
  valueWidth = 'w-12'
}) => {
  const safeVal = Number.isFinite(value) ? value : min
  const percent = Math.min(100, Math.max(0, ((safeVal - min) / (max - min)) * 100))
  const formattedVal = decimals > 0 ? safeVal.toFixed(decimals) : String(Math.round(safeVal))

  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 select-none ${className}`}>
      {/* Left: Bold clean label */}
      <span className={`text-[13px] font-semibold text-slate-800 dark:text-zinc-100 shrink-0 ${labelWidth}`}>
        {label}
      </span>

      {/* Center: Slim track with blue progress fill and round white thumb */}
      <div className="flex-1 flex items-center min-w-0">
        <input
          data-control={dataControl}
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeVal}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="studio-slider w-full"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, rgba(255,255,255,0.15) ${percent}%, rgba(255,255,255,0.15) 100%)`
          }}
        />
      </div>

      {/* Right: Subtle gray numeric value */}
      <span className={`text-[12.5px] font-mono text-slate-500 dark:text-zinc-400 text-right shrink-0 ${valueWidth}`}>
        {formattedVal}{unit}
      </span>
    </div>
  )
}
