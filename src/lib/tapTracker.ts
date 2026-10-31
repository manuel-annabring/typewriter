// Tells a tap from a drag for touch presses on the 3D keys. A finger that lands on a key only
// presses it when it lifts, and only if it did not move more than `maxMovePx` meanwhile; a longer
// move was an orbit (or half a pinch), so no letter is typed. Several fingers can be pending at
// once (two thumbs typing); each is tracked by its pointer id. Pure, so it is unit-tested.

interface Pending {
  name: string
  x: number
  y: number
  moved: boolean
}

export class TapTracker {
  private readonly pending = new Map<number, Pending>()
  private readonly maxMovePx: number

  constructor(maxMovePx: number) {
    this.maxMovePx = maxMovePx
  }

  /** A finger went down on the pressable `name`. */
  down(id: number, name: string, x: number, y: number): void {
    this.pending.set(id, { name, x, y, moved: false })
  }

  /** A finger moved; once it has strayed too far from where it landed it can no longer be a tap. */
  move(id: number, x: number, y: number): void {
    const p = this.pending.get(id)
    if (p && !p.moved && Math.hypot(x - p.x, y - p.y) > this.maxMovePx) p.moved = true
  }

  /** A finger lifted: the key name to press if it was a tap, else null. */
  up(id: number): string | null {
    const p = this.pending.get(id)
    this.pending.delete(id)
    return p && !p.moved ? p.name : null
  }

  /** The browser cancelled the touch (a scroll or system gesture took it). */
  cancel(id: number): void {
    this.pending.delete(id)
  }

  clear(): void {
    this.pending.clear()
  }

  get size(): number {
    return this.pending.size
  }
}
