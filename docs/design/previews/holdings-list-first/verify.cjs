// Deterministic DOM/interaction checks, not a substitute for browser visual QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

const directory = __dirname;
const indexHtml = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(directory, 'app.js'), 'utf8');

function createPreview() {
  const dom = new JSDOM(indexHtml, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const {window} = dom;

  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
  window.eval(appJs);

  return {dom, document: window.document, window};
}

function get(document, id) {
  const element = document.getElementById(id);
  assert.ok(element, `Missing #${id}`);
  return element;
}

function click(document, selector) {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing ${selector}`);
  element.click();
  return element;
}

function change(document, id, value) {
  const element = get(document, id);
  element.value = value;
  element.dispatchEvent(new element.ownerDocument.defaultView.Event('change', {bubbles: true}));
}

function input(document, id, value) {
  const element = get(document, id);
  element.value = value;
  element.dispatchEvent(new element.ownerDocument.defaultView.Event('input', {bubbles: true}));
}

function holdingCount(document) {
  return document.querySelectorAll('#results .holding').length;
}

function check(name, callback) {
  const fixture = createPreview();
  try {
    callback(fixture);
    return name;
  } finally {
    fixture.dom.window.close();
  }
}

const passed = [
  check('four and thirty market states', ({document}) => {
    assert.equal(holdingCount(document), 4);
    assert.match(get(document, 'subtitle').textContent, /^4 market positions$/);

    change(document, 'scenario', 'many');
    assert.equal(holdingCount(document), 30);
    assert.equal(document.querySelectorAll('[data-holding]').length, 30);
  }),

  check('empty and PPF states', ({document}) => {
    change(document, 'scenario', 'empty');
    assert.equal(holdingCount(document), 0);
    assert.match(get(document, 'results').textContent, /Your portfolio starts here/);
    assert.equal(get(document, 'search').parentElement.hidden, true);
    assert.equal(get(document, 'insights').hidden, true);

    change(document, 'scenario', 'ppf');
    assert.match(get(document, 'subtitle').textContent, /0 market positions · 1 PPF account/);
    assert.match(get(document, 'results').textContent, /My PPF/);
    assert.equal(get(document, 'search').parentElement.hidden, true);
    assert.equal(get(document, 'account-tabs').textContent, '');

    change(document, 'scenario', 'four');
    get(document, 'with-ppf').checked = true;
    get(document, 'with-ppf').dispatchEvent(new document.defaultView.Event('change', {bubbles: true}));
    assert.equal(document.querySelectorAll('#account-tabs [data-tab]').length, 2);
    click(document, '[data-tab="ppf"]');
    assert.match(get(document, 'results').textContent, /My PPF/);
  }),

  check('search and no-results recovery', ({document}) => {
    input(document, 'search', 'bitcoin');
    assert.equal(holdingCount(document), 1);
    assert.match(get(document, 'results').textContent, /Bitcoin/);

    input(document, 'search', 'does-not-exist');
    assert.equal(holdingCount(document), 0);
    assert.match(get(document, 'results').textContent, /No matching holdings/);

    click(document, '[data-action="clear"]');
    assert.equal(get(document, 'search').value, '');
    assert.equal(holdingCount(document), 4);
    assert.equal(document.activeElement, get(document, 'search'));
  }),

  check('winner, loser, and high-allocation filters', ({document}) => {
    click(document, '[data-filter="winners"]');
    assert.equal(holdingCount(document), 3);
    assert.equal(document.querySelector('[data-holding="btc"]'), null);
    assert.equal(click(document, '[data-filter="winners"]').getAttribute('aria-pressed'), 'true');

    click(document, '[data-filter="losers"]');
    assert.equal(holdingCount(document), 1);
    assert.equal(document.querySelector('[data-holding="btc"] .name').textContent, 'Bitcoin');

    click(document, '[data-filter="high"]');
    assert.equal(holdingCount(document), 4);
  }),

  check('expand, collapse, and focus restoration', ({document}) => {
    const selector = '[data-holding="hdfc"]';
    click(document, selector);
    let toggle = document.querySelector(selector);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(get(document, 'detail-hdfc').hidden, false);
    assert.equal(document.activeElement, toggle);

    click(document, selector);
    toggle = document.querySelector(selector);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(get(document, 'detail-hdfc').hidden, true);
    assert.equal(document.activeElement, toggle);
  }),

  check('pending valuation and allocation state', ({document}) => {
    change(document, 'scenario', 'pending');
    assert.match(get(document, 'context').textContent, /1 valuation pending/);
    assert.equal(holdingCount(document), 4);
    for (const meta of document.querySelectorAll('#results .meta')) {
      assert.match(meta.textContent, /Allocation unavailable/);
    }
    assert.equal(document.querySelector('[data-holding="hdfc"] .value strong').textContent, 'Pending');

    click(document, '[data-filter="high"]');
    assert.equal(holdingCount(document), 0);
    assert.match(get(document, 'results').textContent, /No matching holdings/);
  }),

  check('more-menu masking', ({document}) => {
    click(document, '#more');
    assert.equal(get(document, 'sheet').open, true);
    assert.equal(document.querySelector('[data-action="mask"]').textContent, 'Hide values');

    click(document, '[data-action="mask"]');
    assert.equal(get(document, 'sheet').open, false);
    assert.match(get(document, 'results').textContent, /Hidden|₹••••/);
    assert.equal(get(document, 'more').getAttribute('aria-label'), 'More holdings options');
    assert.equal(get(document, 'results').textContent.includes('1.83L'), false);

    click(document, '#more');
    assert.equal(document.querySelector('[data-action="mask"]').textContent, 'Show values');
  }),

  check('minimal mode hides insights', ({document}) => {
    assert.equal(get(document, 'insights').hidden, false);
    get(document, 'minimal').checked = true;
    get(document, 'minimal').dispatchEvent(new document.defaultView.Event('change', {bubbles: true}));
    assert.equal(get(document, 'insights').hidden, true);
  }),
];

console.log(`PASS ${passed.length} holdings preview DOM checks: ${passed.join(', ')}`);
