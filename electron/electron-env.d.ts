/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    VSCODE_DEBUG?: 'true'
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// #region Renderer window API (exposed via contextBridge)
interface Window {
  electronAPI: {
    readPDF():                         Promise<ArrayBuffer>
    print():                           Promise<void>
    saveData(json: string):            Promise<{ success: boolean }>
    loadData():                        Promise<{ success: boolean; data: string }>
  }
}
// #endregion
