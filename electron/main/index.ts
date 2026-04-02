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
if (process.platform === 'win32')   app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// #region Store helpers
interface IStoredFile {
  filePath:    string
  fileName:    string
  lastOpened:  string
  lastSaved?:  string
  formData:    Record<string, string | boolean>
}
interface IFormsStore {
  version: number
  files:   Record<string, IStoredFile>
}

function getStoreFile(): string {
  return path.join(app.getPath('userData'), 'forms.json')
}

function readStore(): IFormsStore {
  try { return JSON.parse(fs.readFileSync(getStoreFile(), 'utf-8')) }
  catch { return { version: 1, files: {} } }
}

function writeStore(store: IFormsStore): void {
  fs.writeFileSync(getStoreFile(), JSON.stringify(store, null, 2), 'utf-8')
}
// #endregion

// #region Window
let win: BrowserWindow | null = null
const preload   = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title:  '異動届出書 入力ツール',
    width:  1120,
    height: 920,
    minWidth:  860,
    minHeight: 600,
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

// #region IPC — Open PDF (file dialog)
ipcMain.handle('open-pdf', async () => {
  const result = await dialog.showOpenDialog(win!, {
    title:   'PDFファイルを開く',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return null

  const filePath = result.filePaths[0]
  let pdfData: Buffer
  try {
    pdfData = await fs.promises.readFile(filePath)
  } catch {
    return { error: 'read_failed' }
  }

  const store = readStore()
  if (!store.files[filePath]) {
    store.files[filePath] = {
      filePath,
      fileName:   path.basename(filePath),
      lastOpened: new Date().toISOString(),
      formData:   {},
    }
  } else {
    store.files[filePath].lastOpened = new Date().toISOString()
  }
  writeStore(store)

  return {
    filePath,
    fileName: store.files[filePath].fileName,
    pdfData,
    formData: store.files[filePath].formData,
  }
})
// #endregion

// #region IPC — Get file list
ipcMain.handle('get-files', () => {
  const store = readStore()
  return Object.values(store.files)
    .map(({ filePath, fileName, lastOpened, lastSaved }) => ({
      filePath,
      fileName,
      lastOpened,
      lastSaved,
      exists: fs.existsSync(filePath),
    }))
    .sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime())
})
// #endregion

// #region IPC — Load a specific registered PDF
ipcMain.handle('load-pdf-file', async (_event, filePath: string) => {
  const store = readStore()
  const info  = store.files[filePath]
  if (!info) return null

  let pdfData: Buffer
  try {
    pdfData = await fs.promises.readFile(filePath)
  } catch {
    return { error: 'read_failed', filePath }
  }

  store.files[filePath].lastOpened = new Date().toISOString()
  writeStore(store)

  return {
    filePath,
    fileName: info.fileName,
    pdfData,
    formData: info.formData,
  }
})
// #endregion

// #region IPC — Auto-save form data
ipcMain.handle('save-form-data', (_event, filePath: string, formData: Record<string, string | boolean>) => {
  const store = readStore()
  if (!store.files[filePath]) return
  store.files[filePath].formData  = formData
  store.files[filePath].lastSaved = new Date().toISOString()
  writeStore(store)
})
// #endregion

// #region IPC — Remove file from history
ipcMain.handle('remove-file', (_event, filePath: string) => {
  const store = readStore()
  delete store.files[filePath]
  writeStore(store)
})
// #endregion

// #region IPC — Print
ipcMain.handle('print', () => {
  win?.webContents.print(
    { silent: false, printBackground: false, pageSize: 'A4', landscape: false },
    (success, err) => { if (!success) console.error('Print error:', err) }
  )
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
