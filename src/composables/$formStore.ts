// Field positions and styles persist in localStorage (app-wide, not per-file)
// Form data is now persisted per-file via IPC (electron/main/index.ts)

// #region Imports
import type { IFieldPos, IFieldStyle } from '../types'
// #endregion

const POS_KEY   = 'idobk_positions'
const STYLE_KEY = 'idobk_styles'

// #region $formStore composable
const $formStore = {

  // #region Positions
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
  // #endregion

  // #region Styles
  loadStyles(): Record<string, IFieldStyle> {
    try { return JSON.parse(localStorage.getItem(STYLE_KEY) || '{}') }
    catch { return {} }
  },

  saveStyle(id: string, style: IFieldStyle): void {
    const styles = this.loadStyles()
    styles[id] = style
    localStorage.setItem(STYLE_KEY, JSON.stringify(styles))
  },

  deleteStyle(id: string): void {
    const styles = this.loadStyles()
    delete styles[id]
    localStorage.setItem(STYLE_KEY, JSON.stringify(styles))
  },

  clearStyles(): void {
    localStorage.removeItem(STYLE_KEY)
  },
  // #endregion

} as const

export default $formStore
// #endregion
