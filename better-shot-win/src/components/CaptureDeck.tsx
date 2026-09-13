import React from 'react';
import { Copy, Save, Edit3, Pin, Trash2 } from 'lucide-react';

export interface CaptureItem {
  id: string;
  dataUrl: string;
  timestamp: Date;
}

interface CaptureDeckProps {
  items: CaptureItem[];
  onCopy: (item: CaptureItem) => void;
  onSave: (item: CaptureItem) => void;
  onEdit: (item: CaptureItem) => void;
  onDismiss: (id: string) => void;
}

export const CaptureDeck: React.FC<CaptureDeckProps> = ({
  items,
  onCopy,
  onSave,
  onEdit,
  onDismiss
}) => {
  if (items.length === 0) return null;

  return (
    <div className="capture-deck">
      {items.slice(0, 3).map((item) => (
        <div key={item.id} className="deck-item glass-panel">
          <img src={item.dataUrl} alt="Captured preview" className="deck-preview" />
          <div className="deck-actions">
            <button className="icon-btn" title="Copy to Clipboard" onClick={() => onCopy(item)}>
              <Copy size={15} />
            </button>
            <button className="icon-btn" title="Edit / Annotate" onClick={() => onEdit(item)}>
              <Edit3 size={15} />
            </button>
            <button className="icon-btn" title="Save to File" onClick={() => onSave(item)}>
              <Save size={15} />
            </button>
            <button className="icon-btn" title="Pin to Screen">
              <Pin size={15} />
            </button>
            <button className="icon-btn" title="Dismiss" onClick={() => onDismiss(item.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
