/**
 * License allowlist for sounds saved from the Internet Archive.
 * Only public domain, CC0, CC BY, and CC BY-SA are accepted.
 * Non-commercial, no-derivatives, and missing/unknown rights are rejected.
 */

function cleanUrl(value) {
  return String(value || '').trim().replace(/\?.*$/, '');
}

export function classifyLicense(licenseUrl, rights) {
  const url = cleanUrl(licenseUrl);
  if (/creativecommons\.org\/publicdomain\/zero/i.test(url)) {
    return { ok: true, id: 'cc0', name: 'CC0 1.0', url };
  }
  if (/creativecommons\.org\/publicdomain\/mark/i.test(url)) {
    return { ok: true, id: 'pdm', name: 'Public Domain Mark', url };
  }
  if (/creativecommons\.org\/licenses\/publicdomain\/?$/i.test(url)) {
    return { ok: true, id: 'pd', name: 'Public domain', url };
  }
  if (/creativecommons\.org\/licenses\/by-sa\//i.test(url)) {
    return { ok: true, id: 'by-sa', name: 'CC BY-SA', url };
  }
  if (/creativecommons\.org\/licenses\/by\//i.test(url)) {
    return { ok: true, id: 'by', name: 'CC BY', url };
  }
  const r = String(rights || '').trim().toLowerCase();
  if (r === 'no known copyright restrictions' || r === 'public domain') {
    return { ok: true, id: 'pd', name: 'Public domain', url };
  }
  return { ok: false, id: 'unclear', name: 'Unclear rights', url };
}

export function formatAttribution({ title, creator, license, identifier }) {
  const name = String(title || 'Untitled').trim();
  const who = creator ? `${name} by ${creator}` : name;
  const deed = license && license.name ? license.name : 'License unknown';
  const href = (license && license.url) || (identifier ? `https://archive.org/details/${identifier}` : '');
  return href ? `${who}. ${deed}. ${href}` : `${who}. ${deed}.`;
}
