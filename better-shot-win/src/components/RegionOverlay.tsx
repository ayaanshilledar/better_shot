import React, { useState } from 'react';
import { X } from 'lucide-react';

interface RegionOverlayProps {
  onComplete: (rect: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export const RegionOverlay: React.FC<RegionOverlayProps> = ({ onComplete, onCancel }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsSelecting(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting) {
      setCurrentPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && startPos && currentPos) {
      setIsSelecting(false);
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const width = Math.abs(currentPos.x - startPos.x);
      const height = Math.abs(currentPos.y - startPos.y);

      if (width > 10 && height > 10) {
        onComplete({ x, y, width, height });
      }
    }
  };

  const getSelectionStyle = () => {
    if (!startPos || !currentPos) return { display: 'none' };
    const left = Math.min(startPos.x, currentPos.x);
    const top = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`
    };
  };

  const selectionWidth = startPos && currentPos ? Math.abs(currentPos.x - startPos.x) : 0;
  const selectionHeight = startPos && currentPos ? Math.abs(currentPos.y - startPos.y) : 0;

  return (
    <div
      className="region-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {(isSelecting || (startPos && currentPos)) && (
        <div className="selection-box" style={getSelectionStyle()}>
          <div className="dimension-badge">
            {selectionWidth} × {selectionHeight} px
          </div>
        </div>
      )}

      <button
        onClick={onCancel}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          padding: '8px 16px',
          background: 'var(--apple-surface-tile-1)',
          color: '#fff',
          border: '1px solid var(--apple-hairline-dark)',
          borderRadius: 'var(--apple-rounded-pill)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          boxShadow: 'var(--apple-product-shadow)',
          zIndex: 1000
        }}
      >
        <X size={15} />
        <span>Cancel (Esc)</span>
      </button>
    </div>
  );
};
