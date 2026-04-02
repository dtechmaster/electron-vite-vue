// #region Imports
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
// #endregion

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST     = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// #region Window
let win: BrowserWindow | null = null
const preload  = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title:           '異動届出書 入力ツール',
    width:           900,
    height:          920,
    minWidth:        860,
    minHeight:       600,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}
// #endregion

// #region IPC — PDF
ipcMain.handle('read-pdf', async () => {
  const pdfPath = path.join(process.env.VITE_PUBLIC!, 'form.pdf')
  return await fs.promises.readFile(pdfPath)
})
// #endregion

// #region IPC — Print
ipcMain.handle('print', () => {
  if (!win) return
  win.webContents.print(
    {
      silent: false,
      printBackground: false,
      pageSize: 'A4',
      landscape: false,
    },
    (success, errorType) => {
      if (!success) console.error('Print failed:', errorType)
    }
  )
})
// #endregion

// #region IPC — File Save / Load
ipcMain.handle('save-data', async (_event, jsonString: string) => {
  const result = await dialog.showSaveDialog(win!, {
    title: 'データを保存',
    defaultPath: '異動届出書_データ.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return { success: false }
  await fs.promises.writeFile(result.filePath, jsonString, 'utf-8')
  return { success: true }
})

ipcMain.handle('load-data', async () => {
  const result = await dialog.showOpenDialog(win!, {
    title: 'データを読み込む',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return { success: false, data: '' }
  const data = await fs.promises.readFile(result.filePaths[0], 'utf-8')
  return { success: true, data }
})
// #endregion

// #region App Events
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) allWindows[0].focus()
  else createWindow()
})
// #endregion
