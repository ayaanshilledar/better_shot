export type RecorderState =
  | 'idle'           // Ready to launch
  | 'area_selection' // Selecting region
  | 'preparing'      // Initializing capture
  | 'countdown'      // 3-2-1 countdown
  | 'recording'      // Recording active
  | 'saving'         // Finalizing and saving MP4
  | 'saved'          // Finalized and saved
  | 'editor'         // Video editor view
  | 'error';         // Error state

export type CaptureSource = 'fullscreen' | 'region';

export interface RecordingConfig {
  mode: CaptureSource;
  savePath: string;
  micEnabled: boolean;
  systemAudioEnabled: boolean;
  selectedMic: string;
}

export interface RecordingHistoryItem {
  id: string;
  filePath: string;
  fileName: string;
  durationSeconds: number;
  timestamp: string;
  mode: CaptureSource;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
