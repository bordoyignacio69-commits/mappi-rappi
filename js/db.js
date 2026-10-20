/* ================= Base de datos simulada =================
   Carga data/seed.json (inyectado por tools/build.mjs como window.SEED), guarda los cambios
   de la sesión en localStorage y expone consultas simples. En producción, esta capa se
   reemplaza por la API real (ver docs/ARQUITECTURA.md); el resto del prototipo no cambia. */
const STORE_KEY = 'mappi-radar-v2';
const DAY = 86400000;

const DB = {
  data: null,
  ix: {},
  bootMs: Date.now(),
  load(seed, opts = {}) {
    let saved = null;
    if (!opts.fresh) {
      try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
    }
    if (saved && saved.meta && saved.meta.seed === seed.meta.seed && saved.meta.version === seed.meta.version) {
      this.data = saved;
    } else {
      this.data = JSON.parse(JSON.stringify(seed));
      this.data.events = [];
      this.data.coupons = [];
      this.data.session = { firstBoot: Date.now(), radarFeed: [], highlights: [], seq: 1 };
    }
    this.reindex();
    return this;
  },
  reindex() {
    this.rev++;
    const d = this.data;
    this.ix.rest = Object.fromEntries(d.restaurants.map(r => [r.id, r]));
    this.ix.dish = Object.fromEntries(d.dishes.map(x => [x.id, x]));
    this.ix.user = Object.fromEntries(d.users.map(u => [u.id, u]));
    this.ix.zone = Object.fromEntries(d.zones.map(z => [z.id, z]));
    this.ix.dishesOf = {};
    d.dishes.forEach(x => (this.ix.dishesOf[x.restaurant_id] ||= []).push(x));
  },
  rev: 0,
  persist() {
    this.rev++;
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch (e) { /* sin almacenamiento: la sesión vive en memoria */ }
    }, 250);
  },
  wipe() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} },
  // "Ahora" de la base simulada: el ancla del seed más el tiempo real transcurrido en la sesión
  nowMs() { return Date.parse(this.data.meta.anchor) + (Date.now() - (this.data.session.firstBoot || this.bootMs)); },
  nowISO() { return new Date(this.nowMs()).toISOString(); },
  id(prefix) { return prefix + (this.data.session.seq++); },
  insert(table, row) { (this.data[table] ||= []).push(row); this.persist(); return row; },
  remove(table, pred) { const t = this.data[table]; const i = t.findIndex(pred); if (i >= 0) t.splice(i, 1); this.persist(); return i >= 0; },
  rest(id) { return this.ix.rest[id]; },
  dish(id) { return this.ix.dish[id]; },
  user(id) { return this.ix.user[id]; },
  dishesOf(rid) { return this.ix.dishesOf[rid] || []; },
  me() { return this.ix.user.u_me; },
  tableNames() { return Object.keys(this.data).filter(k => Array.isArray(this.data[k])); },
};

