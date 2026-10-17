// Screenshot tool: saves a PNG (web: download; Android: share sheet via Capacitor Filesystem + Share).
const cap = window.Capacitor, native = !!cap?.isNativePlatform?.();
export async function saveImage(canvas, name = 'period8') {
  const file = `${name}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
  const url = canvas.toDataURL('image/png');
  window.__p8_lastShot = { file, w: canvas.width, h: canvas.height, bytes: url.length };
  if (native && cap.Plugins?.Filesystem && cap.Plugins?.Share) {
    try {
      const r = await cap.Plugins.Filesystem.writeFile({ path: file, data: url.split(',')[1], directory: 'CACHE' });
      await cap.Plugins.Share.share({ title: 'Period 8', text: 'Spot the anomaly. #Period8', files: [r.uri], dialogTitle: 'Save or share screenshot' });
      return { ok: true, shared: true };
    } catch (e) { if (/cancel/i.test(String(e?.message || e))) return { ok: false, cancelled: true }; }
  }
  const a = document.createElement('a'); a.href = url; a.download = file; document.body.appendChild(a); a.click(); a.remove();
  return { ok: true, file };
}
