/* =====================================================================
   Mapa real de MAPPI
   ---------------------------------------------------------------------
   Un solo "adaptador" con tres motores posibles, en este orden:
     1. Google Maps  (si hay clave en js/config.js)
     2. Leaflet + OpenStreetMap (gratis, sin clave; el que se usa por defecto)
     3. Mapa ilustrado en SVG (si no hay internet para cargar los anteriores)
   Las pantallas solo dejan un hueco <div data-map="clave"> y llaman a
   MapView.show(clave, opciones). El mapa vive fuera del re-dibujado de la
   pantalla, así no se reinicia cada vez que tocas algo.
   ===================================================================== */

/* ---------- Coordenadas de los restaurantes ficticios ----------
   Cada restaurante se ubica a su distancia (dist_km de la base) desde la
   persona, en dirección al centro de su comuna. */
const GEO = {
  _c: {},
  me() { return [CONFIG.ME.lat, CONFIG.ME.lng]; },
  of(rid) {
    if (this._c[rid]) return this._c[rid];
    const r = DB.rest(rid), [la0, lo0] = this.me();
    const c = CONFIG.ZONE_CENTERS[r.zone] || [la0 - 0.01, lo0 + 0.01];
    const kx = 111.32 * Math.cos(la0 * Math.PI / 180), ky = 110.57;
    let dx = (c[1] - lo0) * kx, dy = (c[0] - la0) * ky;
    if (Math.hypot(dx, dy) < 0.05) { dx = (r.x - 50); dy = (50 - r.y); }
    // pequeño giro estable por restaurante para que no queden en línea recta
    const h = [...rid].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const ang = Math.atan2(dy, dx) + ((h % 41) - 20) * Math.PI / 180;
    const d = r.dist_km;
    return (this._c[rid] = [la0 + Math.sin(ang) * d / ky, lo0 + Math.cos(ang) * d / kx]);
  },
  // Enlace "Cómo llegar" a Google Maps (no necesita clave)
  directions(rid) {
    const [a, b] = this.of(rid), [la, lo] = this.me();
    return `https://www.google.com/maps/dir/?api=1&origin=${la},${lo}&destination=${a.toFixed(5)},${b.toFixed(5)}&travelmode=walking`;
  },
};

