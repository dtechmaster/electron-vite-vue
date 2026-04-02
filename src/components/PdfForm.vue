<script setup lang="ts">
//#region Imports
import { ref, reactive, computed, watch, onMounted } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import $fields from '../composables/$fields'
import $formStore from '../composables/$formStore'
import type { IField, IFieldPos } from '../types'
//#endregion

//#region PDF.js Worker
// Served from public/pdf.worker.mjs (copied by vite.config.ts)
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs'
//#endregion

//#region State
const isLoaded       = ref(false)
const pdfImgSrc      = ref('')
const containerRef   = ref<HTMLDivElement | null>(null)
const containerH     = ref(0)
const calibrateMode  = ref(false)
const mouseCoords    = ref('—')
const selectedField  = ref('—')
const savedPositions = ref<Record<string, IFieldPos>>($formStore.loadPositions())

const formData = reactive<Record<string, string | boolean>>({
  ...$fields.initial(),
  ...$formStore.loadData(),
})
//#endregion

//#region Computed — resolved fields (merge saved positions with defaults)
const resolvedFields = computed(() =>
  $fields.list.map(f => ({
    ...f,
    ...(savedPositions.value[f.id] ?? {}),
  }))
)
//#endregion

//#region Auto-save on every change (debounced)
let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(formData, () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    $formStore.saveData({ ...formData })
  }, 400)
}, { deep: true })
//#endregion

//#region Init — load PDF via IPC, render to canvas, convert to img
onMounted(async () => {
  try {
    const buffer = await window.electronAPI.readPDF()
    const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
    const page   = await pdf.getPage(1)

    const scale   = 2.0 // 2× for sharpness
    const viewport = page.getViewport({ scale })
    const canvas  = document.createElement('canvas')
    canvas.width  = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: canvas.getContext('2d')!,
      viewport,
    }).promise

    pdfImgSrc.value = canvas.toDataURL('image/png')
    isLoaded.value  = true
  } catch (err) {
    console.error('Failed to load PDF:', err)
  }
})

function onImgLoad(e: Event) {
  const img = e.target as HTMLImageElement
  const ratio = img.naturalHeight / img.naturalWidth
  containerH.value = img.offsetWidth * ratio
}
//#endregion

//#region Field Style
function getStyle(field: IField): Record<string, string> {
  const style: Record<string, string> = {
    left: field.left,
    top:  field.top,
  }
  if (field.type !== 'checkbox') {
    if (field.width)  style.width  = field.width
    if (field.height) style.height = field.height
  }
  if (field.size) style.fontSize = field.size
  if (field.xstyle) Object.assign(style, field.xstyle)
  return style
}
//#endregion

//#region Input Handlers
function onTextInput(e: Event, id: string) {
  formData[id] = (e.target as HTMLInputElement | HTMLTextAreaElement).value
}

function onCheckboxChange(e: Event, id: string) {
  formData[id] = (e.target as HTMLInputElement).checked
}

function onKeyDown(e: KeyboardEvent, field: IField) {
  if (field.group !== 'hojin_bangou') return
  const idx = parseInt(field.id.split('_')[2])

  if (e.key === 'Backspace' && (formData[field.id] as string) === '' && idx > 0) {
    e.preventDefault()
    focusBangouCell(idx - 1)
  }
  if (e.key === 'ArrowLeft'  && idx > 0)  { e.preventDefault(); focusBangouCell(idx - 1) }
  if (e.key === 'ArrowRight' && idx < 12) { e.preventDefault(); focusBangouCell(idx + 1) }
}

function onTextInputForAutoAdvance(e: Event, field: IField) {
  onTextInput(e, field.id)
  if (field.group === 'hojin_bangou') {
    const val = (e.target as HTMLInputElement).value
    if (val.length >= 1) {
      const idx = parseInt(field.id.split('_')[2])
      if (idx < 12) focusBangouCell(idx + 1)
    }
  }
}

function focusBangouCell(idx: number) {
  const el = document.getElementById(`hojin_num_${idx}`) as HTMLInputElement | null
  el?.focus()
  el?.select()
}
//#endregion

