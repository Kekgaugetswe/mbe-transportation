# MBE Transportation

A lightweight static website using the approved Option 4 colours, imagery and enquiry-card design. It follows the MusiqHeart project's HTML/CSS/JavaScript, `assets/`, `scripts/`, `styles/` and separate-data conventions. One page with section anchors avoids routing or refresh requirements on GitHub Pages. The header and footer are kept in the page because there is only one page to maintain.

## Content and build

`data/company.json` contains the original wording from **MBE Transportation Profile_20260326_103512_0000.pdf**, pages 2–9, plus the contact email from page 1. Only line wrapping and decorative numbering have been normalised. The profile's first safety item is labelled “08”; the website retains its heading and description without that apparent numbering error.

`node scripts/build.mjs` updates the marked content blocks in `index.html`. Edit company wording in the JSON; edit layout in the builder and the surrounding HTML. The generated `index.html` is included for deployment. Content is available without JavaScript and no build runs in the visitor's browser. No dependencies need installing.

```sh
node scripts/build.mjs
node scripts/validate.mjs
python3 -m http.server 8765
```

Open `http://localhost:8765`. Opening `index.html` directly also displays the site; clipboard permissions vary by browser.

## Content coverage

- About Us: full overview, registration 2024/686638/07 and CSD MAAA1564711.
- Complete Vision and Our Mission; all four core values and descriptions.
- Five transport services and four passenger fleet categories follow the client’s revised list.
- Our Fleet: the three stated capacity categories; no fleet quantities are claimed.
- Safety & Reliability: all five delivery steps and all three health and safety commitments, with full original descriptions in order.
- Why Choose Us: all three reasons and descriptions.
- Contact & Quotations: the supplied email and one email-based enquiry form.

All requested company-profile sections are present. The source provides no telephone number, office address, pricing, fleet quantities, testimonials or specific accreditation details. These are omitted. Compliance statements reproduce the profile; no additional certifications are claimed. Existing homepage artwork and headline remain part of the approved design.

## GitHub Pages

Commit the site files, including generated `index.html` and `.nojekyll`, to the intended repository. In Settings → Pages select **Deploy from a branch → main → / (root)**. No server, package installation, SPA rewrite or build action is required on Pages. Asset links are relative, supporting both a repository URL and a custom domain.

Direct links such as `index.html#about`, `index.html#safety` and `index.html#enquiry` load the real HTML page and work on refresh. When a domain is available, configure it in Pages, add the matching CNAME and configure DNS; no source restructuring is needed. No domain has been assumed or configured here.

## Enquiries

The form prepares a local draft. The visitor reviews it and opens an email addressed to mohale.enterprice@gmail.com, or copies it. No message is submitted by this website, no booking is confirmed and no payment is collected. Prices, availability and reservations require confirmation by MBE. If the company email changes, update both `data/company.json` and `scripts/enquiry.js`; validation checks that they agree.

## Verification

`node scripts/validate.mjs` checks profile content coverage, counts/order, form categories, unique IDs, anchor destinations, local assets, project-relative paths, email consistency, JavaScript syntax and a reproducible build. Browser checks remain necessary for layout and interactions. This directory is not currently a Git repository, and deployment is not performed by these commands.

## Address search and driving-distance quotations

Customers use **Pickup Address** and **Drop-off Address** autocomplete inputs. They choose a suggestion; its readable address and geographic point are stored together in page memory. Coordinates are never displayed in form controls or a website draft. The map is a preview, with fixed A/B markers; changing either address clears its previous selection and route. Use address as typed accepts a manual endpoint for the enquiry. MBE confirms the distance when either endpoint is manual.

Name is required; phone is optional. The form does not ask for or read the customer’s email address. Their default email application supplies its configured sending account; the customer can choose another account within that app. “Send Quotation Request” validates the form and opens `mailto:mohale.enterprice@gmail.com` synchronously from the click, with a prefilled subject/body. The customer must review and send the email manually. The body includes customer details, service, both resolved addresses and their coordinates, driving distance (or an explicit unavailable status), date, passenger count and a Google Maps directions link. The website does not submit requests, reserve vehicles or confirm availability. A copy button provides a fallback when a mail app is not configured; long mailto URLs remain subject to the customer's mail-client limits.

