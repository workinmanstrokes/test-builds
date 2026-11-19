/** Internet Archive search helpers. No network calls. */

export const MIN_SECONDS = 0.4;
export const MAX_SECONDS = 12;
export const MAX_BYTES = 2_500_000;

export function safeTerm(term) {
  return String(term || '')
    .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export function archiveSearchUrl(term) {
  const cleaned = safeTerm(term);
  const q = `(${cleaned}) AND mediatype:audio AND format:MP3 AND licenseurl:*creativecommons*`;
  return (
    'https://archive.org/advancedsearch.php?q=' +
    encodeURIComponent(q) +
    '&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=rights&rows=16&page=1&output=json'
  );
}

export function parseDuration(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if (!/^\d{1,3}(:\d{1,2}){1,2}$/.test(s)) return null;
  const parts = s.split(':').map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function archiveDownloadUrl(identifier, filename) {
  const id = encodeURIComponent(identifier);
  const file = String(filename || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `https://archive.org/download/${id}/${file}`;
}

/** Shortest acceptable MP3, or null when every file is too long, too big, or not audio. */
export function pickClipFile(files) {
  let best = null;
  for (const f of files || []) {
    const name = String(f.name || '');
    if (!/\.mp3$/i.test(name)) continue;
    const seconds = parseDuration(f.length);
    if (seconds == null || seconds < MIN_SECONDS || seconds > MAX_SECONDS) continue;
    const size = Number(f.size || 0);
    if (size && size > MAX_BYTES) continue;
    if (!best || seconds < best.seconds) best = { name, seconds, size };
  }
  return best;
}
