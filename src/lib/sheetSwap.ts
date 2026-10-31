// Pure timing for the new-sheet swap, in meters and seconds. No three.js here. The swap reuses the
// paper path: the old page is fed up and out over the bail, the paper node is hidden for a moment
// while the canvas is redrawn, and a fresh sheet is fed in along the paper table and round the
// platen up to row 0. `usePaperBend` plays it; the numbers were picked with the side-view widget
// in the new-sheet discussion (2026-10-31).

/** The old page is pulled up for this long (ease-in: a yank that speeds up). */
export const PULL_S = 0.8
/** The sheet is hidden this long between the pull and the insert (the canvas is redrawn then). */
export const GAP_S = 0.12
/** The fresh sheet comes in for this long (ease-out: it slows into row 0). */
export const INSERT_S = 1.1
/** From the click to the new sheet at row 0. */
export const SWAP_TOTAL_S = PULL_S + GAP_S + INSERT_S

/**
 * The feed at the end of the pull. The sheet's bottom edge is then about 0.4 m above the paper
 * bail, clear of the overview camera's frame (the top edge is higher still).
 */
export const PULL_END_FEED_M = 0.42
/** How far along the paper table the new sheet's top edge starts (out of the overview frame). */
export const INSERT_START_OUT_M = 0.52

const easeInCubic = (x: number) => x * x * x
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Feed `t` seconds into the pull, from the feed the old page was resting at. */
export function pullFeedM(t: number, fromM: number, toM = PULL_END_FEED_M): number {
  return fromM + (toM - fromM) * easeInCubic(clamp01(t / PULL_S))
}

/** Feed `t` seconds into the insert (after the hidden gap). */
export function insertFeedM(t: number, fromM: number, toM: number): number {
  return fromM + (toM - fromM) * easeOutCubic(clamp01(t / INSERT_S))
}

/**
 * The feed at which a fresh sheet's top edge sits `outM` out along the paper table, past the end of
 * the wrap. The top edge is at arc length `topRestM + feed` from the tangent point, and the tail
 * starts `radius * wrapAngle` below it.
 */
export function insertStartFeedM(radiusM: number, wrapAngle: number, topRestM: number, outM = INSERT_START_OUT_M): number {
  return -radiusM * wrapAngle - outM - topRestM
}

/** True once the pull is over and the page should be swapped. */
export const pullDone = (t: number) => t >= PULL_S
/** True once the insert is over. */
export const insertDone = (t: number) => t >= GAP_S + INSERT_S
