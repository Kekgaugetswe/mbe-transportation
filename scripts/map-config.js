// Public endpoints for light, interactive use. Replace for higher-volume use.
// Any browser API key added here is public: use domain restrictions, never secrets.
globalThis.MBEMapConfig = Object.freeze({
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  routing: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
  search: 'https://photon.komoot.io/api/',
  searchBias: { lat: -28.5, lon: 25, zoom: 5 },
  searchDebounceMs: 650,
  routingCredit: 'OSRM / FOSSGIS',
  timeoutMs: 10000,
  minRequestIntervalMs: 1100
});
