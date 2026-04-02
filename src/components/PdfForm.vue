<script setup lang="ts">
//#region Imports
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import $fields from '../composables/$fields'
import $formStore from '../composables/$formStore'
import type { IField, IFieldPos, IFieldStyle } from '../types'
//#endregion

//#region Props & Emits
interface Props {
  filePath:        string
  pdfBuffer:       ArrayBuffer
  initialFormData: Record<string, string | boolean>
  previewMode?:    boolean
}
const props = defineProps<Props>()
const emit  = defineEmits<{
  /** Fired (debounced) whenever any field changes — parent persists to disk */
  save: [data: Record<string, string | boolean>]
}>()
//#endregion

//#region PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.js'
//#endregion

//#region State
const isLoaded      = ref(false)
const loadError     = ref<string | null>(null)
const pdfImgSrc     = ref('')
const containerRef  = ref<HTMLDivElement | null>(null)
const containerH    = ref(0)
const calibrateMode = ref(false)
const mouseCoords   = ref('—')
const selectedField = ref('—')

const savedPositions = ref<Record<string, IFieldPos>>($formStore.loadPositions())
const savedStyles    = ref<Record<string, IFieldStyle>>($formStore.loadStyles())

const activeFieldId = ref<string | null>(null)
const toolbarPos    = ref({ top: 0, left: 0 })

const formData = reactive<Record<string, string | boolean>>({
  ...$fields.initial(),
  ...props.initialFormData,
})
//#endregion

//#region Undo / Redo
const MAX_HISTORY = 100
const history      = ref<Record<string, string | boolean>[]>([])
const historyIndex = ref(-1)

function pushHistory(): void {
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push({ ...formData })
  if (history.value.length > MAX_HISTORY) history.value.shift()
  else historyIndex.value++
}

function applyHistory(snapshot: Record<string, string | boolean>): void {
  Object.assign(formData, snapshot)
  scheduleSave()
}

function undo(): void {
  if (historyIndex.value <= 0) return
  historyIndex.value--
  applyHistory(history.value[historyIndex.value])
}

function redo(): void {
  if (historyIndex.value >= history.value.length - 1) return
  historyIndex.value++
  applyHistory(history.value[historyIndex.value])
}
//#endregion

//#region Auto-save (debounced)
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => emit('save', { ...formData }), 800)
}
//#endregion

//#region PDF Rendering
async function renderPDF(buffer: ArrayBuffer): Promise<void> {
  isLoaded.value  = false
  loadError.value = null
  pdfImgSrc.value = ''

  try {
    const pdf      = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    const page     = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas   = document.createElement('canvas')
    canvas.width   = viewport.width
    canvas.height  = viewport.height

    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise

    pdfImgSrc.value = canvas.toDataURL('image/png')
    isLoaded.value  = true
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
    console.error('[PdfForm] renderPDF failed:', err)
  }
}

// Re-render whenever the PDF buffer changes (file switch)
watch(() => props.pdfBuffer, buf => { if (buf) renderPDF(buf) }, { immediate: true })
//#endregion

//#region Reset when file changes
watch(
  () => props.filePath,
  () => {
    history.value       = []
    historyIndex.value  = -1
    calibrateMode.value = false
    activeFieldId.value = null
    Object.assign(formData, $fields.initial(), props.initialFormData)
    nextTick(pushHistory)
  },
  { immediate: true }
)
//#endregion

//#region Computed — merge saved positions into field definitions
const resolvedFields = computed(() =>
  $fields.list.map(f => {
    const saved = savedPositions.value[f.id]
    return saved ? { ...f, ...saved } : f
  })
)
//#endregion

//#region Input Handlers
function onTextInput(e: Event, field: IField): void {
  formData[field.id] = (e.target as HTMLInputElement | HTMLTextAreaElement).value
  pushHistory()
  scheduleSave()
}

function onCheckboxChange(e: Event, id: string): void {
  formData[id] = (e.target as HTMLInputElement).checked
  pushHistory()
  scheduleSave()
}

