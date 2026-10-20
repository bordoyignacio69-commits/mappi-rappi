/* =====================================================================
   Ajustes del prototipo
   ---------------------------------------------------------------------
   GOOGLE MAPS
   Por defecto el mapa usa OpenStreetMap (gratis y sin clave).
   Para usar Google Maps:
     1. Entra a https://console.cloud.google.com/ y crea un proyecto.
     2. Activa "Maps JavaScript API" y crea una clave (Credenciales > Crear clave de API).
     3. Restringe la clave a tu sitio: https://TU-USUARIO.github.io/*
     4. Pega la clave abajo, entre las comillas, y sube el cambio a GitHub.
   Si la clave falla, el prototipo vuelve solo a OpenStreetMap.
   ===================================================================== */
const CONFIG = {
  GOOGLE_MAPS_KEY: '',

  // Ubicación simulada de la persona (la base de datos está pensada en torno a este punto)
  ME: { lat: -33.4289, lng: -70.6164, address: 'Av. Providencia 1234', city: 'Santiago de Chile' },

  // Centro aproximado de cada comuna, para ubicar los restaurantes ficticios en el mapa
  ZONE_CENTERS: {
    vitacura: [-33.3905, -70.5755], lobarnechea: [-33.3520, -70.5180], lascondes: [-33.4110, -70.5670],
    recoleta: [-33.4150, -70.6430], independencia: [-33.4170, -70.6650], bellavista: [-33.4335, -70.6345],
    providencia: [-33.4300, -70.6100], santiago: [-33.4440, -70.6530], estacion: [-33.4550, -70.6850],
    nunoa: [-33.4560, -70.5980], lareina: [-33.4450, -70.5450], maipu: [-33.5100, -70.7570],
    sanmiguel: [-33.4970, -70.6510], macul: [-33.4880, -70.6000], sanjoaquin: [-33.4950, -70.6270],
    penalolen: [-33.4850, -70.5450], laflorida: [-33.5230, -70.5850],
  },
};
