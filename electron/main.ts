import { app, BrowserWindow, ipcMain, desktopCapturer, shell, screen, session, dialog, clipboard, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { fileURLToPath } from 'url'
import { cursorTracker, CursorTracker } from './cursorTracker'

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

if (process.platform === 'win32') {
  app.setAppUserModelId('com.bettershot.app')
}

function getAppIcon() {
  const possiblePaths = [
    path.join(mainDir, '..', 'public', 'Logo.png'),
    path.join(mainDir, '..', 'dist', 'Logo.png'),
    path.join(process.cwd(), 'public', 'Logo.png'),
    path.join(process.cwd(), 'dist', 'Logo.png')
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return nativeImage.createFromPath(p)
    }
  }
  return undefined
}

let launcherWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let selectionWindow: BrowserWindow | null = null
let editorWindow: BrowserWindow | null = null
let cameraBubbleWindow: BrowserWindow | null = null

function createEditorWindow(filePath?: string) {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.hide()
  }

  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.maximize()
    editorWindow.show()
    editorWindow.focus()
    if (filePath) {
      editorWindow.webContents.send('load-editor-media', filePath)
    }
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = primaryDisplay.workArea

  const appIcon = getAppIcon()

  editorWindow = new BrowserWindow({
    width: Math.min(1240, screenW - 40),
    height: Math.min(820, screenH - 40),
    minWidth: 900,
    minHeight: 600,
    resizable: true,
    frame: false,
    transparent: false,
    show: false,
    backgroundColor: '#0d0d11',
    ...(appIcon ? { icon: appIcon } : {}),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  observeSmokeWindow('editor', editorWindow)

  const encodedPath = filePath ? encodeURIComponent(filePath) : ''
  const hash = encodedPath ? `editor?path=${encodedPath}` : 'editor'

  if (devServerUrl) {
    const baseUrl = devServerUrl.endsWith('/') ? devServerUrl : `${devServerUrl}/`
    const targetUrl = `${baseUrl}#${hash}`
    console.log(`[BetterShot:Main] Loading dev URL for editorWindow: ${targetUrl}`)
    editorWindow.loadURL(targetUrl)
  } else {
    console.log(`[BetterShot:Main] Loading production index file for editorWindow with hash: ${hash}`)
    editorWindow.loadFile(rendererIndexPath, { hash })
  }

  editorWindow.once('ready-to-show', () => {
    console.log('[BetterShot:Main] editorWindow ready-to-show event fired')
    if (!isSmokeTest) {
      editorWindow?.maximize()
      editorWindow?.show()
    }
  })

  editorWindow.on('closed', () => {
    editorWindow = null
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.show()
      launcherWindow.focus()
    }
  })
}

function createLauncherWindow() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    if (launcherWindow.isMinimized()) launcherWindow.restore()
    launcherWindow.show()
    launcherWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH, x: displayX, y: displayY } = primaryDisplay.workArea
  const launcherWidth = 340
  const launcherHeight = 420
  const launcherX = displayX + Math.round((screenW - launcherWidth) / 2)
  const launcherY = displayY + Math.round((screenH - launcherHeight) / 2)

  const appIcon = getAppIcon()

  launcherWindow = new BrowserWindow({
    width: launcherWidth,
    height: launcherHeight,
    x: launcherX,
    y: launcherY,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    show: false,
    backgroundColor: '#00000000',
    ...(appIcon ? { icon: appIcon } : {}),
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

  const showLauncher = () => {
    if (isSmokeTest) return
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      if (launcherWindow.isMinimized()) launcherWindow.restore()
      launcherWindow.show()
      launcherWindow.focus()
    }
  }

  launcherWindow.once('ready-to-show', showLauncher)

  launcherWindow.webContents.on('did-finish-load', () => {
    showLauncher()
  })

  setTimeout(showLauncher, 300)

  launcherWindow.on('closed', () => {
    launcherWindow = null
  })
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 290,
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
  const { width: screenW, height: screenH, x: displayX, y: displayY } = primaryDisplay.workArea
  overlayWindow.setPosition(
    displayX + Math.round((screenW - 290) / 2),
    displayY + screenH - 48 - 30
  )

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

function getCameraBubbleBounds(size: 'small' | 'medium' | 'large' = 'medium', position: string = 'bottom-right', shape: string = 'circle') {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH, x: displayX, y: displayY } = primaryDisplay.workArea

  let width = size === 'small' ? 180 : size === 'large' ? 260 : 210
  let height = width

  if (shape === '16:9') {
    width = size === 'small' ? 240 : size === 'large' ? 360 : 300
    height = Math.round(width * 9 / 16)
  }

  const margin = 28

  let x = displayX + screenW - width - margin
  let y = displayY + screenH - height - margin

  if (position === 'bottom-left') {
    x = displayX + margin
    y = displayY + screenH - height - margin
  } else if (position === 'top-right') {
    x = displayX + screenW - width - margin
    y = displayY + margin
  } else if (position === 'top-left') {
    x = displayX + margin
    y = displayY + margin
  }

  return { x, y, width, height }
}

