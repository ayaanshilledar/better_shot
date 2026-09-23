import { screen } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { CursorTelemetryData, CursorSample, CursorClickEvent } from '../src/types/cursor'

interface TrackingOptions {
  sourceId?: string
  cropRegion?: {
    x: number
    y: number
    width: number
    height: number
    screenWidth: number
    screenHeight: number
  }
}

export class CursorTracker {
  private isTracking = false
  private startTime = 0
  private timer: NodeJS.Timeout | null = null
  private clickProcess: ChildProcess | null = null
  private samples: CursorSample[] = []
  private clicks: CursorClickEvent[] = []
  private targetBounds = { x: 0, y: 0, width: 1920, height: 1080 }
  private lastLeftDown = false
  private lastRightDown = false
  private lastX = -1
  private lastY = -1

  private lastTelemetry: CursorTelemetryData | null = null

  /**
   * Starts tracking mouse position and click events.
   */
  public start(options: TrackingOptions = {}) {
    if (this.isTracking) {
      this.stop()
    }

    this.isTracking = true
    this.startTime = Date.now()
    this.samples = []
    this.clicks = []
    this.lastTelemetry = null
    this.lastLeftDown = false
    this.lastRightDown = false
    this.lastX = -1
    this.lastY = -1

    // Determine target coordinate bounds
    this.calculateBounds(options)

    // Start 60Hz position polling
    this.timer = setInterval(() => {
      this.samplePosition()
    }, 16)

    // Start global click listener for Windows
    this.startWindowsClickMonitor()

    console.log(`[Velo:CursorTracker] Tracking started for bounds:`, this.targetBounds)
  }

  /**
   * Stops tracking and returns the collected telemetry data.
   */
  public stop(): CursorTelemetryData {
    if (!this.isTracking && this.lastTelemetry) {
      return this.lastTelemetry
    }

    this.isTracking = false

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    if (this.clickProcess) {
      try {
        this.clickProcess.kill()
      } catch (e) {
        // ignore
      }
      this.clickProcess = null
    }

    const duration = Date.now() - this.startTime

    const telemetry: CursorTelemetryData = {
      version: 1,
      recordedAt: this.startTime,
      duration,
      sourceBounds: { ...this.targetBounds },
      samples: this.samples,
      clicks: this.clicks
    }

    this.lastTelemetry = telemetry
    console.log(`[BetterShot:CursorTracker] Tracking stopped. Collected ${this.samples.length} samples and ${this.clicks.length} clicks over ${duration}ms.`)
    return telemetry
  }

  /**
   * Writes the telemetry sidecar file next to the saved video file.
   */
  public async saveToFile(videoFilePath: string, telemetry?: CursorTelemetryData): Promise<string | null> {
    const data = telemetry || this.lastTelemetry || this.stop()
    try {
      const ext = path.extname(videoFilePath)
      const baseName = videoFilePath.slice(0, -ext.length)
      const sidecarPath = `${baseName}.cursor.json`

      await fs.promises.writeFile(sidecarPath, JSON.stringify(data, null, 2), 'utf8')
      console.log(`[BetterShot:CursorTracker] Saved cursor telemetry sidecar to: ${sidecarPath}`)
      return sidecarPath
    } catch (err) {
      console.error('[BetterShot:CursorTracker] Failed to save cursor telemetry sidecar:', err)
      return null
    }
  }

  /**
   * Reads a sidecar cursor telemetry file for a given video.
   */
  public static async loadFromFile(videoFilePath: string): Promise<CursorTelemetryData | null> {
    try {
      const ext = path.extname(videoFilePath)
      const baseName = videoFilePath.slice(0, -ext.length)
      const sidecarPath = `${baseName}.cursor.json`

      if (fs.existsSync(sidecarPath)) {
        const raw = await fs.promises.readFile(sidecarPath, 'utf8')
        return JSON.parse(raw) as CursorTelemetryData
      }
    } catch (err) {
      console.warn('[BetterShot:CursorTracker] Failed to load cursor telemetry sidecar:', err)
    }
    return null
  }

