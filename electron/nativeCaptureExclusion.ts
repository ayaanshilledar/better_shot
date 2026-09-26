import { BrowserWindow } from 'electron'
import koffi from 'koffi'

let setWindowDisplayAffinityFn: ((hWnd: bigint | number, dwAffinity: number) => boolean) | null = null

if (process.platform === 'win32') {
  try {
    const user32 = koffi.load('user32.dll')
    setWindowDisplayAffinityFn = user32.func('bool __stdcall SetWindowDisplayAffinity(uintptr_t hWnd, uint32_t dwAffinity)')
    console.log('[Velo:Native] SetWindowDisplayAffinity loaded successfully via koffi')
  } catch (err) {
    console.warn('[Velo:Native] Failed to load user32.dll via koffi:', err)
  }
}

/**
 * Excludes a window from screen recordings and screen captures at the Windows OS level.
 * WDA_NONE = 0x00 (Normal capture)
 * WDA_EXCLUDEFROMCAPTURE = 0x00000011 (17 / 0x11) -> Window is completely invisible in captured frames,
 * without any black box or artifact, while remaining fully visible and interactive to the user.
 */
export function setWindowCaptureExclusion(win: BrowserWindow | null | undefined, exclude: boolean = true): boolean {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return false

  try {
    const handleBuf = win.getNativeWindowHandle()
    const hwnd = process.arch === 'x64' || process.arch === 'arm64'
      ? handleBuf.readBigUInt64LE(0)
      : handleBuf.readUInt32LE(0)

    const affinity = exclude ? 0x11 : 0x00 // WDA_EXCLUDEFROMCAPTURE = 0x11, WDA_NONE = 0x00

    if (setWindowDisplayAffinityFn) {
      const result = setWindowDisplayAffinityFn(hwnd, affinity)
      console.log(`[Velo:Main] SetWindowDisplayAffinity (${exclude ? '0x11 EXCLUDE' : '0x00 NONE'}) applied to HWND ${hwnd}: ${result}`)
      return Boolean(result)
    }
  } catch (err) {
    console.warn('[Velo:Main] Could not apply native window capture exclusion:', err)
  }
  return false
}
