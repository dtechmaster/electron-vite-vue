<script setup lang="ts">
//#region Props & Emits
interface Props {
  files:       IFileMeta[]
  currentPath: string | null
}

const props = defineProps<Props>()
const emit  = defineEmits<{
  select: [filePath: string]
  open:   []
  remove: [filePath: string]
}>()
//#endregion

//#region Helpers
function formatDate(iso?: string): string {
  if (!iso) return '未保存'
  const d    = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000)      return 'たった今'
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}分前`
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}時間前`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}日前`
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

function confirmRemove(e: MouseEvent, filePath: string) {
  e.stopPropagation()
  emit('remove', filePath)
}
//#endregion
</script>

<template>
  <!--#region Sidebar -->
  <aside class="file-list">
    <div class="sidebar-header">
      <span class="sidebar-title">ファイル</span>
      <button class="btn-open" title="PDFを開く" @click="emit('open')">＋ 開く</button>
    </div>

    <div v-if="files.length === 0" class="empty-hint">
      PDFを開いてください
    </div>

    <ul v-else class="file-items">
      <li
        v-for="file in files"
        :key="file.filePath"
        class="file-item"
        :class="{
          active:  file.filePath === currentPath,
          missing: !file.exists,
        }"
        :title="file.filePath"
        @click="file.exists ? emit('select', file.filePath) : undefined"
      >
        <span class="file-icon">{{ file.exists ? '📄' : '⚠️' }}</span>
        <div class="file-meta">
          <span class="file-name">{{ file.fileName }}</span>
          <span class="file-date">{{ formatDate(file.lastSaved) }}</span>
        </div>
        <button
          class="btn-remove"
          title="リストから削除"
          @click="confirmRemove($event, file.filePath)"
        >✕</button>
      </li>
    </ul>
  </aside>
  <!--#endregion-->
</template>

<style scoped>
/*#region Layout */
.file-list {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #181825;
  border-right: 1px solid #313244;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6c7086;
  text-transform: uppercase;
}

.btn-open {
  padding: 3px 8px;
  border: 1px solid #45475a;
  border-radius: 4px;
  background: transparent;
  color: #cdd6f4;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s;
}
.btn-open:hover { background: #313244; }
/*#endregion*/

/*#region File Items */
.file-items {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  padding: 4px 0;
}

.empty-hint {
  padding: 24px 16px;
  font-size: 12px;
  color: #45475a;
  text-align: center;
  line-height: 1.6;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  margin: 2px 6px;
  transition: background 0.1s;
  position: relative;
}
.file-item:hover { background: #313244; }
.file-item.active { background: #1e3a5f; }
.file-item.active:hover { background: #1e4a72; }
.file-item.missing { opacity: 0.45; cursor: default; }

.file-icon { font-size: 14px; flex-shrink: 0; }

.file-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: 12px;
  color: #cdd6f4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-date {
  font-size: 10px;
  color: #6c7086;
}

.file-item.active .file-name { color: #89b4fa; font-weight: 600; }
.file-item.active .file-date { color: #74c7ec; }

.btn-remove {
  flex-shrink: 0;
  opacity: 0;
  padding: 2px 5px;
  border: none;
  background: transparent;
  color: #f38ba8;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
  transition: opacity 0.12s, background 0.12s;
}
.file-item:hover .btn-remove { opacity: 1; }
.btn-remove:hover { background: rgba(243,139,168,0.15); }
/*#endregion*/

/*#region Print */
@media print { .file-list { display: none !important; } }
/*#endregion*/
</style>