  private calculateBounds(options: TrackingOptions) {
    if (options.cropRegion) {
      this.targetBounds = {
        x: options.cropRegion.x,
        y: options.cropRegion.y,
        width: options.cropRegion.width,
        height: options.cropRegion.height
      }
      return
    }

    // Default to primary display bounds
    const primary = screen.getPrimaryDisplay()
    if (primary) {
      this.targetBounds = {
        x: primary.bounds.x,
        y: primary.bounds.y,
        width: primary.bounds.width,
        height: primary.bounds.height
      }
    } else {
      this.targetBounds = { x: 0, y: 0, width: 1920, height: 1080 }
    }
  }

  private samplePosition() {
    if (!this.isTracking) return

    const point = screen.getCursorScreenPoint()
    const t = Date.now() - this.startTime

    const relX = point.x - this.targetBounds.x
    const relY = point.y - this.targetBounds.y

    const nx = Math.max(0, Math.min(1, relX / this.targetBounds.width))
    const ny = Math.max(0, Math.min(1, relY / this.targetBounds.height))

    const isInside = relX >= 0 && relX <= this.targetBounds.width && relY >= 0 && relY <= this.targetBounds.height

    // Only record if moved or at periodic intervals to optimize memory
    const distSq = (nx - this.lastX) * (nx - this.lastX) + (ny - this.lastY) * (ny - this.lastY)
    if (distSq > 0.000001 || this.samples.length === 0 || t - (this.samples[this.samples.length - 1]?.t || 0) > 60) {
      this.lastX = nx
      this.lastY = ny
      this.samples.push({
        t,
        x: Number(nx.toFixed(4)),
        y: Number(ny.toFixed(4)),
        visible: isInside
      })
    }
  }

  /**
   * Registers a click event at the current mouse position.
   */
  public registerClick(button: 'left' | 'right' | 'middle', type: 'click' | 'double_click' = 'click') {
    if (!this.isTracking) return
    const point = screen.getCursorScreenPoint()
    const t = Date.now() - this.startTime

    const relX = point.x - this.targetBounds.x
    const relY = point.y - this.targetBounds.y

    const nx = Math.max(0, Math.min(1, relX / this.targetBounds.width))
    const ny = Math.max(0, Math.min(1, relY / this.targetBounds.height))

    const click: CursorClickEvent = {
      id: `click_${t}_${Math.random().toString(36).slice(2, 6)}`,
      t,
      x: Number(nx.toFixed(4)),
      y: Number(ny.toFixed(4)),
      button,
      type
    }

    this.clicks.push(click)
    console.log(`[BetterShot:CursorTracker] Click registered (${button}) at t=${t}ms (${click.x}, ${click.y})`)
  }

  /**
   * Windows-specific background click listener via PowerShell GetAsyncKeyState.
   */
  private startWindowsClickMonitor() {
    if (process.platform !== 'win32') return

    const psScript = `
$code = @"
using System;
using System.Runtime.InteropServices;
public class WinMouse {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
}
"@
Add-Type -TypeDefinition $code -Language CSharp
$lastL = 0
$lastR = 0
while ($true) {
    $l = [WinMouse]::GetAsyncKeyState(1) -band 32768
    $r = [WinMouse]::GetAsyncKeyState(2) -band 32768
    if ($l -ne 0 -and $lastL -eq 0) {
        [Console]::Out.WriteLine("CLICK:L")
    }
    if ($r -ne 0 -and $lastR -eq 0) {
        [Console]::Out.WriteLine("CLICK:R")
    }
    $lastL = $l
    $lastR = $r
    [System.Threading.Thread]::Sleep(15)
}
`

    try {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore']
      })

      this.clickProcess = child

      child.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().trim().split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed === 'CLICK:L') {
            this.registerClick('left')
          } else if (trimmed === 'CLICK:R') {
            this.registerClick('right')
          }
        }
      })

      child.on('error', (err) => {
        console.warn('[BetterShot:CursorTracker] Click monitor process error:', err)
      })
    } catch (err) {
      console.warn('[BetterShot:CursorTracker] Could not start click monitor process:', err)
    }
  }
}

export const cursorTracker = new CursorTracker()
