import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

// Copy pdfjs worker into public/ so it's available in both dev server and prod build
function copyPdfWorker() {
  const src  = path.resolve('node_modules/pdfjs-dist/build/pdf.worker.mjs')
  const dest = path.resolve('public/pdf.worker.mjs')
  try { fs.copyFileSync(src, dest) } catch { /* handled at runtime */ }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  fs.rmSync('dist-electron', { recursive: true, force: true })

  copyPdfWorker()

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    // Required for Electron file:// protocol — all asset URLs become relative
    base: './',

    plugins: [
      vue(),
      electron({
        main: {
          entry: 'electron/main/index.ts',
          onstart({ startup }) {
            if (process.env.VSCODE_DEBUG) {
              console.log('[startup] Electron App')
            } else {
              startup()
            }
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
          },
        },
        preload: {
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
          },
        },
        renderer: {},
      }),
    ],
    server: process.env.VSCODE_DEBUG && (() => {
      const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
      return { host: url.hostname, port: +url.port }
    })(),
    clearScreen: false,
  }
})
