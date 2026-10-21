// Pure carriage and line-feed math, in meters. No three.js here. The model-dependent
// numbers (rest position, where the strike point sits on the sheet) are measured at
// mount by useCarriageAnimation and passed in.
import { cellOrigin, LINE_HEIGHT_MM, PITCH_MM, PX_PER_MM } from './paperGrid.ts'

const M_PER_MM = 0.001

/**
 * How far the carriage has slid left of its rest position with the cursor at `col`.
 * The half cell puts the middle of the cell, where its glyph is drawn, under the
 * strike point instead of the cell's left edge.
 */
export function carriageShiftM(col: number): number {
  return (col + 0.5) * PITCH_MM * M_PER_MM
}

/** Distance from the top edge of the sheet to the baseline of `row`. */
export function baselineFromTopM(row: number): number {
  return (cellOrigin(row, 0).y / PX_PER_MM) * M_PER_MM
}

/**
 * Where the sheet must sit along its own up axis so the baseline of `row` is at the
 * strike point. Offsets are measured from the sheet's centre, positive up the sheet:
 * `strikeAlongM` is the strike point's rest offset, `paperHeightM` the sheet height.
 * Each row adds one line height.
 */
export function paperFeedM(row: number, strikeAlongM: number, paperHeightM: number): number {
  return strikeAlongM - paperHeightM / 2 + baselineFromTopM(row)
}

export const LINE_HEIGHT_M = LINE_HEIGHT_MM * M_PER_MM
