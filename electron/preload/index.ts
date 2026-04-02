// #region Imports
import { ipcRenderer, contextBridge } from 'electron'
// #endregion

// #region Electron API
contextBridge.exposeInMainWorld('electronAPI', {
  openPDF():                                                        Promise<ILoadedFile | IOpenError | null> { return ipcRenderer.invoke('open-pdf') },
  getFiles():                                                       Promise<IFileMeta[]>   { return ipcRenderer.invoke('get-files') },
  loadPDFFile(filePath: string):                                    Promise<ILoadedFile | IOpenError | null> { return ipcRenderer.invoke('load-pdf-file', filePath) },
  saveFormData(filePath: string, data: Record<string, unknown>):    Promise<void>          { return ipcRenderer.invoke('save-form-data', filePath, data) },
  removeFile(filePath: string):                                     Promise<void>          { return ipcRenderer.invoke('remove-file', filePath) },
  print():                                                          Promise<void>          { return ipcRenderer.invoke('print') },
})
// #endregion

// #region Shared types (available at preload scope only — duplicated in vite-env.d.ts for renderer)
interface IFileMeta {
  filePath:   string
  fileName:   string
  lastOpened: string
  lastSaved?: string
  exists:     boolean
}
interface ILoadedFile {
  filePath: string
  fileName: string
  pdfData:  ArrayBuffer
  formData: Record<string, string | boolean>
}
interface IOpenError {
  error: 'read_failed'
  filePath?: string
}
// #endregion

// #region Loading Splash
function domReady(cond: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise<void>(resolve => {
    if (cond.includes(document.readyState)) resolve()
    else document.addEventListener('readystatechange', () => { if (cond.includes(document.readyState)) resolve() })
  })
}

const safeDOM = {
  append(p: HTMLElement, c: HTMLElement) { if (!Array.from(p.children).includes(c)) p.appendChild(c) },
  remove(p: HTMLElement,  c: HTMLElement) { if (Array.from(p.children).includes(c))  p.removeChild(c) },
}

function useLoading() {
  const cls  = 'app-loading-spin'
  const style = document.createElement('style')
  const wrap  = document.createElement('div')
  style.id = 'app-loading-style'
  style.innerHTML = `
    @keyframes spin { to { transform: rotate(360deg) } }
    .${cls} { width:40px;height:40px;border:3px solid #313244;border-top-color:#cdd6f4;border-radius:50%;animation:spin .8s linear infinite }
    .app-loading-wrap { position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1e1e2e;z-index:9999 }
  `
  wrap.className  = 'app-loading-wrap'
  wrap.innerHTML  = `<div class="${cls}"></div>`
  return {
    appendLoading() { safeDOM.append(document.head, style); safeDOM.append(document.body, wrap) },
    removeLoading() { safeDOM.remove(document.head, style); safeDOM.remove(document.body, wrap) },
  }
}

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)
window.onmessage = ev => { ev.data.payload === 'removeLoading' && removeLoading() }
setTimeout(removeLoading, 5000)
// #endregion
