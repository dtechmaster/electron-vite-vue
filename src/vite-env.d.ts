/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    readPDF():              Promise<ArrayBuffer>
    print():               Promise<void>
    saveData(json: string): Promise<{ success: boolean }>
    loadData():            Promise<{ success: boolean; data: string }>
  }
}
