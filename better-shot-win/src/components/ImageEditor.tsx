import React, { useState } from 'react';
import {
  ArrowUpRight,
  Square,
  Circle,
  Type,
  Highlighter,
  EyeOff,
  Copy,
  Save,
  X
} from 'lucide-react';

interface ImageEditorProps {
  imageSrc: string;
  onSave: (editedDataUrl: string) => void;
  onCopy: (editedDataUrl: string) => void;
  onClose: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  imageSrc,
  onSave,
  onCopy,
  onClose
}) => {
  const [activeTool, setActiveTool] = useState<string>('arrow');
  const [padding, setPadding] = useState<number>(32);
  const [cornerRadius, setCornerRadius] = useState<number>(12);
  const [shadowBlur] = useState<number>(30);
  const [selectedGradient, setSelectedGradient] = useState<string>(
    'linear-gradient(135deg, #0066cc 0%, #2997ff 100%)'
  );

  const presets = [
    { name: 'Transparent', value: 'transparent' },
    { name: 'Apple Studio', value: 'linear-gradient(135deg, #272729 0%, #1d1d1f 100%)' },
    { name: 'Action Blue', value: 'linear-gradient(135deg, #0066cc 0%, #2997ff 100%)' },
    { name: 'Parchment', value: 'linear-gradient(135deg, #f5f5f7 0%, #e0e0e0 100%)' },
    { name: 'Space Gray', value: 'linear-gradient(135deg, #3a3a3c 0%, #2c2c2e 100%)' },
    { name: 'Midnight', value: 'linear-gradient(135deg, #161617 0%, #000000 100%)' }
  ];

  return (
    <div className="editor-container">
      <div className="editor-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--apple-hairline-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--apple-font-display)', fontWeight: 600, fontSize: 15, letterSpacing: 'var(--apple-tracking-body)' }}>
              Markup & Frame
            </span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close Editor">
            <X size={16} />
          </button>
        </div>

        <div className="toolbar-section">
          <div className="section-title">Annotation Tools</div>
          <div className="tool-grid">
            <button
              className={`tool-tile ${activeTool === 'arrow' ? 'active' : ''}`}
              onClick={() => setActiveTool('arrow')}
            >
              <ArrowUpRight size={17} />
              <span>Arrow</span>
            </button>
            <button
              className={`tool-tile ${activeTool === 'rect' ? 'active' : ''}`}
              onClick={() => setActiveTool('rect')}
            >
              <Square size={17} />
              <span>Rect</span>
            </button>
            <button
              className={`tool-tile ${activeTool === 'circle' ? 'active' : ''}`}
              onClick={() => setActiveTool('circle')}
            >
              <Circle size={17} />
              <span>Circle</span>
            </button>
            <button
              className={`tool-tile ${activeTool === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTool('text')}
            >
              <Type size={17} />
              <span>Text</span>
            </button>
            <button
              className={`tool-tile ${activeTool === 'highlight' ? 'active' : ''}`}
              onClick={() => setActiveTool('highlight')}
            >
              <Highlighter size={17} />
              <span>Marker</span>
            </button>
            <button
              className={`tool-tile ${activeTool === 'blur' ? 'active' : ''}`}
              onClick={() => setActiveTool('blur')}
            >
              <EyeOff size={17} />
              <span>Blur</span>
            </button>
          </div>
        </div>

        <div className="toolbar-section">
          <div className="section-title">Framing Canvas</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--apple-ink-muted-48)' }}>
              <span>Padding</span>
              <span style={{ fontFamily: 'var(--apple-font-mono)' }}>{padding}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="96"
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              style={{ accentColor: 'var(--apple-primary)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--apple-ink-muted-48)' }}>
              <span>Corner Radius</span>
              <span style={{ fontFamily: 'var(--apple-font-mono)' }}>{cornerRadius}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={cornerRadius}
              onChange={(e) => setCornerRadius(Number(e.target.value))}
              style={{ accentColor: 'var(--apple-primary)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--apple-ink-muted-48)' }}>Canvas Finish</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setSelectedGradient(preset.value)}
                  style={{
                    height: 28,
                    borderRadius: 'var(--apple-rounded-sm)',
                    background: preset.value === 'transparent' ? '#111' : preset.value,
                    border: selectedGradient === preset.value
                      ? '2px solid var(--apple-primary-on-dark)'
                      : '1px solid var(--apple-hairline-dark)',
                    cursor: 'pointer',
                    transition: 'var(--apple-transition-micro)'
                  }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: '1px solid var(--apple-hairline-dark)' }}>
          <button className="action-btn primary" onClick={() => onCopy(imageSrc)}>
            <Copy size={15} />
            <span>Copy to Clipboard</span>
          </button>
          <button className="action-btn" onClick={() => onSave(imageSrc)}>
            <Save size={15} />
            <span>Save to Disk</span>
          </button>
          <button className="action-btn" onClick={onClose}>
            <X size={15} />
            <span>Done</span>
          </button>
        </div>
      </div>

      <div className="editor-canvas-wrap">
        <div
          className="editor-preview-surface"
          style={{
            padding: `${padding}px`,
            background: selectedGradient,
            borderRadius: 'var(--apple-rounded-lg)'
          }}
        >
          <img
            src={imageSrc}
            alt="Source Capture"
            className="editor-preview-image"
            style={{
              borderRadius: `${cornerRadius}px`,
              boxShadow: shadowBlur > 0 ? 'var(--apple-product-shadow)' : 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
};