function createCameraBubbleWindow(config?: any) {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    const bounds = getCameraBubbleBounds(config?.size, config?.position, config?.shape)
    cameraBubbleWindow.setBounds(bounds)
    return cameraBubbleWindow
  }

  const bounds = getCameraBubbleBounds(config?.size, config?.position, config?.shape)

  cameraBubbleWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  cameraBubbleWindow.setAlwaysOnTop(true, 'screen-saver')

  if (devServerUrl) {
    cameraBubbleWindow.loadURL(`${devServerUrl}#camera-bubble`)
  } else {
    cameraBubbleWindow.loadFile(rendererIndexPath, { hash: 'camera-bubble' })
  }

  cameraBubbleWindow.on('closed', () => {
    cameraBubbleWindow = null
  })

  return cameraBubbleWindow
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

ipcMain.handle('capture-screenshot', async (_event, options?: { cropRegion?: any; copyToClipboard?: boolean }) => {
  console.log('[BetterShot:Main] IPC handle: capture-screenshot requested', options)
  try {
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.hide()
    }
    await new Promise((res) => setTimeout(res, 200))

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.bounds
    const scaleFactor = primaryDisplay.scaleFactor || 1

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor)
      }
    })

    if (!sources || sources.length === 0) {
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.show()
        launcherWindow.focus()
      }
      return { success: false, error: 'No display source found' }
    }

    let img = sources[0].thumbnail

    if (options?.cropRegion) {
      const { x, y, width: cropW, height: cropH } = options.cropRegion
      const cropX = Math.max(0, Math.round(x * scaleFactor))
      const cropY = Math.max(0, Math.round(y * scaleFactor))
      const targetW = Math.min(img.getSize().width - cropX, Math.round(cropW * scaleFactor))
      const targetH = Math.min(img.getSize().height - cropY, Math.round(cropH * scaleFactor))

      if (targetW > 0 && targetH > 0) {
        img = img.crop({
          x: cropX,
          y: cropY,
          width: targetW,
          height: targetH
        })
      }
    }

    if (options?.copyToClipboard !== false) {
      clipboard.writeImage(img)
      console.log('[BetterShot:Main] Screenshot copied to system clipboard')
    }

    const picturesDir = path.join(os.homedir(), 'Pictures', 'Velo')
    if (!fs.existsSync(picturesDir)) {
      fs.mkdirSync(picturesDir, { recursive: true })
    }

    const filename = `Velo_${Date.now()}.png`
    const filePath = path.join(picturesDir, filename)
    await fs.promises.writeFile(filePath, img.toPNG())
    console.log(`[Velo:Main] Screenshot saved successfully to: ${filePath}`)

    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.show()
      launcherWindow.focus()
    }

    return { success: true, filePath }
  } catch (err: any) {
    console.error('[BetterShot:Main] Error capturing screenshot:', err)
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.show()
      launcherWindow.focus()
    }
    return { success: false, error: err.message }
  }
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
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.hide()
  }
  // Only show launcher if editorWindow is NOT active/open
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    if (!editorWindow || editorWindow.isDestroyed() || !editorWindow.isVisible()) {
      launcherWindow.show()
      launcherWindow.focus()
    }
  }
  return true
})

ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer, fileName?: string) => {
  console.log(`[Velo:Main] IPC handle: save-recording requested (${buffer.byteLength} bytes)`)
  try {
    const recordingsDir = path.join(os.homedir(), 'Videos', 'Velo')
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true })
    }

    const defaultName = fileName || `Velo_${Date.now()}.webm`
    const filePath = path.join(recordingsDir, defaultName)
    const uint8Array = new Uint8Array(buffer)

    await fs.promises.writeFile(filePath, uint8Array)
    console.log(`[Velo:Main] Saved recording successfully to: ${filePath}`)

    // Auto-save cursor telemetry sidecar alongside the video file
    try {
      await cursorTracker.saveToFile(filePath)
    } catch (cursorErr) {
      console.warn('[Velo:Main] Could not auto-save cursor sidecar:', cursorErr)
    }

    // Automatically trigger editor window creation upon saving recording
    try {
      createEditorWindow(filePath)
    } catch (e) {
      console.warn('[Velo:Main] Could not auto-open editor window:', e)
    }

    return { success: true, filePath }
  } catch (error: any) {
    console.error('[Velo:Main] Error saving recording:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('start-cursor-tracking', (_event, options) => {
  console.log('[Velo:Main] IPC handle: start-cursor-tracking', options)
  cursorTracker.start(options)
  return true
})

