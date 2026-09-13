import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface RegionOverlayProps {
  onComplete: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  onCancel: () => void;
}

export const RegionOverlay: React.FC<RegionOverlayProps> = ({
  onComplete,
  onCancel,
}) => {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (start) {
      setCurrent({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (!start || !current) return;

    const rect = {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };

    if (rect.width > 10 && rect.height > 10) {
      onComplete(rect);
    }

    setStart(null);
    setCurrent(null);
  };

  const rect =
    start && current
      ? {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        }
      : null;

  return (
    <div
      className="region-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {rect && (
        <div
          className="selection-box"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        >
          <div className="dimension-badge">
            {rect.width} × {rect.height} px
          </div>
        </div>
      )}

      <button className="region-cancel" onClick={onCancel}>
        <X size={15} />
        Cancel (Esc)
      </button>
    </div>
  );
};
