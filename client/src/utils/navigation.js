/**
 * Shared navigation utilities.
 */

/**
 * Computes the "current" jornada — the jornada of the earliest future match.
 * Falls back to maxJornada if no future matches are found.
 *
 * @param {Array}  allMatches  - all match objects (must have startTimestamp, jornada)
 * @param {number} maxJornada  - fallback when no future matches exist
 * @returns {number}
 */
export function computeCurrentJornada(allMatches, maxJornada = 42) {
  const nowTs = Math.floor(Date.now() / 1000);
  let minFutureTs = Infinity;
  let currentJornada = maxJornada;
  for (const m of allMatches) {
    if (m.startTimestamp && m.startTimestamp >= nowTs) {
      if (m.startTimestamp < minFutureTs) {
        minFutureTs = m.startTimestamp;
        currentJornada = m.jornada;
      }
    }
  }
  return currentJornada;
}