ipcMain.handle('stop-cursor-tracking', () => {
  console.log('[Velo:Main] IPC handle: stop-cursor-tracking')
  return cursorTracker.stop()
})

ipcMain.handle('load-cursor-telemetry', async (_event, videoPath: string) => {
  return await CursorTracker.loadFromFile(videoPath)
})

ipcMain.handle('register-mouse-click', (_event, button: 'left' | 'right' | 'middle') => {
  cursorTracker.registerClick(button)
  return true
})

ipcMain.handle('open-editor-window', (_event, filePath?: string) => {
  console.log('[Velo:Main] IPC handle: open-editor-window requested for:', filePath)
  createEditorWindow(filePath)
  return true
})

ipcMain.handle('save-exported-video', async (_event, buffer: ArrayBuffer, fileName?: string, targetPath?: string) => {
  console.log(`[Velo:Main] IPC handle: save-exported-video requested (${buffer.byteLength} bytes)`)
  try {
    let filePath = targetPath
    if (!filePath) {
      const exportsDir = path.join(os.homedir(), 'Videos', 'Velo', 'Exports')
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true })
      }
      const defaultName = fileName || `Velo_Export_${Date.now()}.mp4`
      filePath = path.join(exportsDir, defaultName)
    } else {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    const uint8Array = new Uint8Array(buffer)
    await fs.promises.writeFile(filePath, uint8Array)
    console.log(`[Velo:Main] Saved exported video successfully to: ${filePath}`)
    return { success: true, filePath }
  } catch (error: any) {
    console.error('[Velo:Main] Error saving exported video:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-exported-image', async (_event, buffer: ArrayBuffer, fileName?: string, targetPath?: string) => {
  console.log(`[Velo:Main] IPC handle: save-exported-image requested (${buffer.byteLength} bytes)`)
  try {
    let filePath = targetPath
    if (!filePath) {
      const picturesDir = path.join(os.homedir(), 'Pictures', 'Velo')
      if (!fs.existsSync(picturesDir)) {
        fs.mkdirSync(picturesDir, { recursive: true })
      }
      const defaultName = fileName || `Velo_${Date.now()}.png`
      filePath = path.join(picturesDir, defaultName)
    } else {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    const uint8Array = new Uint8Array(buffer)
    await fs.promises.writeFile(filePath, uint8Array)
    console.log(`[Velo:Main] Saved exported screenshot to: ${filePath}`)
    return { success: true, filePath }
  } catch (error: any) {
    console.error('[Velo:Main] Error saving exported image:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('copy-image-to-clipboard', async (_event, buffer: ArrayBuffer) => {
  try {
    const uint8 = Buffer.from(buffer)
    const img = nativeImage.createFromBuffer(uint8)
    clipboard.writeImage(img)
    console.log('[Velo:Main] Exported screenshot copied to clipboard')
    return true
  } catch (err) {
    console.error('[Velo:Main] Error copying image to clipboard:', err)
    return false
  }
})

ipcMain.handle('show-save-dialog', async (event, defaultName: string, format: string) => {
  const win = BrowserWindow.fromWebContents(event.sender) || editorWindow || launcherWindow
  const isImg = ['png', 'jpg', 'jpeg', 'webp'].includes((format || '').toLowerCase())
  const defaultDir = isImg
    ? path.join(os.homedir(), 'Pictures', 'Velo')
    : path.join(os.homedir(), 'Videos', 'Velo', 'Exports')

  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true })
  }

  const fmt = (format || 'mp4').toLowerCase()
  let filters = [{ name: 'MP4 Video (*.mp4)', extensions: ['mp4'] }]
  if (fmt === 'webm') {
    filters = [{ name: 'WebM Video (*.webm)', extensions: ['webm'] }]
  } else if (fmt === 'png') {
    filters = [{ name: 'PNG Image (*.png)', extensions: ['png'] }]
  } else if (fmt === 'jpg' || fmt === 'jpeg') {
    filters = [{ name: 'JPEG Image (*.jpg)', extensions: ['jpg', 'jpeg'] }]
  } else if (fmt === 'webp') {
    filters = [{ name: 'WEBP Image (*.webp)', extensions: ['webp'] }]
  }

  const result = await dialog.showSaveDialog(win!, {
    title: isImg ? 'Export Screenshot As' : 'Export Video As',
    defaultPath: path.join(defaultDir, defaultName),
    filters,
    properties: ['showOverwriteConfirmation', 'createDirectory']
  })
  return { canceled: result.canceled, filePath: result.filePath }
})

ipcMain.handle('show-item-in-folder', async (_event, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath)
      return true
    }
    return false
  } catch (err) {
    console.error('[BetterShot:Main] Error showing item in folder:', err)
    return false
  }
})

