<script setup lang="ts">
//#region Imports
import { ref, onMounted } from 'vue'
import FileList from './components/FileList.vue'
import PdfForm  from './components/PdfForm.vue'
//#endregion

//#region State
const fileList    = ref<IFileMeta[]>([])
const currentFile = ref<ILoadedFile | null>(null)
const pdfFormRef  = ref<InstanceType<typeof PdfForm> | null>(null)
const errorMsg    = ref<string | null>(null)
const previewMode = ref(false)
//#endregion

//#region Load file list on startup + auto-open last file
onMounted(async () => {
  fileList.value = await window.electronAPI.getFiles()
  if (fileList.value.length > 0 && fileList.value[0].exists) {
    await loadFile(fileList.value[0].filePath)
  }
})
//#endregion

//#region Open PDF (file dialog)
async function openPDF(): Promise<void> {
  errorMsg.value = null
  const result = await window.electronAPI.openPDF()
  if (!result) return
  if ('error' in result) { errorMsg.value = 'ファイルを読み込めませんでした。'; return }

  currentFile.value = result
  fileList.value    = await window.electronAPI.getFiles()
}
//#endregion

//#region Switch to a file from the list
async function loadFile(filePath: string): Promise<void> {
  errorMsg.value = null
  const result   = await window.electronAPI.loadPDFFile(filePath)
  if (!result) return
  if ('error' in result) { errorMsg.value = 'ファイルを読み込めませんでした。'; return }

  currentFile.value = result
  fileList.value    = await window.electronAPI.getFiles()
}
//#endregion

//#region Remove file from history
async function removeFile(filePath: string): Promise<void> {
  await window.electronAPI.removeFile(filePath)
  fileList.value = await window.electronAPI.getFiles()
  if (currentFile.value?.filePath === filePath) currentFile.value = null
}
//#endregion

//#region Auto-save handler (called by PdfForm via emit)
async function onSave(data: Record<string, string | boolean>): Promise<void> {
  if (!currentFile.value) return
  await window.electronAPI.saveFormData(currentFile.value.filePath, data)
  // Refresh sidebar to show updated lastSaved
  const idx = fileList.value.findIndex(f => f.filePath === currentFile.value!.filePath)
  if (idx !== -1) fileList.value[idx] = { ...fileList.value[idx], lastSaved: new Date().toISOString() }
}
//#endregion

//#region Print
function printForm(): void { window.electronAPI.print() }
//#endregion

//#region Move mode toggle
function toggleMoveMode(): void {
  if (!pdfFormRef.value) return
  pdfFormRef.value.calibrateMode = !pdfFormRef.value.calibrateMode
}
//#endregion

//#region Field management
function addField(): void    { pdfFormRef.value?.addField() }
function detectFields(): void { pdfFormRef.value?.detectAnnotations() }
//#endregion
</script>

<template>
  <div class="app-layout">

    <!--#region Controls Bar -->
    <header id="controls">
      <span class="app-title">異動届出書 入力ツール</span>
      <div class="btn-group">
        <button class="btn btn-blue" @click="openPDF">🗂 PDF を開く</button>
        <button
          v-if="currentFile"
          class="btn btn-outline"
          @click="detectFields"
        >🔍 フィールド検出</button>
        <button
          v-if="currentFile"
          class="btn btn-outline"
          @click="addField"
        >＋ フィールド追加</button>
        <button
          v-if="currentFile"
          class="btn"
          :class="pdfFormRef?.calibrateMode ? 'btn-active' : 'btn-outline'"
          @click="toggleMoveMode"
        >✥ 移動</button>
        <button
          v-if="currentFile"
          class="btn"
          :class="previewMode ? 'btn-active' : 'btn-outline'"
          @click="previewMode = !previewMode"
        >👁 プレビュー</button>
        <button
          v-if="currentFile"
          class="btn btn-green"
          @click="printForm"
        >🖨 印刷・PDF</button>
      </div>
      <span v-if="errorMsg" class="error-msg">⚠ {{ errorMsg }}</span>
    </header>
    <!--#endregion-->

    <!--#region Content Area -->
    <div class="content-area">

      <!--#region Sidebar -->
      <FileList
        :files="fileList"
        :current-path="currentFile?.filePath ?? null"
        @select="loadFile"
        @open="openPDF"
        @remove="removeFile"
      />
      <!--#endregion-->

      <!--#region Form or Empty State -->
      <div class="form-area">
        <PdfForm
          v-if="currentFile"
          ref="pdfFormRef"
          :file-path="currentFile.filePath"
          :pdf-buffer="currentFile.pdfData"
          :initial-form-data="currentFile.formData"
          :preview-mode="previewMode"
          @save="onSave"
        />

        <div v-else class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-title">PDFを開いてください</p>
          <p class="empty-sub">異動届出書 などの PDF ファイルを開いて入力できます</p>
          <button class="btn btn-blue btn-lg" @click="openPDF">🗂 PDF を開く</button>
          <p class="empty-hint">
            入力内容は自動的に保存されます<br>
            <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> で元に戻す / やり直し
          </p>
        </div>
      </div>
      <!--#endregion-->

    </div>
    <!--#endregion-->

  </div>
</template>

<style>
/* Global resets */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #app {
  height: 100%;
  background: #1e1e2e;
  font-family: 'メイリオ', Meiryo, 'MS Gothic', sans-serif;
  overflow: hidden;
}
</style>

<style scoped>
/*#region App Layout */
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
/*#endregion*/

/*#region Controls Bar */
#controls {
  flex-shrink: 0;
  background: #11111b;
  border-bottom: 1px solid #313244;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.app-title {
  font-size: 13px;
  font-weight: 700;
  color: #cdd6f4;
  flex: 1;
  letter-spacing: 0.02em;
}

.btn-group { display: flex; gap: 6px; }

.btn {
  padding: 5px 14px;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.12s, transform 0.08s;
  white-space: nowrap;
}
.btn:hover  { opacity: 0.85; }
.btn:active { transform: scale(0.97); }
.btn-green   { background: #a6e3a1; color: #1e1e2e; }
.btn-blue    { background: #89b4fa; color: #1e1e2e; }
.btn-outline { background: transparent; border: 1px solid #45475a; color: #cdd6f4; }
.btn-outline:hover { border-color: #cdd6f4; }
.btn-active  { background: #cba6f7; color: #1e1e2e; }
.btn-lg     { padding: 10px 24px; font-size: 14px; }

.error-msg {
  font-size: 12px;
  color: #f38ba8;
}
/*#endregion*/

/*#region Content Area */
.content-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.form-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/*#endregion*/

/*#region Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6c7086;
  padding: 40px;
  text-align: center;
}

.empty-icon  { font-size: 56px; margin-bottom: 8px; }
.empty-title { font-size: 18px; color: #cdd6f4; font-weight: 600; }
.empty-sub   { font-size: 13px; max-width: 340px; line-height: 1.6; }

.empty-hint {
  font-size: 11px;
  color: #45475a;
  line-height: 2;
  margin-top: 8px;
}

.empty-hint kbd {
  background: #313244;
  color: #cdd6f4;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
}
/*#endregion*/

/*#region Print */
@media print {
  #controls { display: none !important; }
  .content-area { display: block; overflow: visible; }
  .form-area { display: block; overflow: visible; }
}
/*#endregion*/
</style>