### Providers, pricing and usage constraints

Terms/documentation checked on 3 November 2026:

- **Photon / komoot address search:** public search-as-you-type endpoint, no API key, account or billing setup required for this implementation. The provider allows reasonable project usage but does not publish a numeric free quota, guaranteed availability or a paid-service SLA for this endpoint. Extensive use may be throttled/banned and terms can change. Searches use a South Africa geographic bias and prioritise South African results without excluding other countries. Each field waits 650 ms after typing, requires at least three characters, cancels stale requests and uses a shared minimum 1.1-second interval across both fields. Up to 30 searches are cached in page memory. These are page-level controls, not an aggregate quota across all customers. Move to a contracted browser-compatible search provider if traffic grows or guaranteed availability is needed. https://github.com/komoot/photon#demo-server and https://github.com/komoot/photon/blob/master/docs/api-v1.md
- **OpenStreetMap tiles:** no key or billing account is configured. Required attribution remains visible. Browser caching and Referer/User-Agent are preserved; tiles load as the form approaches the viewport. No scraping, bulk download, offline cache or prefetch feature is implemented. The service is best-effort and may block heavy usage. https://operations.osmfoundation.org/policies/tiles/
- **FOSSGIS public OSRM car routing:** browser HTTPS requests without a key/billing setup. Published maximum: one request per second; no heavy use or scraping. Requests are debounced, spaced at least 1.1 seconds apart per page, cancelled on changes and cached for up to 20 successful location pairs. Page-level throttling cannot enforce a site-wide quota. This public service is appropriate only for light use; move to a suitable contracted provider before substantial traffic. Required attribution and a map-correction link are shown. https://routing.openstreetmap.de/about.html
- **Google Maps directions links:** no Google API key or Maps billing account is needed for a directions URL. The site does not call Google's paid Maps/Places/Routes APIs. https://developers.google.com/maps/documentation/urls/get-started

No secret credentials are stored in the repository. Endpoints are configured in `scripts/map-config.js`. Changing provider may require adapting response parsing; check CORS, pricing, quotas and attribution. Browser API keys are inherently public and must be provider-approved, domain-restricted keys, never server secrets. Public Nominatim is deliberately not used because its usage policy prohibits autocomplete.

### Routing behaviour

Road distance and route geometry come from OSRM; no invented line or straight-line distance is used. Routing may snap the geocoded point to a nearby road within 150 metres. It is a standard driving estimate, not a bus-dimension, live-traffic, future-date or availability check. MBE must confirm route and vehicle suitability. On timeout, network error, no route or invalid data, the route line disappears and the UI explicitly says driving distance is unavailable. Customers may retry or send an enquiry with the unavailable status; no distance is guessed. Pending requests must settle before sending.

### Files and hosting

- `scripts/address-search.js`: accessible combobox suggestions, debounce, cache, keyboard/pointer selection and stale search protection.
- `scripts/locations.js`: internal selected-address state, preview markers and route requests.
- `scripts/journey.js`: provider parsing, validation, Google directions and email formatting.
- `scripts/enquiry.js`: customer/trip validation, mailto navigation and copy action.
- `assets/vendor/leaflet/`: pinned Leaflet 1.9.4 and BSD-2-Clause licence. No runtime CDN script dependency.

No backend, authentication, database, persistence or payments are introduced. Address searches go to Photon, viewed map areas to OpenStreetMap and selected route points to FOSSGIS; linked notices disclose these services. Customer name/phone are not sent to map/search/routing providers. They enter only the email draft or copied text. Provider data coverage can be incomplete: the user is prompted to try a street/venue plus city when no result is available.

Use an HTTP local server during development and HTTPS GitHub Pages in deployment. `file://` is unsuitable for map requests because it lacks a web Referer. Relative local asset paths support project subpaths and future custom domains.

```sh
node scripts/build.mjs
node scripts/validate.mjs
node --test tests/journey.test.mjs
```

Tests cover provider parsing, South Africa prioritisation, coordinate validity, route distances, unavailable-route behaviour, full email content, stale route/search responses, search debounce, keyboard selection and search failures. Browser checks exercise the real public services sparingly.
