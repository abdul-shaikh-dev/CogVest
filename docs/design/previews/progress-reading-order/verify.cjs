// DOM/interaction regression checks, not a substitute for browser visual QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), {
  runScripts: 'outside-only',
});
const { window } = dom;
window.requestAnimationFrame = () => {};
window.ResizeObserver = class { observe() {} };
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.eval(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'));
const doc = window.document;
const get = id => doc.getElementById(id);
const click = selector => doc.querySelector(selector).click();
const change = (id, value) => {
  get(id).value = value;
  get(id).dispatchEvent(new window.Event('change'));
};
const chartMonths = () => [...doc.querySelectorAll('.month-nav span')].map(x => x.textContent);

assert.equal(doc.querySelectorAll('canvas').length, 2);
assert.match(get('month-summary').textContent, /19.87L/);
click('[data-chart="portfolio"][data-move="-1"]');
assert.deepEqual(chartMonths(), ['Apr 2026', 'May 2026']);
click('[data-chart="assets"][data-range="3M"]');
assert.deepEqual(chartMonths(), ['Apr 2026', 'May 2026']);
click('[data-chart="portfolio"][data-range="Custom"]');
change('range-from', '4');
assert.deepEqual([...get('range-to').options].map(o => o.value), ['5', '6']);
change('range-to', '5');
get('apply-range').click();
assert.equal(get('custom').open, false);
assert.deepEqual(chartMonths(), ['Apr 2026', 'May 2026']);
click('[data-chart="portfolio"][data-move="-1"]');
assert.equal(doc.activeElement.textContent, 'Mar 2026');
assert.equal(doc.querySelector('[data-chart="portfolio"][data-move="-1"]').disabled, true);

get('open-history').click();
assert.deepEqual([...get('history-year').options].map(o=>o.value), ['2026','2025']);
assert.equal(doc.querySelectorAll('.history-month').length, 5);
assert.equal(doc.querySelectorAll('.history-month[open]').length, 0);
assert.match(doc.querySelector('[data-month="2026-01"] summary').getAttribute('aria-label'), /Dec 2025/);
change('history-year', '2025');
assert.equal(doc.querySelectorAll('.history-month').length, 12);
assert.match(get('detail-body').textContent, /First stored month/);
const january=doc.querySelector('[data-month="2025-01"]');
const february=doc.querySelector('[data-month="2025-02"]');
january.open=true;
january.dispatchEvent(new window.Event('toggle'));
february.open=true;
february.dispatchEvent(new window.Event('toggle'));
assert.equal(january.open, false);
assert.equal(february.open, true);
assert.match(doc.querySelector('[data-month="2025-03"] summary').textContent, /−|-\d/);
change('history-year', '2026');
assert.equal(doc.querySelectorAll('.history-month[open]').length, 0);
for (const label of ['Equity', 'Debt', 'Crypto', 'Cash', 'Invested capital', 'Monthly investment', 'Salary', 'Expenses', 'Investment rate', 'Expense rate']) {
  assert.ok(get('detail-body').textContent.includes(label), label);
}
get('close-details').click();
get('mask').click();
assert.equal(get('mask').getAttribute('aria-pressed'), 'true');
assert.ok(!get('month-summary').textContent.includes('19.87'));
assert.ok(!get('charts').textContent.includes('19.87'));
get('open-history').click();
assert.ok(!get('detail-body').textContent.includes('19.87'));
assert.ok(!get('detail-body').textContent.includes('%'));
assert.ok(!get('detail-body').innerHTML.includes('19.87'));
get('close-details').click();
get('mask').click();
change('scenario', 'estimated');
assert.match(get('snapshot-status').textContent, /estimated/);
change('scenario', 'empty');
assert.equal(doc.querySelectorAll('canvas').length, 0);
assert.equal(get('history-entry').hidden, true);
get('empty-info').click();
assert.equal(get('status-details').open, true);
get('close-status').click();
change('scenario', 'populated');
assert.equal(doc.querySelectorAll('canvas').length, 2);
assert.equal(get('history-entry').hidden, false);

// Exercise canvas drawing with a recording context; this checks finite geometry only.
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
  get: (_, name) => name === 'createLinearGradient'
    ? () => ({ addColorStop() {} })
    : (...args) => args.forEach(value => {
      if (typeof value === 'number') assert.ok(Number.isFinite(value));
    }),
  set: () => true,
});
for (const canvas of doc.querySelectorAll('canvas')) {
  Object.defineProperty(canvas, 'clientWidth', { value: 300 });
}
get('large-text').checked = true;
get('large-text').dispatchEvent(new window.Event('change'));
assert.equal(doc.documentElement.style.getPropertyValue('--scale'), '1.3');
assert.ok(doc.body.classList.contains('large'));
console.log('PASS preview DOM interactions, masking, stored ranges, history, states and finite chart geometry');
dom.window.close();