function onKeyDown(e: KeyboardEvent, field: IField): void {
  if (field.group !== 'hojin_bangou') return
  const idx = parseInt(field.id.split('_')[2])
  if (e.key === 'Backspace' && (formData[field.id] as string) === '' && idx > 0) {
    e.preventDefault(); focusBangouCell(idx - 1)
  }
  if (e.key === 'ArrowLeft'  && idx > 0)  { e.preventDefault(); focusBangouCell(idx - 1) }
  if (e.key === 'ArrowRight' && idx < 12) { e.preventDefault(); focusBangouCell(idx + 1) }
}

function onTextInputAutoAdvance(e: Event, field: IField): void {
  onTextInput(e, field)
  if (field.group === 'hojin_bangou' && (formData[field.id] as string).length >= 1) {
    const idx = parseInt(field.id.split('_')[2])
    if (idx < 12) focusBangouCell(idx + 1)
  }
}

function focusBangouCell(idx: number): void {
  const el = document.getElementById(`hojin_num_${idx}`) as HTMLInputElement | null
  el?.focus(); el?.select()
}
//#endregion

//#region Calibration — toggle button to enter, ESC to exit, drag to reposition / resize
function onFieldMouseDown(e: MouseEvent, field: IField): void {
  if (!calibrateMode.value) return
  e.preventDefault()

  const container = containerRef.value!
  const cr        = container.getBoundingClientRect()
  const startX    = e.clientX
  const startY    = e.clientY
  const startL    = parseFloat((savedPositions.value[field.id]?.left ?? field.left))
  const startT    = parseFloat((savedPositions.value[field.id]?.top  ?? field.top))

  function onMove(e: MouseEvent) {
    const left = (startL + (e.clientX - startX) / cr.width  * 100).toFixed(2) + '%'
    const top  = (startT + (e.clientY - startY) / cr.height * 100).toFixed(2) + '%'
    savedPositions.value = {
      ...savedPositions.value,
      [field.id]: { ...(savedPositions.value[field.id] ?? {}), left, top },
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

function onResizeMouseDown(e: MouseEvent, field: IField): void {
  e.preventDefault()

  const cr     = containerRef.value!.getBoundingClientRect()
  const startX = e.clientX
  const startY = e.clientY
  const startW = parseFloat(savedPositions.value[field.id]?.width  ?? field.width  ?? '10')
  const startH = parseFloat(savedPositions.value[field.id]?.height ?? field.height ?? '2')

  function onMove(mv: MouseEvent) {
    const width  = Math.max(1,   startW + (mv.clientX - startX) / cr.width  * 100).toFixed(2) + '%'
    const height = Math.max(0.5, startH + (mv.clientY - startY) / cr.height * 100).toFixed(2) + '%'
    savedPositions.value = {
      ...savedPositions.value,
      [field.id]: { ...(savedPositions.value[field.id] ?? {}), width, height },
    }
    selectedField.value = `[${field.id}]  w: ${width}  h: ${height}`
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

const resizableFields = computed(() =>
  resolvedFields.value.filter(f => {
    if (f.type === 'checkbox') return false
    const saved = savedPositions.value[f.id]
    return (saved?.width ?? f.width) && (saved?.height ?? f.height)
  })
)

function getResizeHandleStyle(field: IField): Record<string, string> {
  const saved = savedPositions.value[field.id]
  const w = saved?.width  ?? field.width  ?? '0%'
  const h = saved?.height ?? field.height ?? '0%'
  return {
    left: `calc(${field.left} + ${w} - 7px)`,
    top:  `calc(${field.top}  + ${h} - 7px)`,
  }
}

function onContainerMouseMove(e: MouseEvent): void {
  if (!calibrateMode.value) return
  const r = containerRef.value!.getBoundingClientRect()
  mouseCoords.value = `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%,  ${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`
}

function onImgLoad(e: Event): void {
  const img   = e.target as HTMLImageElement
  const ratio = img.naturalHeight / img.naturalWidth
  containerH.value = img.offsetWidth * ratio
}
//#endregion

//#region Global Keyboard Shortcuts
function onGlobalKeyDown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
  if (e.key === 'Escape') {
    calibrateMode.value = false
    selectedField.value = '—'
    mouseCoords.value   = '—'
    activeFieldId.value = null
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeyDown))
//#endregion

//#region Field Style helper
function getStyle(field: IField): Record<string, string> {
  const style: Record<string, string> = {
    left: field.left,
    top:  field.top,
  }
  if (field.type !== 'checkbox') {
    if (field.width)  style.width  = field.width
    if (field.height) style.height = field.height
  }
  if (field.size)   style.fontSize = field.size
  if (field.xstyle) Object.assign(style, field.xstyle)

  // Apply per-field style overrides
  const s = savedStyles.value[field.id]
  if (s?.fontSize)      style.fontSize      = s.fontSize
  if (s?.color)         style.color         = s.color
  if (s?.background)    style.background    = s.background
  if (s?.letterSpacing) style.letterSpacing = s.letterSpacing

  return style
}
//#endregion

//#region Reset positions
function resetPositions(): void {
  if (!confirm('フィールドの位置をデフォルトにリセットしますか？')) return
  $formStore.clearPositions()
  savedPositions.value = {}
}
//#endregion

//#region Field Selection & Style Toolbar
function selectField(id: string): void {
  activeFieldId.value = id
  nextTick(updateToolbarPos)
}

function updateToolbarPos(): void {
  if (!activeFieldId.value || !containerRef.value) return
  const el = document.getElementById(activeFieldId.value)
  if (!el) return
  const cr      = containerRef.value.getBoundingClientRect()
  const fr      = el.getBoundingClientRect()
  const relTop  = fr.top  - cr.top
  const relLeft = fr.left - cr.left
  const TOOLBAR_H = 40
  const top  = relTop > TOOLBAR_H + 4 ? relTop - TOOLBAR_H - 4 : fr.bottom - cr.top + 4
  toolbarPos.value = { top, left: Math.max(0, relLeft) }
}

function getPxVal(cssStr: string | undefined, fallback: number): number {
  if (!cssStr) return fallback
  const n = parseFloat(cssStr)
  return isNaN(n) ? fallback : n
}

const activeStyleVals = computed(() => {
  const id    = activeFieldId.value ?? ''
  const saved = savedStyles.value[id] ?? {}
  const field = resolvedFields.value.find(f => f.id === id)
  return {
    fontSize:      getPxVal(saved.fontSize,      getPxVal(field?.size, 11)),
    color:         saved.color         ?? '#000000',
    background:    saved.background    ?? '#fafa50',
    letterSpacing: getPxVal(saved.letterSpacing, 0),
  }
})

function setFieldStyle(key: keyof IFieldStyle, raw: string): void {
  const id = activeFieldId.value
  if (!id) return
  const next = { ...(savedStyles.value[id] ?? {}), [key]: raw }
  savedStyles.value = { ...savedStyles.value, [id]: next }
  $formStore.saveStyle(id, next)
}

function onSizeChange(e: Event): void {
  setFieldStyle('fontSize', (e.target as HTMLInputElement).value + 'px')
}

function onSpacingChange(e: Event): void {
  setFieldStyle('letterSpacing', (e.target as HTMLInputElement).value + 'px')
}

function resetFieldStyle(): void {
  const id = activeFieldId.value
  if (!id) return
  const next = { ...savedStyles.value }
  delete next[id]
  savedStyles.value = next
  $formStore.deleteStyle(id)
}
//#endregion

// Expose for parent (print)
defineExpose({ calibrateMode, resetPositions })
</script>

<template>
  <!--#region Loading -->
  <div v-if="!isLoaded" class="loading-msg">
    <span v-if="loadError" style="color:#f38ba8">⚠ PDF読み込みエラー: {{ loadError }}</span>
    <span v-else>PDFを読み込み中...</span>
  </div>
  <!--#endregion-->

  <!--#region Calibration Banner -->
  <Transition name="banner">
    <div v-if="calibrateMode" class="calibrate-banner">
      🎯 位置調整モード —
      <code>{{ mouseCoords }}</code>
      <span v-if="selectedField !== '—'"> | <code>{{ selectedField }}</code></span>
      &nbsp;·&nbsp;<kbd>ESC</kbd> で終了
      <button class="btn-reset-pos" @click="resetPositions">↺ 位置リセット</button>
    </div>
  </Transition>
  <!--#endregion-->

  <!--#region PDF Form -->
  <div class="form-scroll">
    <div
      ref="containerRef"
      class="form-container"
      :class="{ calibrate: calibrateMode, preview: props.previewMode }"
      :style="{ height: containerH > 0 ? containerH + 'px' : 'auto' }"
      @mousemove="onContainerMouseMove"
      @click.self="activeFieldId = null"
    >
      <img
        :src="pdfImgSrc"
        class="pdf-img"
        alt="異動届出書"
        draggable="false"
        @load="onImgLoad"
      >

      <!--#region Inputs -->
      <template v-for="field in resolvedFields" :key="field.id">

        <!-- Textarea -->
        <textarea
          v-if="field.type === 'textarea'"
          :id="field.id"
          class="pdf-input"
          :class="{ 'field-active': activeFieldId === field.id }"
          :style="getStyle(field)"
          :title="field.label"
          :value="(formData[field.id] as string) ?? ''"
          @input="onTextInput($event, field)"
          @mousedown="onFieldMouseDown($event, field)"
          @focus="selectField(field.id)"
        />

        <!-- Checkbox -->
        <input
          v-else-if="field.type === 'checkbox'"
          :id="field.id"
          class="pdf-input pdf-checkbox"
          type="checkbox"
          :style="getStyle(field)"
          :title="field.label"
          :checked="(formData[field.id] as boolean) ?? false"
          @change="onCheckboxChange($event, field.id)"
          @mousedown="onFieldMouseDown($event, field)"
        />

        <!-- Text -->
        <input
          v-else
          :id="field.id"
          class="pdf-input"
          :class="{ 'field-active': activeFieldId === field.id }"
          type="text"
          :style="getStyle(field)"
          :title="field.label"
          :maxlength="field.max ?? undefined"
          :placeholder="field.placeholder ?? ''"
          :value="(formData[field.id] as string) ?? ''"
          @input="onTextInputAutoAdvance($event, field)"
          @keydown="onKeyDown($event, field)"
          @mousedown="onFieldMouseDown($event, field)"
          @focus="selectField(field.id)"
        />

      </template>
      <!--#endregion-->

      <!--#region Resize Handles (calibration mode only) -->
      <template v-if="calibrateMode">
        <div
          v-for="field in resizableFields"
          :key="'r-' + field.id"
          class="resize-handle"
          :style="getResizeHandleStyle(field)"
          @mousedown.stop="onResizeMouseDown($event, field)"
        />
      </template>
      <!--#endregion-->

      <!--#region Style Toolbar -->
      <Transition name="toolbar">
        <div
          v-if="activeFieldId && !props.previewMode && !calibrateMode"
          class="style-toolbar"
          :style="{ top: toolbarPos.top + 'px', left: toolbarPos.left + 'px' }"
          @mousedown.stop
          @click.stop
        >
          <span class="toolbar-field-id">{{ activeFieldId }}</span>

          <label class="toolbar-item">
            <span>Aa</span>
            <input
              type="number" min="6" max="72" step="1"
              :value="activeStyleVals.fontSize"
              @change="onSizeChange"
            />
            <span>px</span>
          </label>

          <label class="toolbar-item">
            <span>文字色</span>
            <input
              type="color"
              :value="activeStyleVals.color"
              @input="setFieldStyle('color', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <label class="toolbar-item">
            <span>背景</span>
            <input
              type="color"
              :value="activeStyleVals.background"
              @input="setFieldStyle('background', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <label class="toolbar-item">
            <span>字間</span>
            <input
              type="number" min="-5" max="20" step="0.5"
              :value="activeStyleVals.letterSpacing"
              @change="onSpacingChange"
            />
            <span>px</span>
          </label>

          <button class="toolbar-reset" title="スタイルをリセット" @click="resetFieldStyle">↺</button>
        </div>
      </Transition>
      <!--#endregion-->
    </div>
  </div>
  <!--#endregion-->
</template>

<style scoped>
/*#region Loading */
.loading-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #6c7086;
  font-size: 14px;
}
/*#endregion*/

/*#region Calibration Banner */
.calibrate-banner {
  position: sticky;
  top: 0;
  z-index: 200;
  background: #2d1b00;
  border-bottom: 1px solid #fab387;
  color: #fab387;
  font-size: 12px;
  padding: 5px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.calibrate-banner code {
  color: #89dceb;
  font-size: 11px;
  font-family: monospace;
}

.calibrate-banner kbd {
  background: #45475a;
  color: #cdd6f4;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
}

.btn-reset-pos {
  margin-left: auto;
  padding: 2px 10px;
  border: 1px solid #fab387;
  border-radius: 4px;
  background: transparent;
  color: #fab387;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.12s;
}
.btn-reset-pos:hover { background: rgba(250,179,135,0.15); }

.banner-enter-active, .banner-leave-active { transition: opacity 0.15s, transform 0.15s; }
.banner-enter-from, .banner-leave-to { opacity: 0; transform: translateY(-4px); }
/*#endregion*/

/*#region Form Scroll */
.form-scroll {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 20px 40px;
}
/*#endregion*/

/*#region Form Container */
.form-container {
  position: relative;
  display: inline-block;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
  line-height: 0;
  flex-shrink: 0;
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

/* Preview: transparent fields, no borders — simulates print output */
.preview .pdf-input {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  pointer-events: none;
}

/* Calibration: red + grab cursor */
.calibrate .pdf-input {
  background: rgba(255, 80, 80, 0.18) !important;
  border: 1.5px solid rgba(255, 60, 60, 0.7) !important;
  cursor: grab !important;
}
.calibrate .pdf-input:active { cursor: grabbing !important; }

/* Resize handle */
.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fab387;
  border: 1px solid #1e1e2e;
  border-radius: 2px;
  cursor: se-resize;
  z-index: 80;
}
.resize-handle:hover { background: #fe640b; }

/* Selected field highlight */
.pdf-input.field-active {
  outline: 2px solid #89b4fa !important;
  z-index: 60;
}
/*#endregion*/

/*#region Style Toolbar */
.style-toolbar {
  position: absolute;
  z-index: 150;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #181825;
  border: 1px solid #45475a;
  border-radius: 6px;
  padding: 4px 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  font-size: 11px;
  color: #cdd6f4;
  pointer-events: all;
}

.toolbar-field-id {
  font-size: 10px;
  color: #6c7086;
  font-family: monospace;
  border-right: 1px solid #313244;
  padding-right: 6px;
  margin-right: 2px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-item {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #a6adc8;
  font-size: 11px;
  cursor: default;
  padding: 0 4px;
  border-right: 1px solid #313244;
}

.toolbar-item span { user-select: none; }

.toolbar-item input[type='number'] {
  width: 40px;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 3px;
  color: #cdd6f4;
  font-size: 11px;
  padding: 1px 3px;
  text-align: center;
  outline: none;
}
.toolbar-item input[type='number']:focus { border-color: #89b4fa; }

.toolbar-item input[type='color'] {
  width: 22px;
  height: 22px;
  border: 1px solid #45475a;
  border-radius: 3px;
  padding: 1px;
  background: #313244;
  cursor: pointer;
}

.toolbar-reset {
  background: transparent;
  border: none;
  color: #6c7086;
  font-size: 14px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  transition: color 0.1s;
}
.toolbar-reset:hover { color: #f38ba8; }

.toolbar-enter-active, .toolbar-leave-active { transition: opacity 0.1s, transform 0.1s; }
.toolbar-enter-from, .toolbar-leave-to { opacity: 0; transform: translateY(-4px); }
/*#endregion*/

/*#region Print */
@media print {
  .calibrate-banner { display: none !important; }
  .form-scroll { padding: 0; display: block; }

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
}
/*#endregion*/
</style>