//#region Calibration Drag
function onMouseDown(e: MouseEvent, field: IField) {
  if (!calibrateMode.value) return
  e.preventDefault()
  e.stopPropagation()

  const container = containerRef.value!
  const cr        = container.getBoundingClientRect()
  const startX    = e.clientX
  const startY    = e.clientY
  const startL    = parseFloat(field.left)
  const startT    = parseFloat(field.top)

  function onMove(e: MouseEvent) {
    const dx   = (e.clientX - startX) / cr.width  * 100
    const dy   = (e.clientY - startY) / cr.height * 100
    const left = (startL + dx).toFixed(2) + '%'
    const top  = (startT + dy).toFixed(2) + '%'

    // Update local state so Vue re-renders
    savedPositions.value = {
      ...savedPositions.value,
      [field.id]: {
        ...(savedPositions.value[field.id] ?? {}),
        left,
        top,
      },
    }
    selectedField.value = `[${field.id}]  left: ${left}  top: ${top}`
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup',   onUp)
    const pos = savedPositions.value[field.id]
    if (pos) $formStore.savePosition(field.id, pos)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup',   onUp)
}

function onContainerMouseMove(e: MouseEvent) {
  if (!calibrateMode.value) return
  const rect = containerRef.value!.getBoundingClientRect()
  const x    = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1)
  const y    = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1)
  mouseCoords.value = `${x}%,  ${y}%`
}
//#endregion

//#region Controls
function toggleCalibrate() {
  calibrateMode.value = !calibrateMode.value
  selectedField.value = '—'
  mouseCoords.value   = '—'
}

function resetPositions() {
  if (!confirm('フィールドの位置をデフォルトにリセットしますか？')) return
  $formStore.clearPositions()
  savedPositions.value = {}
}

function clearForm() {
  if (!confirm('入力内容をすべてクリアしますか？')) return
  Object.assign(formData, $fields.initial())
  $formStore.clearData()
}

async function saveToFile() {
  const json   = JSON.stringify({ ...formData }, null, 2)
  const result = await window.electronAPI.saveData(json)
  if (!result.success) console.log('Save cancelled')
}

async function loadFromFile() {
  const result = await window.electronAPI.loadData()
  if (!result.success || !result.data) return
  try {
    const data = JSON.parse(result.data) as Record<string, string | boolean>
    Object.assign(formData, data)
  } catch (err) {
    console.error('Failed to parse JSON:', err)
    alert('ファイルの読み込みに失敗しました。')
  }
}

function printForm() {
  window.electronAPI.print()
}
//#endregion
</script>

<template>
  <!--#region Controls Bar -->
  <div id="controls">
    <span class="app-title">異動届出書 入力ツール</span>
    <div class="btn-group">
      <button class="btn btn-blue"      @click="saveToFile">💾 保存</button>
      <button class="btn btn-purple"    @click="loadFromFile">📂 読込</button>
      <button class="btn btn-orange"    @click="toggleCalibrate">
        {{ calibrateMode ? '✅ 完了' : '🎯 位置調整' }}
      </button>
      <button class="btn btn-muted"     @click="resetPositions">↺ 位置リセット</button>
      <button class="btn btn-red"       @click="clearForm">🗑 クリア</button>
      <button class="btn btn-green"     @click="printForm">🖨 印刷</button>
    </div>
  </div>
  <!--#endregion-->

  <!--#region Form Area -->
  <div class="form-wrapper">
    <div v-if="!isLoaded" class="loading-msg">PDFを読み込み中...</div>

    <div
      ref="containerRef"
      class="form-container"
      :class="{ calibrate: calibrateMode }"
      :style="{ height: containerH > 0 ? containerH + 'px' : 'auto' }"
      @mousemove="onContainerMouseMove"
    >
      <img
        :src="pdfImgSrc"
        class="pdf-img"
        alt="異動届出書"
        draggable="false"
        @load="onImgLoad"
      >

      <!--#region Dynamic Inputs -->
      <template v-for="field in resolvedFields" :key="field.id">
        <!-- Textarea -->
        <textarea
          v-if="field.type === 'textarea'"
          :id="field.id"
          class="pdf-input"
          :style="getStyle(field)"
          :title="field.label"
          :data-field-id="field.id"
          :value="(formData[field.id] as string) ?? ''"
          @input="onTextInput($event, field.id)"
          @mousedown="onMouseDown($event, field)"
        />

        <!-- Checkbox -->
        <input
          v-else-if="field.type === 'checkbox'"
          :id="field.id"
          class="pdf-input pdf-checkbox"
          type="checkbox"
          :style="getStyle(field)"
          :title="field.label"
          :data-field-id="field.id"
          :checked="(formData[field.id] as boolean) ?? false"
          @change="onCheckboxChange($event, field.id)"
          @mousedown="onMouseDown($event, field)"
        />

        <!-- Text input -->
        <input
          v-else
          :id="field.id"
          class="pdf-input"
          type="text"
          :style="getStyle(field)"
          :title="field.label"
          :data-field-id="field.id"
          :maxlength="field.max ?? undefined"
          :placeholder="field.placeholder ?? ''"
          :value="(formData[field.id] as string) ?? ''"
          @input="onTextInputForAutoAdvance($event, field)"
          @keydown="onKeyDown($event, field)"
          @mousedown="onMouseDown($event, field)"
        />
      </template>
      <!--#endregion-->
    </div>
  </div>
  <!--#endregion-->

  <!--#region Calibration Info Panel -->
  <Transition name="fade">
    <div v-if="calibrateMode" class="calibrate-panel">
      <b>🎯 位置調整モード</b><br>
      マウス: <code>{{ mouseCoords }}</code><br>
      選択中: <code>{{ selectedField }}</code><br>
      <small>フィールドをドラッグして移動</small>
    </div>
  </Transition>
  <!--#endregion-->
