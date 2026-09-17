import { app, BrowserWindow, ipcMain, desktopCapturer, shell, screen, session } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { fileURLToPath } from 'url'

// This file is emitted as an ES module. `process.cwd()` is the directory of the
// shell that launched Electron, not the directory that contains this main bundle.
// Derive every production asset path from this module instead.
const mainDir = path.dirname(fileURLToPath(import.meta.url))
const preloadPath = path.join(mainDir, 'preload.cjs')
const rendererIndexPath = path.join(mainDir, '..', 'dist', 'index.html')
const devServerUrl = process.env.VITE_DEV_SERVER_URL
const isSmokeTest = process.env.BETTER_SHOT_SMOKE_TEST === '1'
const smokeWindowsLoaded = new Set<string>()
let smokeTimeout: NodeJS.Timeout | null = null

function failSmoke(message: string): never {
  console.error(`[better-shot:smoke] FAIL: ${message}`)
  if (smokeTimeout) clearTimeout(smokeTimeout)
  app.exit(1)
  throw new Error(message)
}

function verifySmokeAssets() {
  for (const assetPath of [preloadPath, rendererIndexPath]) {
    if (!fs.existsSync(assetPath)) {
      failSmoke(`Missing runtime asset: ${assetPath}`)
    }
  }
}

function observeSmokeWindow(name: string, win: BrowserWindow) {
  if (!isSmokeTest) return

  win.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    failSmoke(`${name} failed to load (${errorCode}): ${errorDescription} (${validatedURL})`)
  })

  win.webContents.once('did-finish-load', async () => {
    try {
      const hasPreloadBridge = await win.webContents.executeJavaScript(
        'typeof window.electronAPI === "object" && typeof window.electronAPI.getDesktopSources === "function"'
      )
      if (!hasPreloadBridge) {
        failSmoke(`${name} loaded without the preload bridge`)
      }
      smokeWindowsLoaded.add(name)
      if (smokeWindowsLoaded.size === 2) {
        console.log('[better-shot:smoke] PASS: launcher and overlay loaded with preload bridge')
        if (smokeTimeout) clearTimeout(smokeTimeout)
        app.exit(0)
      }
    } catch (error) {
      failSmoke(`${name} preload verification failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
}

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-http-cache')
try {
  const userDataPath = path.join(os.tmpdir(), 'better-shot-userdata')
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }
  app.setPath('userData', userDataPath)
} catch (err) {
  console.warn('Could not set custom userData path:', err)
}

let launcherWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let selectionWindow: BrowserWindow | null = null

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 350,
    height: 265,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  observeSmokeWindow('launcher', launcherWindow)

  if (devServerUrl) {
    launcherWindow.loadURL(`${devServerUrl}#launcher`)
  } else {
    launcherWindow.loadFile(rendererIndexPath, { hash: 'launcher' })
  }

  launcherWindow.once('ready-to-show', () => {
    if (!isSmokeTest) launcherWindow?.show()
  })

  launcherWindow.on('closed', () => {
    launcherWindow = null
  })
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 270,
    height: 48,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width } = primaryDisplay.workAreaSize
  overlayWindow.setPosition(Math.round((width - 270) / 2), 30)

  observeSmokeWindow('overlay', overlayWindow)

  if (devServerUrl) {
    overlayWindow.loadURL(`${devServerUrl}#overlay`)
  } else {
    overlayWindow.loadFile(rendererIndexPath, { hash: 'overlay' })
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function createSelectionWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height, x, y } = primaryDisplay.bounds

  selectionWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  if (devServerUrl) {
    selectionWindow.loadURL(`${devServerUrl}#select-area`)
  } else {
    selectionWindow.loadFile(rendererIndexPath, { hash: 'select-area' })
  }

  selectionWindow.on('closed', () => {
    selectionWindow = null
  })
}

app.whenReady().then(() => {
  if (isSmokeTest) {
    verifySmokeAssets()
    smokeTimeout = setTimeout(() => failSmoke('Timed out waiting for launcher and overlay'), 15_000)
  }
  if (session.defaultSession) {
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        callback({ video: sources[0], audio: 'loopback' })
      })
    })

    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(true)
    })

    session.defaultSession.setPermissionCheckHandler((_webContents, _permission) => {
      return true
    })
  }

  createLauncherWindow()
  createOverlayWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow()
      createOverlayWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers

