/* Pure address, routing and email helpers, shared by the browser and Node checks. */
globalThis.MBEJourney = (() => {
  function point(latitude, longitude) {
    if (![latitude, longitude].every(value => typeof value === 'string' || typeof value === 'number')) return null;
    if (String(latitude).trim() === '' || String(longitude).trim() === '') return null;
    const lat = Number(latitude), lng = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng } : null;
  }
  const coordinates = p => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
  function addresses(data) {
    if (!Array.isArray(data?.features)) throw new Error('Invalid search response');
    const seen = new Set();
    return data.features.map(feature => {
      const p = feature.properties || {}, c = feature.geometry?.coordinates;
      const position = feature.geometry?.type === 'Point' && Array.isArray(c) && point(c[1], c[0]);
      const street = [p.housenumber, p.street].filter(Boolean).join(' ');
      const address = [...new Set([p.name, street, p.district, p.city || p.county, p.state, p.postcode, p.country]
        .filter(part => typeof part === 'string' && part.trim()).map(part => part.trim()))].join(', ');
      if (!position || !address || seen.has(address)) return null;
      seen.add(address);
      return { ...position, address, southAfrica: String(p.countrycode).toUpperCase() === 'ZA' };
    }).filter(Boolean).sort((a, b) => Number(b.southAfrica) - Number(a.southAfrica)).slice(0, 6);
  }
  function roadResult(data) {
    const route = data?.routes?.[0];
    if (data?.code !== 'Ok' || !Number.isFinite(route?.distance) || route.distance < 0 ||
        route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) ||
        route.geometry.coordinates.length < 2 ||
        !route.geometry.coordinates.every(p => Array.isArray(p) && p.length >= 2 && point(p[1], p[0]))) {
      throw new Error('No usable road route');
    }
    return { kind: 'road', km: route.distance / 1000, line: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
  }
  const unavailable = () => ({ kind: 'unavailable', km: null, line: null });
  const distanceText = route => route.kind === 'road'
    ? `Estimated driving distance: ${route.km.toFixed(1)} km`
    : 'Driving distance unavailable — please retry or ask MBE to confirm.';
  function directions(a, b) {
    const params = new URLSearchParams({ api: '1', origin: coordinates(a), destination: coordinates(b), travelmode: 'driving' });
    return `https://www.google.com/maps/dir/?${params}`;
  }
  function draft({ origin, destination, route, service, date, passengers, routingCredit, customer }) {
    return [
      'Transport quote enquiry for MBE Transportation',
      `Customer: ${customer.name}`,
      `Customer phone: ${customer.phone || 'Not provided'}`,
      `Service: ${service}`,
      `Pickup address: ${origin.address}`,
      `Pickup coordinates (latitude, longitude): ${coordinates(origin)}`,
      `Destination address: ${destination.address}`,
      `Destination coordinates (latitude, longitude): ${coordinates(destination)}`,
      distanceText(route),
      route.kind === 'road' ? `Routing: ${routingCredit}; OpenStreetMap data. Standard driving estimate; no live traffic or bus-specific restrictions.`
        : 'No driving distance or road route could be calculated. Please confirm the travel distance.',
      `Travel date: ${date}`,
      `Passengers: ${passengers}`,
      `Google Maps directions: ${directions(origin, destination)}`,
      'Please confirm the route, vehicle suitability, quotation and availability. This is an enquiry, not a confirmed booking.'
    ].join('\n');
  }
  return { point, coordinates, addresses, roadResult, unavailable, distanceText, directions, draft };
})();
