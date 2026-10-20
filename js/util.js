/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clp = n => '$' + Math.round(n).toLocaleString('es-CL');
const pct = n => (n > 0 ? '+' : '') + n + '%';
const icon = (name, cls = '') => ICONS[name] ? `<svg class="ic ${cls}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>` : '';
// Moneda MAPPI: marca geométrica simple del equipo (círculo + M)
const coin = (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink:0"><circle cx="12" cy="12" r="11" style="fill:var(--coin-edge,#B9840B)"/><circle cx="12" cy="11.2" r="10" style="fill:var(--coin,#F2B51F)"/><path d="M7.5 15V8l4.5 4.2L16.5 8v7" style="stroke:var(--coin-edge,#B9840B)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

// Fechas relativas al "ahora" de la base simulada
function ago(isoStr) {
  const m = Math.max(0, (DB.nowMs() - Date.parse(isoStr)) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${Math.round(m)} min`;
  const h = m / 60; if (h < 24) return `hace ${Math.round(h)} h`;
  const d = Math.round(h / 24); if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  const w = Math.round(d / 7); return w === 1 ? 'hace 1 semana' : `hace ${w} semanas`;
}
const clock = (ms = DB.nowMs()) => new Date(ms).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const clockS = (ms = DB.nowMs()) => new Date(ms).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const dayLabel = isoStr => new Date(isoStr.length === 10 ? isoStr + 'T12:00:00' : isoStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
function weekLabels() {
  const a = Date.parse(DB.data.meta.anchor), out = [];
  for (let i = 7; i >= 0; i--) out.push(new Date(a - i * 7 * DAY).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }).replace('.', ''));
  return out;
}

// Avatares con iniciales y un tono estable por persona
const HUES = ['#6D28D9', '#BE185D', '#C2410C', '#0E7490', '#15803D', '#A16207', '#4338CA', '#BE123C', '#0F766E', '#7E22CE']; // todos con contraste AA contra texto blanco
function avatar(u, size = '') {
  const h = HUES[[...u.id].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  return `<span class="avatar ${size}" style="background:${h}" aria-hidden="true">${esc(u.name[0])}${esc(u.initial || '')}</span>`;
}
const uname = u => u.me ? 'Tú' : `${u.name} ${u.initial}.`;
const grad = r => `linear-gradient(135deg,${r.grad[0]},${r.grad[1]})`;
const glyph = r => ICONS[r.icon + '-duotone'] ? r.icon + '-duotone' : r.icon;
// Foto del plato estrella si existe (PHOTOS la define tools/build.mjs); si falta, póster: degradado propio + glifo duotono
const thumb = r => PHOTOS.has(r.id) ? `<span class="thumb ph-${r.id}"></span>` : `<span class="thumb" style="background:${grad(r)}">${icon(glyph(r))}</span>`;
const poster = (r, cls = '') => PHOTOS.has(r.id) ? `<span class="poster ${cls} ph-${r.id}" aria-hidden="true"></span>` : `<span class="poster ${cls}" style="--g1:${r.grad[0]};--g2:${r.grad[1]}" aria-hidden="true">${icon(glyph(r), 'pg')}</span>`;
function download(name, text, type = 'application/json') {
  // Panel con el contenido y botón de copiar: funciona aunque el navegador bloquee descargas (por ejemplo, dentro de un artifact)
  if (typeof S !== 'undefined') S.exportBox = { name, text, type };
  saveFile(name, text, type);
}
let downloadsCap;
function saveFile(name, text, type = 'application/json') {
  // Publicado como artifact, el visor solo permite guardar a través de la capacidad "downloads"
  if (window.claude?.use) {
    (downloadsCap ||= window.claude.use('downloads')).then(d => {
      if (!d) return; // sin la capacidad queda el panel con "Copiar todo"
      d.save({ filename: name, data: text }).then(r => { if (r.status === 'saved') { gtoast(`Archivo ${name} listo.`); render(); } }, () => {});
    });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function toCSV(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = v => { const s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
}
// Mini gráfico de línea (SVG) para series de 8 semanas
function spark(a, color, h = 56) {
  const w = 200, p = 4, mn = Math.min(...a), mx = Math.max(...a), rng = (mx - mn) || 1;
  const pts = a.map((v, i) => [p + i * (w - 2 * p) / (a.length - 1), h - p - (v - mn) / rng * (h - 2 * p)]);
  const line = pts.map(q => q.map(n => n.toFixed(1)).join(',')).join(' ');
  const area = `M${pts[0][0]},${h} L${line.split(' ').join(' L')} L${pts[pts.length - 1][0]},${h} Z`;
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Serie de 8 semanas: ${a.join(', ')}"><path d="${area}" style="fill:${color}" opacity=".13"/>
    <polyline points="${line}" fill="none" style="stroke:${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3" style="fill:${color}"/></svg>`;
}