</template>

<style scoped>
/*#region Controls */
#controls {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #11111b;
  border-bottom: 1px solid #313244;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

.app-title {
  font-size: 13px;
  font-weight: 700;
  color: #cdd6f4;
  flex: 1;
  letter-spacing: 0.02em;
}

.btn-group { display: flex; gap: 6px; flex-shrink: 0; }

.btn {
  padding: 5px 13px;
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

.btn-green  { background: #a6e3a1; color: #1e1e2e; }
.btn-red    { background: #f38ba8; color: #1e1e2e; }
.btn-orange { background: #fab387; color: #1e1e2e; }
.btn-blue   { background: #89b4fa; color: #1e1e2e; }
.btn-purple { background: #b4befe; color: #1e1e2e; }
.btn-muted  { background: #45475a; color: #cdd6f4; }
/*#endregion*/

/*#region Form Wrapper */
.form-wrapper {
  display: flex;
  justify-content: center;
  padding: 20px 20px 40px;
}

.loading-msg {
  color: #6c7086;
  padding: 40px;
  font-size: 14px;
}

.form-container {
  position: relative;
  display: inline-block;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
  line-height: 0;
}

.pdf-img {
  display: block;
  width: 820px;
  height: auto;
  user-select: none;
}
/*#endregion*/

/*#region PDF Inputs */
.pdf-input {
  position: absolute;
  background: rgba(250, 250, 80, 0.18);
  border: 1px dashed rgba(100, 160, 255, 0.4);
  border-radius: 2px;
  padding: 1px 3px;
  font-family: 'メイリオ', Meiryo, 'MS Gothic', monospace;
  color: #000;
  outline: none;
  line-height: 1.25;
  transition: background 0.1s, border 0.1s;
}

.pdf-input:focus {
  background: rgba(250, 250, 80, 0.55);
  border: 1.5px solid rgba(100, 160, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(100, 160, 255, 0.18);
  z-index: 50;
}

.pdf-checkbox {
  background: transparent;
  border: 1px dashed rgba(100, 160, 255, 0.4);
  padding: 0;
  cursor: pointer;
  width: 13px !important;
  height: 13px !important;
  accent-color: #1a40af;
}

textarea.pdf-input {
  resize: none;
  vertical-align: top;
  overflow: hidden;
}

/* Calibration mode: inputs are red and grabbable */
.calibrate .pdf-input {
  background: rgba(255, 80, 80, 0.18) !important;
  border: 1.5px solid rgba(255, 60, 60, 0.7) !important;
  cursor: grab !important;
}
.calibrate .pdf-input:active { cursor: grabbing !important; }
/*#endregion*/

/*#region Calibration Panel */
.calibrate-panel {
  position: fixed;
  bottom: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.88);
  color: #a6e3a1;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.8;
  z-index: 9999;
  min-width: 280px;
  border: 1px solid #313244;
}

.calibrate-panel code {
  color: #89dceb;
  font-size: 11px;
}

.calibrate-panel small { color: #6c7086; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
/*#endregion*/

/*#region Print */
@media print {
  @page { size: A4 portrait; margin: 0; }

  #controls { display: none !important; }

  .form-wrapper {
    padding: 0;
    display: block;
  }

  .form-container {
    width: 210mm !important;
    height: 297mm !important;
    display: block !important;
    overflow: hidden;
    box-shadow: none !important;
  }

  .pdf-img {
    position: absolute;
    top: 0; left: 0;
    width: 100% !important;
    height: 100% !important;
    object-fit: fill !important;
  }

  .pdf-input {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: #000 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .pdf-checkbox {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    -webkit-appearance: checkbox;
    appearance: checkbox;
    color-scheme: light;
  }

  .calibrate-panel { display: none !important; }
}
/*#endregion*/
</style>