ipcMain.handle('get-desktop-sources', async () => {
  console.log('[BetterShot:Main] IPC handle: get-desktop-sources requested')
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  })

  console.log(`[BetterShot:Main] Desktop sources retrieved: ${sources.length} sources total (${sources.filter(s => s.id.startsWith('screen:')).length} displays, ${sources.filter(s => !s.id.startsWith('screen:')).length} windows)`)

  return sources.map(src => ({
    id: src.id,
    name: src.name,
    thumbnailUrl: src.thumbnail.toDataURL(),
    appIconUrl: src.appIcon ? src.appIcon.toDataURL() : null,
    isDisplay: src.id.startsWith('screen:')
  }))
})

ipcMain.handle('open-area-selector', () => {
  console.log('[BetterShot:Main] IPC handle: open-area-selector')
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.hide()
  }
  if (!selectionWindow || selectionWindow.isDestroyed()) {
    createSelectionWindow()
  }
  if (selectionWindow) {
    selectionWindow.show()
    selectionWindow.focus()
    selectionWindow.setAlwaysOnTop(true, 'screen-saver')
  }
  return true
})

ipcMain.handle('cancel-area-selection', () => {
  console.log('[BetterShot:Main] IPC handle: cancel-area-selection')
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.hide()
  }
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.show()
    launcherWindow.focus()
  }
  return true
})

ipcMain.handle('confirm-area-selection', (_event, cropRegion) => {
  console.log('[BetterShot:Main] IPC handle: confirm-area-selection', cropRegion)
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.hide()
  }
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send('area-selected', cropRegion)
  }
  return true
})

ipcMain.handle('start-recording-mode', () => {
  console.log('[BetterShot:Main] IPC handle: start-recording-mode')
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.hide()
  }
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.hide()
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }
  return true
})

ipcMain.handle('stop-recording-mode', () => {
  console.log('[BetterShot:Main] IPC handle: stop-recording-mode')
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.show()
    launcherWindow.focus()
  }
  return true
})

ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer, fileName?: string) => {
  console.log(`[BetterShot:Main] IPC handle: save-recording requested (${buffer.byteLength} bytes)`)
  try {
    const recordingsDir = path.join(os.homedir(), 'Videos', 'BetterShot')
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true })
    }

    const defaultName = fileName || `BetterShot_${Date.now()}.webm`
    const filePath = path.join(recordingsDir, defaultName)
    const uint8Array = new Uint8Array(buffer)

    await fs.promises.writeFile(filePath, uint8Array)
    console.log(`[BetterShot:Main] Saved recording successfully to: ${filePath}`)
    shell.showItemInFolder(filePath)
    return { success: true, filePath }
  } catch (error: any) {
    console.error('[BetterShot:Main] Error saving recording:', error)
    return { success: false, error: error.message }
  }
})

// Window controls
ipcMain.on('minimize-launcher', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || launcherWindow
  if (win && !win.isDestroyed()) {
    win.minimize()
  }
})

ipcMain.on('close-launcher', () => {
  app.exit(0)
})

ipcMain.on('set-overlay-draggable', (_event, draggable: boolean) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(!draggable, { forward: true })
  }
})

// IPC Multi-Window State Relay
ipcMain.on('relay-timer-update', (_event, seconds: number) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('recording-timer-update', seconds)
  }
})

ipcMain.on('relay-audio-level', (_event, level: number) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('recording-audio-level-update', level)
  }
})

ipcMain.on('relay-overlay-command', (_event, command: string) => {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send('overlay-command', command)
  }
})

// Recordings Manager IPC Handlers
ipcMain.handle('get-recordings', async () => {
  try {
    const recordingsDir = path.join(os.homedir(), 'Videos', 'BetterShot')
    if (!fs.existsSync(recordingsDir)) {
      return []
    }
    const files = await fs.promises.readdir(recordingsDir)
    const recordingFiles = []

    for (const file of files) {
      if (file.endsWith('.webm') || file.endsWith('.mp4')) {
        const filePath = path.join(recordingsDir, file)
        const stats = await fs.promises.stat(filePath)
        recordingFiles.push({
          name: file,
          filePath,
          size: stats.size,
          createdAt: stats.birthtimeMs || stats.mtimeMs
        })
      }
    }

    recordingFiles.sort((a, b) => b.createdAt - a.createdAt)
    return recordingFiles
  } catch (err) {
    console.error('[BetterShot:Main] Error getting recordings:', err)
    return []
  }
})

ipcMain.handle('open-recording-file', async (_event, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath)
      return true
    }
    return false
  } catch (err) {
    console.error('[BetterShot:Main] Error opening recording file:', err)
    return false
  }
})

ipcMain.handle('open-recordings-folder', async () => {
  try {
    const recordingsDir = path.join(os.homedir(), 'Videos', 'BetterShot')
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true })
    }
    await shell.openPath(recordingsDir)
    return true
  } catch (err) {
    console.error('[BetterShot:Main] Error opening recordings folder:', err)
    return false
  }
})
