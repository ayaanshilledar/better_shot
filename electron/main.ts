import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let launcherWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 350,
    height: 275,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow media streams & local asset previews
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    launcherWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#launcher`)
  } else {
    launcherWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'launcher' })
  }

  launcherWindow.once('ready-to-show', () => {
    launcherWindow?.show()
  })

  launcherWindow.on('closed', () => {
    launcherWindow = null
  })
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 480,
    height: 72,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  // Position at top center of primary display
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width } = primaryDisplay.workAreaSize
  overlayWindow.setPosition(Math.round((width - 480) / 2), 40)

  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#overlay`)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'overlay' })
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

app.whenReady().then(() => {
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

// 1. Get screen & window capture sources
ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  })

  return sources.map(src => ({
    id: src.id,
    name: src.name,
    thumbnailUrl: src.thumbnail.toDataURL(),
    appIconUrl: src.appIcon ? src.appIcon.toDataURL() : null,
    isDisplay: src.id.startsWith('screen:')
  }))
})

// 2. Start recording -> hide launcher, show floating overlay
ipcMain.handle('start-recording-mode', () => {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.hide()
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }
  return true
})

// 3. Stop recording -> hide overlay, restore launcher
ipcMain.handle('stop-recording-mode', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.show()
    launcherWindow.focus()
  }
  return true
})

// 4. Save recorded video blob to disk
ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer, fileName?: string) => {
  try {
    const recordingsDir = path.join(os.homedir(), 'Videos', 'BetterShot')
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true })
    }

    const defaultName = fileName || `BetterShot_${Date.now()}.webm`
    const filePath = path.join(recordingsDir, defaultName)
    const uint8Array = new Uint8Array(buffer)

    await fs.promises.writeFile(filePath, uint8Array)
    shell.showItemInFolder(filePath)
    return { success: true, filePath }
  } catch (error: any) {
    console.error('Error saving recording:', error)
    return { success: false, error: error.message }
  }
})

// 5. Window controls
const handleMinimizeWindow = (event: any) => {
  const win = BrowserWindow.fromWebContents(event.sender) || launcherWindow
  if (win && !win.isDestroyed()) {
    win.minimize()
  }
  return true
}

const handleCloseApp = () => {
  app.exit(0)
  return true
}

ipcMain.on('minimize-launcher', handleMinimizeWindow)
ipcMain.handle('minimize-launcher', handleMinimizeWindow)

ipcMain.on('close-launcher', handleCloseApp)
ipcMain.handle('close-launcher', handleCloseApp)

ipcMain.on('set-overlay-draggable', (_event, draggable: boolean) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(!draggable, { forward: true })
  }
})
