// #region Imports
import type { IField } from '../types'
// #endregion

// #region Field Definitions
// left/top  = % from top-left of the PDF page
// width/height = % of page dimensions
// Adjust these values or use calibration mode in the app to fine-tune
const FIELD_LIST: IField[] = [

  // ── 整理番号 (top right) ──────────────────────────────────────────────
  { id: 'seiri_bangou',  label: '整理番号',           type: 'text', left: '81.5%', top: '1.8%',  width: '16.5%', height: '2.2%', size: '10px' },
  { id: 'tsusan_bangou', label: '通算グループ整理番号', type: 'text', left: '81.5%', top: '4.3%',  width: '16.5%', height: '2.2%', size: '10px' },

  // ── 税目 ─────────────────────────────────────────────────────────────
  { id: 'tax_hojin', label: '法人税', type: 'checkbox', left: '30.5%', top: '7.8%' },
  { id: 'tax_shohi', label: '消費税', type: 'checkbox', left: '40.5%', top: '7.8%' },

  // ── 提出日 (令和 年 月 日) ──────────────────────────────────────────
  { id: 'date_nen',   label: '年', type: 'text', left: '9%',    top: '19.5%', width: '4.5%', height: '2.2%', size: '11px', max: 2 },
  { id: 'date_tsuki', label: '月', type: 'text', left: '16.5%', top: '19.5%', width: '3.5%', height: '2.2%', size: '11px', max: 2 },
  { id: 'date_hi',    label: '日', type: 'text', left: '22.5%', top: '19.5%', width: '3.5%', height: '2.2%', size: '11px', max: 2 },

  // ── 提出区分 ─────────────────────────────────────────────────────────
  { id: 'kubun_ko_naru',  label: '通算子法人となる法人', type: 'checkbox', left: '30.5%', top: '14%' },
  { id: 'kubun_ko',       label: '通算子法人',           type: 'checkbox', left: '33.5%', top: '23%' },
  { id: 'kubun_oya_naru', label: '通算親法人となる法人', type: 'checkbox', left: '37.5%', top: '32%' },
  { id: 'kubun_oya',      label: '通算親法人',           type: 'checkbox', left: '41.5%', top: '41%' },

  // ── 本店又は主たる事務所の所在地 ────────────────────────────────────
  { id: 'honten_furigana', label: '本店フリガナ', type: 'text', left: '56%',   top: '10.5%', width: '42.5%', height: '2.2%', size: '10px' },
  { id: 'honten_yuubin',   label: '本店〒',       type: 'text', left: '55.5%', top: '13.2%', width: '13.5%', height: '2.2%', size: '10px', placeholder: '000-0000' },
  { id: 'honten_jusho',    label: '本店住所',     type: 'text', left: '56%',   top: '16.2%', width: '42.5%', height: '2.2%', size: '10px' },
  { id: 'honten_tel',      label: '電話番号',     type: 'text', left: '62%',   top: '19.2%', width: '33%',   height: '2.2%', size: '10px', placeholder: '(   )   -' },

  // ── 納税地 ───────────────────────────────────────────────────────────
  { id: 'nouzei_furigana', label: '納税地フリガナ', type: 'text', left: '56%',   top: '22.2%', width: '42.5%', height: '2.2%', size: '10px' },
  { id: 'nouzei_yuubin',   label: '納税地〒',       type: 'text', left: '55.5%', top: '25%',   width: '13.5%', height: '2.2%', size: '10px', placeholder: '000-0000' },
  { id: 'nouzei_jusho',    label: '納税地住所',     type: 'text', left: '56%',   top: '28%',   width: '42.5%', height: '2.2%', size: '10px' },

  // ── 法人等の名称 ─────────────────────────────────────────────────────
  { id: 'hojin_furigana', label: '法人名フリガナ', type: 'text', left: '56%', top: '30.8%', width: '42.5%', height: '2.2%', size: '10px' },
  { id: 'hojin_name',     label: '法人等の名称',   type: 'text', left: '56%', top: '33.8%', width: '42.5%', height: '2.2%', size: '11px' },

  // ── 法人番号 (13 cells — auto-advance on input) ──────────────────────
  ...Array.from({ length: 13 }, (_, i): IField => ({
    id:     `hojin_num_${i}`,
    label:  `法人番号 ${i + 1}桁目`,
    type:   'text',
    left:   `${54.2 + i * 3.3}%`,
    top:    '37.2%',
    width:  '3%',
    height: '2.2%',
    size:   '12px',
    max:    1,
    xstyle: { textAlign: 'center' },
    group:  'hojin_bangou',
  })),

  // ── 代表者氏名 ───────────────────────────────────────────────────────
  { id: 'daihyo_furigana', label: '代表者氏名フリガナ', type: 'text', left: '56%', top: '40.8%', width: '42.5%', height: '2.2%', size: '10px' },
  { id: 'daihyo_name',     label: '代表者氏名',         type: 'text', left: '56%', top: '43.8%', width: '42.5%', height: '2.2%', size: '11px' },

  // ── 代表者住所 ───────────────────────────────────────────────────────
  { id: 'daihyo_jusho_furigana', label: '代表者住所フリガナ', type: 'text', left: '56%',   top: '46.8%', width: '42.5%', height: '2.2%', size: '10px' },
  { id: 'daihyo_yuubin',         label: '代表者〒',           type: 'text', left: '55.5%', top: '49.5%', width: '13.5%', height: '2.2%', size: '10px', placeholder: '000-0000' },
  { id: 'daihyo_jusho',          label: '代表者住所',         type: 'text', left: '56%',   top: '52.5%', width: '42.5%', height: '2.2%', size: '11px' },

  // ── 異動事項等 table ─────────────────────────────────────────────────
  { id: 'ido_jiko', label: '異動事項等', type: 'textarea', left: '3%',    top: '56%', width: '20%',   height: '17.5%', size: '10px' },
  { id: 'ido_mae',  label: '異動前',     type: 'textarea', left: '23.5%', top: '56%', width: '35.2%', height: '17.5%', size: '10px' },
  { id: 'ido_go',   label: '異動後',     type: 'textarea', left: '59%',   top: '56%', width: '25.2%', height: '17.5%', size: '10px' },
  { id: 'ido_date', label: '異動年月日', type: 'textarea', left: '84.5%', top: '56%', width: '14%',   height: '17.5%', size: '9px' },

  // ── 所轄税務署 ───────────────────────────────────────────────────────
  { id: 'kankatsu_mae', label: '所轄税務署（前）', type: 'text', left: '23.5%', top: '74.8%', width: '31%',   height: '2.2%', size: '11px' },
  { id: 'kankatsu_go',  label: '所轄税務署（後）', type: 'text', left: '57%',   top: '74.8%', width: '26.5%', height: '2.2%', size: '11px' },

  // ── 納税地等を変更した場合 ───────────────────────────────────────────
  { id: 'henkou_ari',         label: '有',           type: 'checkbox', left: '37.5%', top: '79%' },
  { id: 'henkou_nashi_ari',   label: '無(名称変更有)', type: 'checkbox', left: '50.5%', top: '79%' },
  { id: 'henkou_nashi',       label: '無(名称変更無)', type: 'checkbox', left: '67%',   top: '79%' },

  // ── 事業年度を変更した場合 ───────────────────────────────────────────
  { id: 'nendo_nen_from',   label: '開始年', type: 'text', left: '47.5%', top: '83%', width: '4%',   height: '2.2%', size: '11px', max: 2 },
  { id: 'nendo_tsuki_from', label: '開始月', type: 'text', left: '54%',   top: '83%', width: '3.5%', height: '2.2%', size: '11px', max: 2 },
  { id: 'nendo_hi_from',    label: '開始日', type: 'text', left: '59.5%', top: '83%', width: '3.5%', height: '2.2%', size: '11px', max: 2 },
  { id: 'nendo_nen_to',     label: '終了年', type: 'text', left: '72%',   top: '83%', width: '4%',   height: '2.2%', size: '11px', max: 2 },
  { id: 'nendo_tsuki_to',   label: '終了月', type: 'text', left: '79%',   top: '83%', width: '3.5%', height: '2.2%', size: '11px', max: 2 },
  { id: 'nendo_hi_to',      label: '終了日', type: 'text', left: '84.5%', top: '83%', width: '3.5%', height: '2.2%', size: '11px', max: 2 },

  // ── 合併・分割 ───────────────────────────────────────────────────────
  { id: 'gappei_tekikaku',   label: '適格合併',    type: 'checkbox', left: '36.5%', top: '86.2%' },
  { id: 'gappei_hiteki',     label: '非適格合併',  type: 'checkbox', left: '46.5%', top: '86.2%' },
  { id: 'bunkatsu_tekikaku', label: '分割型適格',  type: 'checkbox', left: '71%',   top: '85.8%' },
  { id: 'bunkatsu_hoka',     label: '分割型その他', type: 'checkbox', left: '83.5%', top: '85.8%' },
  { id: 'bunsha_tekikaku',   label: '分社型適格',  type: 'checkbox', left: '71%',   top: '88.3%' },
  { id: 'bunsha_hoka',       label: '分社型その他', type: 'checkbox', left: '83.5%', top: '88.3%' },

  // ── その他参考 ───────────────────────────────────────────────────────
  { id: 'sonota',   label: 'その他参考となるべき事項', type: 'textarea', left: '13%', top: '90.2%', width: '84%', height: '3.8%', size: '10px' },

  // ── 税理士署名 ───────────────────────────────────────────────────────
  { id: 'zeirishi', label: '税理士署名', type: 'text', left: '33%', top: '94.5%', width: '63%', height: '2.2%', size: '11px' },
]
// #endregion

// #region $fields composable
const $fields = {
  get list(): readonly IField[] { return FIELD_LIST },

  find(id: string): IField | undefined {
    return FIELD_LIST.find(f => f.id === id)
  },

  /** Create a blank formData record with correct types per field */
  initial(): Record<string, string | boolean> {
    return Object.fromEntries(
      FIELD_LIST.map(f => [f.id, f.type === 'checkbox' ? false : ''])
    )
  },
} as const

export default $fields
// #endregion
