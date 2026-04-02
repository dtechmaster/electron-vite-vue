// Field positions persist in localStorage (app-wide, not per-file)
// Form data is now persisted per-file via IPC (electron/main/index.ts)

// #region Imports
import type { IFieldPos } from '../types'
// #endregion

const POS_KEY = 'idobk_positions'

// #region $formStore composable
const $formStore = {

  loadPositions(): Record<string, IFieldPos> {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}') }
    catch { return {} }
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
