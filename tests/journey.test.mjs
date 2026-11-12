import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = name => readFileSync(new URL(`../scripts/${name}`, import.meta.url), 'utf8');
const context = vm.createContext({ URLSearchParams });
vm.runInContext(source('journey.js'), context);
const geo = context.MBEJourney;
const a = { lat: -26.2041, lng: 28.0473, address: 'Johannesburg, South Africa' };
const b = { lat: -25.7479, lng: 28.2293, address: 'Pretoria, South Africa' };
const response = { code: 'Ok', routes: [{ distance: 59000, geometry: { type: 'LineString', coordinates: [[28.0473, -26.2041], [28.2293, -25.7479]] } }] };
const feature = (p, countrycode = 'ZA') => ({ geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { name: p.address, countrycode } });

test('coordinate validation rejects invalid provider coordinates', () => {
  for (const pair of [['', '28'], ['-26', ''], [null, 28], [undefined, 28], [91, 28], [-26, 181], ['NaN', 28]]) assert.equal(geo.point(...pair), null);
  assert.equal(geo.point(0, 0).lat, 0);
});
test('search results form readable addresses, prioritise SA and discard invalid/duplicate results', () => {
  const items = geo.addresses({ features: [feature({ ...a, address: 'Foreign result' }, 'GB'), feature(b), feature(b), feature({ lat: 200, lng: 300, address: 'Invalid' })] });
  assert.equal(items.length, 2);
  assert.equal(items[0].address, b.address);
  assert.equal(items[0].lat, b.lat);
  assert.equal(items[0].lng, b.lng);
  assert.throws(() => geo.addresses({}));
});
test('road distance uses provider metres and no-route never invents distance or geometry', () => {
  const road = geo.roadResult(response);
  assert.equal(road.km, 59);
  assert.equal(road.line[0][0], a.lat);
  assert.equal(road.line[0][1], a.lng);
  for (const invalid of [{ code: 'NoRoute' }, { code: 'Ok', routes: [] }, { code: 'Ok', routes: [{ distance: -1 }] }]) assert.throws(() => geo.roadResult(invalid));
  assert.equal(geo.unavailable().km, null);
  assert.equal(geo.unavailable().line, null);
  assert.match(geo.distanceText(geo.unavailable()), /unavailable/);
});
test('email includes customer details, resolved addresses, hidden coordinates and directions', () => {
  for (const route of [geo.roadResult(response), geo.unavailable()]) {
    const text = geo.draft({ origin: a, destination: b, route, service: '22-Seater Minibuses', date: '2027-01-15', passengers: '12', routingCredit: 'OSRM / FOSSGIS', customer: { name: 'Test Person', phone: '0123456789' } });
    for (const expected of [a.address, b.address, '-26.204100, 28.047300', '-25.747900, 28.229300', '2027-01-15', 'Passengers: 12', '22-Seater Minibuses', 'Test Person', '0123456789', 'not a confirmed booking']) assert(text.includes(expected));
    assert(!text.includes('Customer email:'));
    const url = new URL(geo.directions(a, b));
    assert.equal(url.searchParams.get('origin'), '-26.204100, 28.047300');
    assert.equal(url.searchParams.get('destination'), '-25.747900, 28.229300');
    assert.equal(url.searchParams.get('api'), '1');
    if (route.kind === 'unavailable') { assert(text.includes('No driving distance')); assert(!text.includes(' km')); }
  }
});

