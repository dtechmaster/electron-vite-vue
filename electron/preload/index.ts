// #region Imports
import { ipcRenderer, contextBridge } from 'electron'
// #endregion

// #region Electron API — exposed to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  readPDF():                         Promise<ArrayBuffer> { return ipcRenderer.invoke('read-pdf') },
  print():                           Promise<void>        { return ipcRenderer.invoke('print') },
  saveData(json: string):            Promise<{ success: boolean }> { return ipcRenderer.invoke('save-data', json) },
  loadData():                        Promise<{ success: boolean; data: string }> { return ipcRenderer.invoke('load-data') },
})
// #endregion

// #region Loading Splash
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise<void>((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve()
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) resolve()
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) parent.appendChild(child)
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) parent.removeChild(child)
  },
}

function useLoading() {
  const className = 'app-loading-spin'
  const styleContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .${className} {
      width: 40px; height: 40px;
      border: 3px solid #313244;
      border-top-color: #cdd6f4;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .app-loading-wrap {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: #1e1e2e;
      z-index: 9999;
    }
  `
  const oStyle = document.createElement('style')
  const oDiv   = document.createElement('div')
  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className   = 'app-loading-wrap'
  oDiv.innerHTML   = `<div class="${className}"></div>`

  return {
    appendLoading() { safeDOM.append(document.head, oStyle); safeDOM.append(document.body, oDiv) },
    removeLoading() { safeDOM.remove(document.head, oStyle); safeDOM.remove(document.body, oDiv) },
  }
}

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)
window.onmessage = (ev) => { ev.data.payload === 'removeLoading' && removeLoading() }
setTimeout(removeLoading, 5000)
// #endregion
