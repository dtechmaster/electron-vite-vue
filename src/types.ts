// #region Imports
import { z } from 'zod'
// #endregion

// #region Field Schema
export const TFieldType = z.enum(['text', 'textarea', 'checkbox'])
export type IFieldType = z.infer<typeof TFieldType>

export const TField = z.object({
  id:          z.string(),
  label:       z.string(),
  type:        TFieldType,
  left:        z.string(),
  top:         z.string(),
  width:       z.string().optional(),
  height:      z.string().optional(),
  /** CSS font-size value, e.g. '10px' */
  size:        z.string().optional(),
  max:         z.number().int().positive().optional(),
  placeholder: z.string().optional(),
  /** Extra inline CSS properties, e.g. { textAlign: 'center' } */
  xstyle:      z.record(z.string()).optional(),
  /** Group identifier for special behaviors, e.g. 'hojin_bangou' for auto-advance */
  group:       z.string().optional(),
})
export type IField = z.infer<typeof TField>
// #endregion

// #region Field Position Schema
export const TFieldPos = z.object({
  left:   z.string(),
  top:    z.string(),
  width:  z.string().optional(),
  height: z.string().optional(),
})
export type IFieldPos = z.infer<typeof TFieldPos>
// #endregion

// #region Form Data Schema
export const TFormData = z.record(z.union([z.string(), z.boolean()]))
export type IFormData = z.infer<typeof TFormData>
// #endregion
