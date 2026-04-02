// #region Imports
import { TFormData } from '../types'
import type { IFormData, IFieldPos } from '../types'
// #endregion

const DATA_KEY = 'idobk_data'
const POS_KEY  = 'idobk_positions'

// #region $formStore composable
const $formStore = {

  // ── Form data (localStorage) ──────────────────────────────────────────

  loadData(): IFormData {
    try {
      const raw = localStorage.getItem(DATA_KEY)
      if (!raw) return {}
      return TFormData.parse(JSON.parse(raw))
    } catch {
      return {}
    }
  },

  saveData(data: IFormData): void {
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  },

  clearData(): void {
    localStorage.removeItem(DATA_KEY)
  },

  // ── Field positions (localStorage) ───────────────────────────────────

  loadPositions(): Record<string, IFieldPos> {
    try {
      const raw = localStorage.getItem(POS_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  },

  savePosition(id: string, pos: IFieldPos): void {
    const positions = this.loadPositions()
    positions[id] = pos
    localStorage.setItem(POS_KEY, JSON.stringify(positions))
  },

  clearPositions(): void {
    localStorage.removeItem(POS_KEY)
  },

} as const

export default $formStore
// #endregion