const MapView = {
  engine: 'svg',          // 'google' | 'leaflet' | 'svg'
  views: {},              // clave -> { el, map, markers, me, fitKey }
  onEngineChange: null,

  init() {
    if (CONFIG.GOOGLE_MAPS_KEY) {
      this.engine = 'loading';
      window.gm_authFailure = () => this._fallback('La clave de Google Maps no funcionó. Usando OpenStreetMap.');
      window.__mappiGoogleReady = () => { this.engine = 'google'; this._reset(); };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CONFIG.GOOGLE_MAPS_KEY)}&callback=__mappiGoogleReady&v=weekly&language=es&region=CL`;
      s.async = true;
      s.onerror = () => this._fallback('No se pudo cargar Google Maps. Usando OpenStreetMap.');
      document.head.appendChild(s);
      setTimeout(() => { if (this.engine === 'loading') this._fallback('Google Maps tardó demasiado. Usando OpenStreetMap.'); }, 8000);
    } else {
      this.engine = window.L ? 'leaflet' : 'svg';
    }
  },
  _fallback(msg) { console.warn(msg); this.engine = window.L ? 'leaflet' : 'svg'; this._reset(); },
  _reset() {
    Object.values(this.views).forEach(v => { try { v.map?.remove?.(); } catch (e) {} v.el.remove(); });
    this.views = {};
    this.onEngineChange?.();
  },
  label() { return { google: 'Google Maps', leaflet: '© OpenStreetMap · CARTO', svg: 'Mapa ilustrado (sin conexión)', loading: 'Cargando mapa…' }[this.engine]; },

  /* Muestra el mapa "key" dentro de su hueco. opts:
     items: [{ id, html, sel }]   marcadores
     onPick(id)                   al tocar un marcador
     fitKey                       cuando cambia, el mapa se re-encuadra (filtros, búsqueda)
     fit: { ids, maxZoom }        qué encuadrar
     focus: id                    centra suavemente en este marcador
     interactive: false           mapa decorativo (vista previa en Inicio) */
  show(key, opts) {
    const slot = document.querySelector(`[data-map="${key}"]`);
    if (!slot || this.engine === 'svg' || this.engine === 'loading') return false;
    let v = this.views[key];
    if (!v) v = this.views[key] = this._create(key, opts);
    if (v.el.parentElement !== slot) slot.appendChild(v.el);
    this[this.engine].resize(v);
    this._markers(v, opts);
    if (v.fitKey !== opts.fitKey) {
      const first = v.fitKey === undefined;
      v.fitKey = opts.fitKey;
      const pts = (opts.fit?.ids || []).map(id => GEO.of(id));
      if (opts.fit?.withMe !== false) pts.push(GEO.me());
      this[this.engine].fit(v, pts, opts.fit?.maxZoom ?? 16, !first && opts.interactive !== false);
    } else if (opts.focus && opts.focus !== v.focus) {
      this[this.engine].pan(v, GEO.of(opts.focus));
    }
    v.focus = opts.focus;
    return true;
  },
  recenter(key) { const v = this.views[key]; if (v) this[this.engine].fit(v, [GEO.me()], 16, true); },

  _create(key, opts) {
    const el = document.createElement('div');
    el.className = 'map-canvas';
    const v = { el, markers: {}, key };
    this[this.engine].create(v, opts);
    // marcador "Tú estás aquí"
    this[this.engine].addMe(v, GEO.me());
    return v;
  },
  _markers(v, opts) {
    const want = new Set(opts.items.map(i => i.id));
    Object.keys(v.markers).forEach(id => { if (!want.has(id)) { this[this.engine].removeMarker(v, v.markers[id]); delete v.markers[id]; } });
    opts.items.forEach(it => {
      const sig = it.html;
      const m = v.markers[it.id];
      if (!m) v.markers[it.id] = this[this.engine].addMarker(v, GEO.of(it.id), it.html, it.sel, () => opts.onPick?.(it.id));
      else if (m.sig !== sig) this[this.engine].updateMarker(v, m, it.html, it.sel);
      v.markers[it.id].sig = sig;
    });
  },

  /* ---------- Motor Leaflet (OpenStreetMap) ---------- */
  leaflet: {
    create(v, opts) {
      const inter = opts.interactive !== false;
      v.map = L.map(v.el, { zoomControl: false, attributionControl: true, dragging: inter, scrollWheelZoom: inter, touchZoom: inter, doubleClickZoom: inter, boxZoom: false, keyboard: inter, tap: inter })
        .setView(GEO.me(), 15);
      v.map.attributionControl.setPrefix(false);
      // Teselas CARTO "Voyager": base de OpenStreetMap con estilo limpio, parecido al de las apps de delivery
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO',
      }).addTo(v.map);
    },
    addMe(v, ll) {
      L.marker(ll, { interactive: false, keyboard: false, zIndexOffset: -100, icon: L.divIcon({ className: 'me-wrap', html: '<span class="me"></span>', iconSize: null }) }).addTo(v.map);
    },
    addMarker(v, ll, html, sel, onClick) {
      const m = L.marker(ll, { icon: L.divIcon({ className: 'pin-wrap', html, iconSize: null }), zIndexOffset: sel ? 1000 : 0, riseOnHover: true, keyboard: true });
      m.on('click', onClick);
      m.addTo(v.map);
      return { m };
    },
    updateMarker(v, mk, html, sel) { mk.m.setIcon(L.divIcon({ className: 'pin-wrap', html, iconSize: null })); mk.m.setZIndexOffset(sel ? 1000 : 0); },
    removeMarker(v, mk) { mk.m.remove(); },
    resize(v) { requestAnimationFrame(() => v.map.invalidateSize({ pan: false })); },
    fit(v, pts, maxZoom, animate) {
      const go = () => {
        v.map.invalidateSize({ pan: false });
        if (pts.length === 1) return v.map.flyTo(pts[0], maxZoom, { animate, duration: .8 });
        const b = L.latLngBounds(pts);
        animate ? v.map.flyToBounds(b, { padding: [46, 46], maxZoom, duration: .9 }) : v.map.fitBounds(b, { padding: [46, 46], maxZoom });
      };
      requestAnimationFrame(go);
    },
    pan(v, ll) { v.map.panTo(ll, { animate: true, duration: .5 }); },
  },

  /* ---------- Motor Google Maps (requiere clave en config.js) ---------- */
  google: {
    _Html: null,
    html() {
      if (this._Html) return this._Html;
      // Marcador con HTML propio para que los pines se vean igual que en Leaflet
      this._Html = class extends google.maps.OverlayView {
        constructor(pos, html, onClick) {
          super(); this.pos = pos; this.div = document.createElement('div');
          this.div.className = 'pin-wrap gm'; this.div.innerHTML = html;
          if (onClick) this.div.addEventListener('click', e => { e.stopPropagation(); onClick(); });
        }
        onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.div); }
        draw() { const p = this.getProjection()?.fromLatLngToDivPixel(this.pos); if (p) { this.div.style.left = p.x + 'px'; this.div.style.top = p.y + 'px'; } }
        onRemove() { this.div.remove(); }
      };
      return this._Html;
    },
    create(v, opts) {
      const inter = opts.interactive !== false;
      v.map = new google.maps.Map(v.el, {
        center: { lat: CONFIG.ME.lat, lng: CONFIG.ME.lng }, zoom: 15, disableDefaultUI: true, clickableIcons: false,
        gestureHandling: inter ? 'greedy' : 'none', keyboardShortcuts: inter,
        styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'simplified' }] }],
      });
    },
    addMe(v, ll) { const H = this.html(); const o = new H(new google.maps.LatLng(ll[0], ll[1]), '<span class="me"></span>'); o.setMap(v.map); },
    addMarker(v, ll, html, sel, onClick) { const H = this.html(); const o = new H(new google.maps.LatLng(ll[0], ll[1]), html, onClick); o.div.style.zIndex = sel ? 10 : 1; o.setMap(v.map); return { m: o }; },
    updateMarker(v, mk, html, sel) { mk.m.div.innerHTML = html; mk.m.div.style.zIndex = sel ? 10 : 1; },
    removeMarker(v, mk) { mk.m.setMap(null); },
    resize(v) { google.maps.event.trigger(v.map, 'resize'); },
    fit(v, pts, maxZoom) {
      if (pts.length === 1) { v.map.panTo({ lat: pts[0][0], lng: pts[0][1] }); v.map.setZoom(maxZoom); return; }
      const b = new google.maps.LatLngBounds(); pts.forEach(p => b.extend({ lat: p[0], lng: p[1] }));
      v.map.fitBounds(b, 46);
      google.maps.event.addListenerOnce(v.map, 'idle', () => { if (v.map.getZoom() > maxZoom) v.map.setZoom(maxZoom); });
    },
    pan(v, ll) { v.map.panTo({ lat: ll[0], lng: ll[1] }); },
  },
};
