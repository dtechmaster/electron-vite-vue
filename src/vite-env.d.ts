/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// #region Shared data shapes (mirrored from preload)
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

// #region Window — contextBridge
interface Window {
  electronAPI: {
    openPDF():                                                     Promise<ILoadedFile | IOpenError | null>
    getFiles():                                                    Promise<IFileMeta[]>
    loadPDFFile(filePath: string):                                 Promise<ILoadedFile | IOpenError | null>
    saveFormData(filePath: string, data: Record<string, unknown>): Promise<void>
    removeFile(filePath: string):                                  Promise<void>
    print():                                                       Promise<void>
  }
}
// #endregion
