import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const company = JSON.parse(await readFile(new URL('data/company.json', root), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
for (const key of ['about', 'vision', 'mission', 'services', 'values', 'process', 'safety', 'why']) {
  for (const item of company[key]) {
    for (const value of typeof item === 'string' ? [item] : [item.title, item.description]) {
      assert(html.includes(escape(value)), `Missing profile wording: ${value}`);
    }
  }
}
assert.equal(company.services.length, 5);
for (const vehicle of company.fleet) {
  assert(html.includes(escape(vehicle.category)) && html.includes(escape(vehicle.capacity) + ' seats'));
}
assert.equal(company.values.length, 4);
assert.equal(company.process.length, 5);
assert.equal(company.safety.length, 3);
assert.equal(company.why.length, 3);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(target), `Missing anchor ${target}`);
for (const [, path] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (path.startsWith('#') || path.startsWith('mailto:') || path.startsWith('https://')) continue;
  assert(!path.startsWith('/'), `Project deployment requires relative paths: ${path}`);
  await access(new URL(path, root));
}
const options = [...html.matchAll(/<option>(.*?)<\/option>/g)].map(match => match[1]);
assert.deepEqual(options, company.services.map(escape));
const processHTML = html.match(/<ol class="process">([\s\S]*?)<\/ol>/)[1];
assert.equal([...processHTML.matchAll(/<li>/g)].length, 5);
let position = -1;
for (const item of company.process) {
  const next = processHTML.indexOf(escape(item.title));
  assert(next > position, 'Incorrect delivery process order');
  position = next;
}
assert(html.includes(`mailto:${company.email}`));
assert(html.includes(company.registration) && html.includes(company.csd));
const enquiry = await readFile(new URL('scripts/enquiry.js', root), 'utf8');
assert(enquiry.includes(company.email), 'Enquiry recipient differs from company data');
assert(enquiry.includes('Nothing has been submitted by this website.'));
assert(!html.includes('id="origin-lat"') && !html.includes('id="destination-lat"'));
assert(!html.includes('id="customer-email"'));
assert(!enquiry.includes('customer-email'));
assert(html.includes('role="combobox"'));
assert(enquiry.includes('window.location.href = mailto'));
assert(!html.includes('id="draft"'), 'Coordinates must not be displayed in a web draft');
for (const script of ['scripts/build.mjs', 'scripts/navigation.js', 'scripts/enquiry.js', 'scripts/map-config.js', 'scripts/journey.js', 'scripts/locations.js', 'scripts/address-search.js']) {
  execFileSync(process.execPath, ['--check', new URL(script, root).pathname]);
}
execFileSync(process.execPath, [new URL('scripts/build.mjs', root).pathname]);
assert.equal(await readFile(new URL('index.html', root), 'utf8'), html, 'Generated content is stale');
await access(new URL('.nojekyll', root));
console.log('PASS: complete profile wording, item counts/order, service options, anchors, unique IDs, local assets, relative paths, enquiry recipient, JS syntax and reproducible static build.');
