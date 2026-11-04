(() => {
  const config = MBEMapConfig;
  const cache = new Map();
  // One shared search clock across both fields. No requests on initial page load.
  let nextRequest = 0;
  for (const id of ['origin', 'destination']) {
    const input = document.getElementById(id);
    const list = document.getElementById(`${id}-suggestions`);
    const status = document.getElementById(`${id}-search-status`);
    let results = [], active = -1, version = 0, timer, controller;
    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function cancel() {
      version++;
      clearTimeout(timer);
      controller?.abort();
    }
    function select(index) {
      const address = results[index];
      if (!address) return;
      cancel(); close();
      input.value = address.address;
      input.setCustomValidity('');
      status.textContent = 'Address selected. Check the location on the map.';
      input.dispatchEvent(new CustomEvent('addressselected', { detail: address }));
    }
    function render(items) {
      results = items;
      active = -1;
      input.removeAttribute('aria-activedescendant');
      list.replaceChildren();
      items.forEach((address, index) => {
        const option = document.createElement('li');
        option.id = `${id}-option-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.textContent = address.address;
        // Keep focus in the combobox so pointer/touch clicks survive blur.
        option.addEventListener('pointerdown', event => event.preventDefault());
        option.addEventListener('click', () => select(index));
        list.append(option);
      });
      list.hidden = items.length === 0;
      input.setAttribute('aria-expanded', String(items.length > 0));
      status.textContent = items.length ? `${items.length} suggestions. Choose the matching address.`
        : 'No matching addresses found. Try a street or venue name with the town or city.';
    }
    async function search(query, currentVersion) {
      if (currentVersion !== version) return;
      const key = query.toLowerCase();
      if (cache.has(key)) { render(cache.get(key)); return; }
      // A different field may have used the slot while this search was waiting.
      if (Date.now() < nextRequest) {
        timer = setTimeout(() => search(query, currentVersion), nextRequest - Date.now());
        return;
      }
      nextRequest = Date.now() + config.minRequestIntervalMs;
      const currentController = new AbortController();
      controller = currentController;
      const timeout = setTimeout(() => currentController.abort(), config.timeoutMs);
      try {
        const params = new URLSearchParams({ q: query, limit: '6', lang: 'en', ...config.searchBias });
        const response = await fetch(`${config.search}?${params}`, { signal: currentController.signal, credentials: 'omit' });
        if (!response.ok) throw new Error('Search unavailable');
        const items = MBEJourney.addresses(await response.json());
        if (currentVersion !== version) return;
        if (cache.size >= 30) cache.delete(cache.keys().next().value);
        cache.set(key, items);
        render(items);
      } catch {
        if (currentVersion !== version) return;
        close();
        status.textContent = 'Address search is unavailable. Please try again shortly by editing the address.';
      } finally {
        clearTimeout(timeout);
        if (controller === currentController) controller = null;
      }
    }
    input.addEventListener('input', event => {
      cancel(); close(); results = [];
      input.setCustomValidity('Choose an address from the suggestions.');
      const query = input.value.trim();
      if (event.isComposing || query.length < 3) {
        status.textContent = 'Enter at least 3 characters to search.';
        return;
      }
      status.textContent = 'Searching addresses…';
      const currentVersion = version;
      timer = setTimeout(() => search(query, currentVersion), config.searchDebounceMs);
    });
    input.addEventListener('compositionend', () => input.dispatchEvent(new Event('input', { bubbles: true })));
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { cancel(); close(); return; }
      if (event.key === 'Enter' && !list.hidden) {
        event.preventDefault();
        if (active >= 0) select(active);
        else status.textContent = 'Choose a suggestion with the arrow keys or tap an address.';
        return;
      }
      if (!['ArrowDown', 'ArrowUp'].includes(event.key) || list.hidden) return;
      event.preventDefault();
      active = active < 0 ? (event.key === 'ArrowDown' ? 0 : results.length - 1)
        : (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
      input.setAttribute('aria-activedescendant', list.children[active].id);
      list.children[active].scrollIntoView({ block: 'nearest' });
    });
    input.addEventListener('blur', () => { cancel(); close(); });
    input.addEventListener('focus', () => {
      if (input.validationMessage && results.length) render(results);
    });
  }
})();