function setup(search = false) {
  const nodes = new Map(), tasks = [], requests = [];
  let now = 100000;
  function createNode() {
    return { value: '', textContent: '', hidden: false, children: [], attributes: {}, listeners: {}, validationMessage: '',
      addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); },
      dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) fn(event); },
      setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; },
      setCustomValidity(message) { this.validationMessage = message; },
      replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, scrollIntoView() {} };
  }
  const node = id => { if (!nodes.has(id)) nodes.set(id, createNode()); return nodes.get(id); };
  const ctx = vm.createContext({ URLSearchParams, AbortController, Event,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    Date: { now: () => now }, document: { getElementById: node, dispatchEvent() {}, createElement: createNode },
    setTimeout(fn, delay) { const task = { fn, at: now + delay }; tasks.push(task); return task; },
    clearTimeout(task) { if (task) task.cancelled = true; },
    fetch(url, options) { return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })); }
  });
  for (const file of ['map-config.js', 'journey.js', 'locations.js', ...(search ? ['address-search.js'] : [])]) vm.runInContext(source(file), ctx);
  function select(id, point) {
    node(id).value = point.address;
    node(id).dispatchEvent({ type: 'addressselected', detail: point });
  }
  function runNext() {
    const task = tasks.filter(task => !task.cancelled && !task.ran).sort((a, b) => a.at - b.at)[0];
    assert(task, 'Expected scheduled work'); task.ran = true; now = task.at; task.fn();
  }
  const input = (id, value) => { node(id).value = value; node(id).dispatchEvent({ type: 'input' }); };
  return { ctx, node, requests, select, runNext, tasks, input };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('late routing responses cannot restore an old route after address edits', async () => {
  const app = setup();
  app.select('origin', a); app.select('destination', b); app.runNext();
  assert.equal(app.ctx.MBELocations.getJourney(), null);
  app.select('destination', { ...b, lat: -25.8 }); app.runNext();
  app.requests[0].resolve({ ok: true, json: async () => response }); await settle();
  assert.equal(app.ctx.MBELocations.getJourney(), null);
  app.requests[1].resolve({ ok: true, json: async () => response }); await settle();
  assert.equal(app.ctx.MBELocations.getJourney().destination.lat, -25.8);
  app.input('origin', 'Changed address');
  assert.equal(app.ctx.MBELocations.getJourney(), null);
});
test('network failure and timeout produce unavailable status with no invented distance', async () => {
  for (const timeout of [false, true]) {
    const app = setup(); app.select('origin', a); app.select('destination', b); app.runNext();
    if (timeout) app.runNext();
    app.requests[0].reject(new Error(timeout ? 'AbortError' : 'offline')); await settle();
    assert.equal(app.ctx.MBELocations.getJourney().route.km, null);
    assert.equal(app.ctx.MBELocations.getJourney().route.line, null);
    assert.match(app.node('route-distance').textContent, /unavailable/);
    assert(!app.node('route-distance').textContent.includes(' km'));
  }
});
test('autocomplete debounces, rejects stale results and selects via keyboard', async () => {
  const app = setup(true);
  app.input('origin', 'Jo'); assert.equal(app.requests.length, 0);
  app.input('origin', 'Joh'); app.input('origin', 'Johannesburg'); app.runNext();
  assert.equal(app.requests.length, 1);
  assert.equal(new URL(app.requests[0].url).searchParams.get('lat'), '-28.5');
  app.input('origin', 'Pretoria'); app.runNext(); app.runNext();
  assert.equal(app.requests.length, 2);
  app.requests[0].resolve({ ok: true, json: async () => ({ features: [feature(a)] }) }); await settle();
  assert.equal(app.node('origin-suggestions').children.length, 0);
  app.requests[1].resolve({ ok: true, json: async () => ({ features: [feature(b)] }) }); await settle();
  assert.equal(app.node('origin-suggestions').children[0].textContent, b.address);
  app.node('origin').dispatchEvent({ type: 'keydown', key: 'ArrowDown', preventDefault() {} });
  app.node('origin').dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });
  assert.equal(app.node('origin').value, b.address);
  assert.equal(app.node('origin').validationMessage, '');
  assert.equal(app.node('origin-suggestions').hidden, true);
});
test('empty/error searches show useful messages and typed text never becomes a selected address', async () => {
  const app = setup(true);
  app.input('origin', 'Unknown street'); app.runNext();
  app.requests[0].resolve({ ok: true, json: async () => ({ features: [] }) }); await settle();
  assert.match(app.node('origin-search-status').textContent, /No matching/);
  assert(app.node('origin').validationMessage);
  assert.equal(app.ctx.MBELocations.getJourney(), null);
  app.input('origin', 'Another address'); app.runNext(); app.runNext();
  app.requests[1].reject(new Error('offline')); await settle();
  assert.match(app.node('origin-search-status').textContent, /unavailable/);
});

test('Send Quotation Request builds a mailto only after validation and includes all details', () => {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
    return nodes.get(id);
  };
  let valid = true, journey = { origin: a, destination: b, route: geo.roadResult(response) };
  node('planner').reportValidity = () => valid;
  for (const [id, value] of Object.entries({ 'customer-name': 'Test Customer', 'customer-phone': '0123456789', service: '15-Seater Minibuses', date: '2027-01-15', passengers: '12' })) node(id).value = value;
  const window = { location: { href: '' } };
  const ctx = vm.createContext({ Date, window, document: { getElementById: node, addEventListener() {} }, MBEJourney: geo, MBEMapConfig: { routingCredit: 'OSRM / FOSSGIS' }, MBELocations: { getJourney: () => journey } });
  vm.runInContext(source('enquiry.js'), ctx);
  valid = false;
  node('planner').listeners.submit({ preventDefault() {} });
  assert.equal(window.location.href, '');
  valid = true;
  node('planner').listeners.submit({ preventDefault() {} });
  const url = new URL(window.location.href);
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, 'mohale.enterprice@gmail.com');
  assert.equal(url.searchParams.has('from'), false);
  assert(!url.searchParams.get('body').includes('Customer email:'));
  assert.match(url.searchParams.get('subject'), /2027-01-15/);
  for (const value of ['Test Customer', '0123456789', '59.0 km', '-26.204100', 'Google Maps directions:']) assert(url.searchParams.get('body').includes(value));
  window.location.href = ''; journey = null;
  node('planner').listeners.submit({ preventDefault() {} });
  assert.equal(window.location.href, '');
  assert.match(node('form-error').textContent, /Choose both addresses/);
});

test('typed pickup and drop-off work independently and edits invalidate confirmation', () => {
  const app = setup(true);
  app.select('destination', b);
  app.input('origin', 'Farm gate 2');
  app.node('origin-manual').dispatchEvent({ type: 'click' });
  const mixed = app.ctx.MBELocations.getJourney();
  assert.equal(mixed.origin.address, 'Farm gate 2');
  assert.equal(mixed.destination.lat, b.lat);
  assert.equal(mixed.route.kind, 'unavailable');
  app.input('destination', 'Community hall');
  assert.equal(app.ctx.MBELocations.getJourney(), null);
  app.node('destination-manual').dispatchEvent({ type: 'click' });
  const text = geo.draft({ ...app.ctx.MBELocations.getJourney(), customer: { name: 'Test' } });
  assert.match(text, /Farm gate 2/);
  assert.match(text, /Community hall/);
  assert.doesNotMatch(text, /coordinates|Google Maps directions| km/);
});