// Window controls
ipcMain.on('minimize-launcher', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || launcherWindow
  if (win && !win.isDestroyed()) {
    win.minimize()
  }
})

ipcMain.on('close-launcher', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && win === editorWindow && !win.isDestroyed()) {
    win.close()
    return
  }
  app.exit(0)
})

ipcMain.on('set-launcher-height', (_event, height: number) => {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    if (!height || typeof height !== 'number' || isNaN(height) || height < 200) return
    const safeHeight = Math.max(300, Math.min(700, Math.round(height)))
    const [w, currentH] = launcherWindow.getSize()
    if (currentH === safeHeight) return
    const [x, y] = launcherWindow.getPosition()
    const display = screen.getDisplayNearestPoint({ x, y })
    const workArea = display.workArea
    let newY = y
    if (newY + safeHeight > workArea.y + workArea.height) {
      newY = Math.max(workArea.y + 10, workArea.y + workArea.height - safeHeight - 10)
    }
    if (newY !== y) {
      launcherWindow.setPosition(x, newY, false)
    }
    launcherWindow.setSize(w, safeHeight, false)
  }
})

ipcMain.on('close-editor-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || editorWindow
  if (win && !win.isDestroyed()) {
    win.close()
  }
})

ipcMain.on('toggle-maximize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || editorWindow
  if (win && !win.isDestroyed()) {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  }
})

ipcMain.handle('is-window-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || editorWindow
  return win && !win.isDestroyed() ? win.isMaximized() : false
})

ipcMain.on('set-overlay-draggable', (_event, draggable: boolean) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(!draggable, { forward: true })
  }
})

ipcMain.handle('set-overlay-mode', (_event, mode: 'countdown' | 'recording') => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return false
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH, x: displayX, y: displayY } = primaryDisplay.workArea

  if (mode === 'countdown') {
    const { width: fullW, height: fullH, x: fullX, y: fullY } = primaryDisplay.bounds
    overlayWindow.setBounds({
      x: fullX,
      y: fullY,
      width: fullW,
      height: fullH
    })
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  } else {
    overlayWindow.setBounds({
      x: displayX + Math.round((screenW - 290) / 2),
      y: displayY + screenH - 48 - 30,
      width: 290,
      height: 48
    })
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }
  return true
})

// IPC Multi-Window State Relay (Launcher -> Overlay)
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

ipcMain.on('relay-paused-state', (_event, isPaused: boolean) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('recording-paused-update', isPaused)
  }
})

ipcMain.on('relay-muted-state', (_event, isMuted: boolean) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('recording-muted-update', isMuted)
  }
})

ipcMain.on('relay-countdown-update', (_event, val: number) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('recording-countdown-update', val)
  }
})

