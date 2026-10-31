// Pure helpers for saving the page as an image.

/** True when at least one character on the page leaves ink (spaces don't). */
export function hasInk(lines: readonly string[]): boolean {
  return lines.some((line) => line.trim() !== '')
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `typewriter-2026-10-31-1542.png`, local time, no personal data. */
export function saveFileName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `typewriter-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.png`
}
