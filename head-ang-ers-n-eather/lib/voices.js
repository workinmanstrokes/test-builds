/** Polyphony policy for pad playback. Pure: no audio nodes. */

export const MAX_VOICES = 12;
export const ATTACK_SEC = 0.0025;
export const RELEASE_SEC = 0.016;

/**
 * Ids of the oldest voices that must fade out so one new voice fits under the cap.
 * Voices are { id, startedAt }.
 */
export function selectVoicesToSteal(voices, maxVoices = MAX_VOICES) {
  if (!Array.isArray(voices) || voices.length < maxVoices) return [];
  const overflow = voices.length - maxVoices + 1;
  return [...voices]
    .sort((a, b) => a.startedAt - b.startedAt || a.id - b.id)
    .slice(0, overflow)
    .map((v) => v.id);
}
