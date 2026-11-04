import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const company = JSON.parse(await readFile(new URL('data/company.json', root), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const paragraphs = items => items.map(text => `<p>${escape(text)}</p>`).join('\n');
const cards = (items, level = 'h3') => items.map(item => `<article><${level}>${escape(item.title)}</${level}><p>${escape(item.description)}</p></article>`).join('\n');
const sections = `
<section class="content" id="about" aria-labelledby="about-title">
  <span class="eyebrow">MBE TRANSPORTATION</span>
  <h2 id="about-title">About Us</h2>
  <div class="overview">${paragraphs(company.about)}</div>
  <div class="purpose-grid">
    <article><h3>Vision</h3>${paragraphs(company.vision)}</article>
    <article><h3>Our Mission</h3>${paragraphs(company.mission)}</article>
  </div>
  <h3 class="subheading">Our Core Values</h3>
  <div class="values-grid">${cards(company.values, 'h4')}</div>
</section>
<section class="content services-section" id="services" aria-labelledby="services-title">
  <span class="eyebrow">OUR SERVICES</span>
  <h2 id="services-title">Our Services</h2>
  <ol class="service-list">${company.services.map((name, index) => `<li><span class="service-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><h3>${escape(name)}</h3></li>`).join('\n')}</ol>
</section>
<section class="fleet content" id="fleet" aria-labelledby="fleet-title">
  <img src="assets/fleet.webp" loading="lazy" alt="Coaches pictured in the MBE company profile" />
  <div><span class="eyebrow">OUR FLEET</span><h2 id="fleet-title">Our Fleet</h2>
    <ul class="fleet-list">${company.services.slice(0, 3).map(name => `<li>${escape(name)}</li>`).join('')}</ul>
    <a href="#enquiry">Request a quotation →</a>
  </div>
</section>
<section class="content" id="safety" aria-labelledby="safety-title">
  <span class="eyebrow">SAFETY &amp; RELIABILITY</span>
  <h2 id="safety-title">Safety &amp; Reliability</h2>
  <h3 class="subheading">Service Delivery Process</h3>
  <ol class="process">${company.process.map((item, index) => `<li><span class="step-label">Step ${index + 1}</span><h4>${escape(item.title)}</h4><p>${escape(item.description)}</p></li>`).join('\n')}</ol>
  <h3 class="subheading">Health &amp; Safety Commitment</h3>
  <div class="three-grid">${cards(company.safety, 'h4')}</div>
</section>
<section class="content why-section" aria-labelledby="why-title">
  <span class="eyebrow">WHY CHOOSE US</span>
  <h2 id="why-title">Why Choose Us</h2>
  <div class="three-grid">${cards(company.why)}</div>
</section>`;
const replacements = {
  profile: sections,
  services: company.services.map(name => `<option>${escape(name)}</option>`).join('\n'),
  email: `<a href="mailto:${escape(company.email)}">${escape(company.email)}</a>`,
  registration: `<span>Company registration ${escape(company.registration)}</span><span>CSD ${escape(company.csd)}</span>`
};
const file = new URL('index.html', root);
let html = await readFile(file, 'utf8');
for (const [key, value] of Object.entries(replacements)) {
  const start = `<!-- ${key}:start -->`;
  const end = `<!-- ${key}:end -->`;
  if (!html.includes(start) || !html.includes(end)) throw new Error(`Missing ${key} markers`);
  const from = html.indexOf(start) + start.length;
  const to = html.indexOf(end, from);
  html = html.slice(0, from) + '\n' + value + '\n' + html.slice(to);
}
await writeFile(file, html);
console.log('Built index.html from the company profile data.');
