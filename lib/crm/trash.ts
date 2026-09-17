/** Coșul de gunoi: fișele șterse stau 30 de zile, apoi dispar definitiv. Doar calcule, fără DB. */
export const TRASH_DAYS = 30;

const DAY_MS = 86_400_000;

/** Ce e mai vechi de atât se șterge definitiv. */
export function trashCutoff(now = new Date()): Date {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS);
}

/** Câte zile mai are de stat în coș (0 = expirat). */
export function daysLeftInTrash(deletedAt: Date, now = new Date()): number {
  const left = TRASH_DAYS - Math.floor((now.getTime() - deletedAt.getTime()) / DAY_MS);
  return Math.max(0, left);
}

export function isExpired(deletedAt: Date, now = new Date()): boolean {
  return deletedAt <= trashCutoff(now);
}
