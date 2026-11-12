(() => {
  const el = id => document.getElementById(id);
  const geo = MBEJourney, config = MBEMapConfig;
  const points = { origin: null, destination: null }, markers = {};
  const manual = { origin: null, destination: null };
  const cache = new Map();
  let map, line, route, timer, controller;
  let generation = 0, lastRequest = 0;
  function invalidate() {
    generation++;
    clearTimeout(timer);
    controller?.abort();
    controller = null;
    route = null;
    if (line) { line.remove(); line = null; }
    el('route-distance').textContent = manual.origin || manual.destination
      ? 'MBE will confirm the driving distance for your typed address.'
      : 'Choose both addresses to calculate driving distance.';
    el('route-note').textContent = '';
    el('directions').hidden = true;
    el('retry-route').disabled = true;
    document.dispatchEvent(new Event('journeychange'));
  }
  function drawMarkers() {
    if (!map) return;
    for (const id of Object.keys(points)) {
      markers[id]?.remove();
      delete markers[id];
      const p = points[id];
      if (!p) continue;
      const badge = id === 'origin' ? 'A' : 'B';
      const label = id === 'origin' ? 'Pickup' : 'Drop-off';
      markers[id] = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: `location-pin pin-${id}`, html: badge, iconSize: [30, 30], iconAnchor: [15, 30] }),
        title: `${label}: ${p.address}`, alt: `${label} marker ${badge}`
      }).addTo(map);
    }
    const selected = Object.values(points).filter(Boolean);
    if (selected.length === 2) map.fitBounds(selected.map(p => [p.lat, p.lng]), { padding: [35, 35], maxZoom: 16 });
    else if (selected.length) map.setView([selected[0].lat, selected[0].lng], 14);
  }
  function showRoute(result) {
    route = result;
    el('route-distance').textContent = geo.distanceText(result);
    el('route-note').textContent = result.kind === 'road'
      ? 'A is pickup; B is drop-off. The green line shows the calculated road route using nearby roads. This standard driving estimate excludes live traffic and bus-specific restrictions. MBE will confirm suitability.'
      : 'No road route is shown. You can retry, change an address, or send your enquiry with the distance marked unavailable.';
    if (map && result.line) {
      line = L.polyline(result.line, { color: '#22730f', weight: 4 }).addTo(map);
      map.fitBounds(line.getBounds().extend([points.origin.lat, points.origin.lng]).extend([points.destination.lat, points.destination.lng]), { padding: [35, 35], maxZoom: 16 });
    }
    el('directions').href = geo.directions(points.origin, points.destination);
    el('directions').hidden = false;
    el('retry-route').disabled = false;
    document.dispatchEvent(new Event('journeychange'));
  }
  async function requestRoute(version) {
    const a = points.origin, b = points.destination;
    const key = `${geo.coordinates(a)};${geo.coordinates(b)}`;
    if (cache.has(key)) { showRoute(cache.get(key)); return; }
    const currentController = new AbortController();
    controller = currentController;
    const timeout = setTimeout(() => currentController.abort(), config.timeoutMs);
    lastRequest = Date.now();
    try {
      const url = `${config.routing}${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&steps=false&alternatives=false&radiuses=150;150`;
      const response = await fetch(url, { signal: currentController.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Routing unavailable');
      const result = geo.roadResult(await response.json());
      if (version !== generation) return;
      if (cache.size >= 20) cache.delete(cache.keys().next().value);
      cache.set(key, result);
      showRoute(result);
    } catch {
      if (version === generation) showRoute(geo.unavailable());
    } finally {
      clearTimeout(timeout);
      if (controller === currentController) controller = null;
    }
  }
  function scheduleRoute() {
    if (!points.origin || !points.destination) return;
    el('route-distance').textContent = 'Calculating driving distance…';
    const version = generation;
    timer = setTimeout(() => requestRoute(version), Math.max(450, config.minRequestIntervalMs - (Date.now() - lastRequest)));
  }
  for (const id of Object.keys(points)) {
    el(id).addEventListener('addressmanual', event => {
      points[id] = null;
      manual[id] = event.detail;
      invalidate();
      drawMarkers();
    });
    el(id).addEventListener('input', () => {
      manual[id] = null;
      invalidate();
      points[id] = null;
      drawMarkers();
    });
    el(id).addEventListener('addressselected', event => {
      const address = event.detail;
      if (!geo.point(address?.lat, address?.lng) || !address.address) return;
      manual[id] = null;
      invalidate();
      points[id] = { lat: address.lat, lng: address.lng, address: address.address };
      drawMarkers();
      scheduleRoute();
    });
  }
  el('retry-route').addEventListener('click', () => { invalidate(); scheduleRoute(); });
  function startMap() {
    if (map || !globalThis.L) return;
    map = L.map('journey-map', { scrollWheelZoom: false }).setView([-28.5, 25], 5);
    L.tileLayer(config.tiles, { maxZoom: 19, attribution: config.tileAttribution }).addTo(map)
      .on('tileerror', () => { el('map-status').textContent = 'Some map tiles could not load. Your selected addresses and distance are still available.'; });
    drawMarkers();
    if (route) showRoute(route);
    new ResizeObserver(() => map.invalidateSize()).observe(el('journey-map'));
  }
  if (globalThis.L) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { startMap(); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(el('journey-map'));
  } else {
    el('map-status').textContent = 'The map preview could not load. Address search and driving-distance calculation can still be used.';
  }
  globalThis.MBELocations = {
    getJourney() {
      if (manual.origin || manual.destination) {
        const endpoints = {};
        for (const id of Object.keys(points)) {
          const endpoint = points[id] || { address: manual[id] };
          if (!endpoint.address || endpoint.address !== el(id).value) return null;
          endpoints[id] = endpoint;
        }
        return { ...endpoints, route: geo.unavailable() };
      }
      if (!points.origin || !points.destination || !route) return null;
      if (Object.entries(points).some(([id, p]) => p.address !== el(id).value)) return null;
      return { origin: { ...points.origin }, destination: { ...points.destination }, route };
    }
  };
})();
