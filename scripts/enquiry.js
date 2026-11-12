(() => {
  const field = id => document.getElementById(id);
  const form = field('planner');
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  field('date').min = today.toISOString().slice(0, 10);
  field('prepare').disabled = false;
  function clearStatus() {
    field('status').textContent = '';
    field('form-error').textContent = '';
  }
  form.addEventListener('input', clearStatus);
  form.addEventListener('change', clearStatus);
  document.addEventListener('journeychange', clearStatus);
  function prepare() {
    for (const id of ['customer-name', 'customer-phone']) field(id).value = field(id).value.trim();
    if (!form.reportValidity()) return null;
    const journey = globalThis.MBELocations?.getJourney();
    if (!journey) {
      field('form-error').textContent = 'Choose both addresses using a suggestion or Use address as typed. If both are mapped, wait for the distance check.';
      return null;
    }
    return MBEJourney.draft({ ...journey, service: field('service').value,
      date: field('date').value, passengers: field('passengers').value, routingCredit: MBEMapConfig.routingCredit,
      customer: { name: field('customer-name').value, phone: field('customer-phone').value } });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const draft = prepare();
    if (!draft) return;
    const subject = 'Transport quote enquiry – ' + field('date').value;
    const mailto = 'mailto:mohale.enterprice@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(draft);
    field('status').textContent = 'Opening your email app. Review the draft and send it yourself. Nothing has been submitted by this website.';
    window.location.href = mailto;
  });
  field('copy').addEventListener('click', async () => {
    const draft = prepare();
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      field('status').textContent = 'Quotation details copied. Paste them into your email to mohale.enterprice@gmail.com and send it yourself.';
    } catch {
      field('status').textContent = 'Copying is unavailable in this browser. Use Send Quotation Request to open the draft in your email app.';
    }
  });
})();
