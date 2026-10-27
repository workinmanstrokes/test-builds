// Binary STL helpers: uniform scale in place, and file export through the Android share sheet.
export function scaleSTL(buf, k) {
  const out = buf.slice(0), dv = new DataView(out), n = dv.getUint32(80, true);
  if (84 + n * 50 !== out.byteLength) throw new Error('Not a binary STL');
  if (k === 1) return out;
  for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; for (let j = 0; j < 9; j++) dv.setFloat32(o + j * 4, dv.getFloat32(o + j * 4, true) * k, true); }
  return out;
}
function b64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
export async function shareFile(buf, name, mime = 'model/stl') {
  const P = window.Capacitor?.Plugins;
  if (window.Capacitor?.isNativePlatform?.() && P?.Filesystem && P?.Share) {
    const w = await P.Filesystem.writeFile({ path: name, data: b64(buf), directory: 'CACHE' });
    await P.Share.share({ title: name, url: w.uri, dialogTitle: 'Send STL to your printer app' });
    return 'shared';
  }
  const file = new File([buf], name, { type: mime });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'shared'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