// Camera Bubble IPC Handlers
ipcMain.handle('start-camera-bubble', (_event, config?: any) => {
  console.log('[BetterShot:Main] IPC handle: start-camera-bubble', config)
  const win = createCameraBubbleWindow(config)
  if (win && !win.isDestroyed()) {
    win.show()
    win.setAlwaysOnTop(true, 'screen-saver')
    if (config) {
      win.webContents.send('recording-camera-config-update', config)
    }
  }
  return true
})

ipcMain.handle('stop-camera-bubble', () => {
  console.log('[BetterShot:Main] IPC handle: stop-camera-bubble')
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    cameraBubbleWindow.hide()
  }
  return true
})

ipcMain.handle('set-camera-bubble-position', (_event, position: string) => {
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    const currentBounds = cameraBubbleWindow.getBounds()
    const size: 'small' | 'medium' | 'large' = currentBounds.width < 190 ? 'small' : currentBounds.width > 240 ? 'large' : 'medium'
    // Infer shape if it's 16:9
    const shape = currentBounds.width !== currentBounds.height ? '16:9' : 'circle'
    const newBounds = getCameraBubbleBounds(size, position, shape)
    cameraBubbleWindow.setBounds(newBounds)
  }
  return true
})

ipcMain.on('relay-camera-toggle', (_event, enabled: boolean) => {
  console.log('[BetterShot:Main] relay-camera-toggle:', enabled)
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    if (enabled) {
      cameraBubbleWindow.show()
    } else {
      cameraBubbleWindow.hide()
    }
    cameraBubbleWindow.webContents.send('recording-camera-toggle-update', enabled)
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('recording-camera-toggle-update', enabled)
  }
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send('recording-camera-toggle-update', enabled)
  }
})

ipcMain.on('relay-camera-config', (event, config: any) => {
  console.log('[BetterShot:Main] relay-camera-config:', config)
  if (cameraBubbleWindow && !cameraBubbleWindow.isDestroyed()) {
    if (config.size || config.position || config.shape) {
      const bounds = getCameraBubbleBounds(config.size, config.position, config.shape)
      console.log('[BetterShot:Main] Setting camera bubble bounds:', bounds)
      cameraBubbleWindow.setBounds(bounds)
    }
    cameraBubbleWindow.webContents.send('recording-camera-config-update', config)
  }
  // Don't echo config back to the sender window to prevent infinite loop
  const senderWebContentsId = event.sender.id
  if (launcherWindow && !launcherWindow.isDestroyed() && launcherWindow.webContents.id !== senderWebContentsId) {
    launcherWindow.webContents.send('recording-camera-config-update', config)
  }
})

// IPC Multi-Window Controls Relay (Overlay -> Launcher)
ipcMain.on('relay-overlay-control', (_event, command: string) => {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send('launcher-control-command', command)
  }
})

// IPC Multi-Window Theme Relay
ipcMain.on('relay-theme-change', (_event, theme: string) => {
  const windows = [launcherWindow, editorWindow, overlayWindow, selectionWindow]
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme-changed', theme)
    }
  }
})

// Recordings Manager IPC Handlers
ipcMain.handle('get-recordings', async () => {
  try {
    const veloDir = path.join(os.homedir(), 'Videos', 'Velo')
    const legacyDir = path.join(os.homedir(), 'Videos', 'BetterShot')
    const dirsToScan = [veloDir, legacyDir].filter((d) => fs.existsSync(d))
    const recordingFiles: { name: string; filePath: string; size: number; createdAt: number }[] = []

    for (const dir of dirsToScan) {
      const files = await fs.promises.readdir(dir)
      for (const file of files) {
        if (file.endsWith('.webm') || file.endsWith('.mp4')) {
          const filePath = path.join(dir, file)
          const stats = await fs.promises.stat(filePath)
          recordingFiles.push({
            name: file,
            filePath,
            size: stats.size,
            createdAt: stats.birthtimeMs || stats.mtimeMs
          })
        }
      }
    }

    recordingFiles.sort((a, b) => b.createdAt - a.createdAt)
    return recordingFiles
  } catch (err) {
    console.error('[Velo:Main] Error getting recordings:', err)
    return []
  }
})

ipcMain.handle('delete-recording', async (_event, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
      console.log('[BetterShot:Main] Deleted recording file successfully:', filePath)
      return true
    }
    return false
  } catch (err) {
    console.error('[BetterShot:Main] Error deleting recording file:', err)
    return false
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
