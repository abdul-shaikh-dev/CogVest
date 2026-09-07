const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const dom = new JSDOM(
  fs.readFileSync(path.join(__dirname, "index.html"), "utf8"),
  { runScripts: "outside-only", pretendToBeVisual: true },
);
const w = dom.window,
  d = w.document;
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
w.eval(fs.readFileSync(path.join(__dirname, "app.js"), "utf8"));
const get = (id) => d.getElementById(id);
const click = (selector) => {
  const node = d.querySelector(selector);
  assert.ok(node, selector);
  node.click();
};
const change = (id, value) => {
  const el = get(id);
  if (el.type === "checkbox") el.checked = value;
  else el.value = value;
  el.dispatchEvent(new w.Event("change"));
};
assert.equal(d.querySelectorAll("[data-holding]").length, 6);
assert.equal(d.querySelector("[data-holding]").dataset.holding, "liquid");
assert.match(get("results").textContent, /Allocation 32.2%/);
click('[data-filter="winners"]');
assert.equal(d.querySelectorAll("[data-holding]").length, 4);
click('[data-filter="losers"]');
assert.equal(d.querySelectorAll("[data-holding]").length, 2);
click('[data-filter="high"]');
assert.equal(d.querySelectorAll("[data-holding]").length, 4);
click('[data-filter="all"]');
get("screen").scrollTop = 150;
click('[data-holding="hdfc"]');
assert.equal(get("detail").open, true);
assert.match(get("detail-content").textContent, /1,82,850/);
assert.match(get("detail-content").textContent, /18,615/);
click("#detail-mask");
assert.ok(!get("detail-content").textContent.includes("1,82,850"));
assert.match(get("detail-content").textContent, /1,828.5/);
click("#back");
assert.equal(get("detail").open, false);
assert.equal(get("screen").scrollTop, 150);
click("#mask");
get("search").value = "information technology";
get("search").dispatchEvent(new w.Event("input"));
assert.equal(d.querySelectorAll("[data-holding]").length, 1);
get("search").value = "not-a-holding";
get("search").dispatchEvent(new w.Event("input"));
assert.match(get("results").textContent, /No matching/);
click('[data-action="clear"]');
assert.equal(d.querySelectorAll("[data-holding]").length, 6);
change("scenario", "pending");
assert.match(get("notice").textContent, /incomplete/);
assert.doesNotMatch(get("results").textContent, /Allocation/);
assert.match(get("results").textContent, /Invested/);
assert.match(get("results").textContent, /Price needed/);
click('[data-holding="tcs"]');
assert.match(get("detail-content").textContent, /Valuation pending/);
assert.match(get("detail-content").textContent, /Allocation \(excluding cash and PPF\)Unavailable/);
assert.ok(!get("detail-content").textContent.includes("NaN"));
click("#back");
change("minimal", true);
assert.equal(get("insights").hidden, true);
assert.ok(d.querySelector(".phone").classList.contains("minimal"));
change("scenario", "ppf");
assert.match(get("results").textContent, /My PPF/);
assert.ok(!get("results").textContent.includes("return"));
assert.equal(get("filters").children.length, 0);
change("scenario", "normal");
change("with-ppf", true);
click('[data-tab="ppf"]');
assert.match(get("results").textContent, /confirmed balance/);
click('[data-tab="market"]');
assert.equal(d.querySelectorAll("[data-holding]").length, 6);
change("with-ppf", false);
change("scenario", "empty");
assert.match(get("results").textContent, /Bring your portfolio together/);
assert.equal(get("insights").hidden, true);
change("scenario", "many");
assert.equal(d.querySelectorAll("[data-holding]").length, 30);
change("large", true);
change("narrow", true);
assert.ok(d.querySelector(".phone").classList.contains("large"));
assert.ok(d.querySelector(".phone").classList.contains("narrow"));
click("#add");
assert.equal(get("sheet").open, true);
click('[data-destination="Add one holding"]');
assert.match(get("sheet-content").textContent, /No financial data is saved/);
dom.window.close();
console.log(
  "PASS: list ordering, filters, search, detail/back, masking, pending, Minimal, PPF, empty, long-list, display controls and explicit navigation boundaries. DOM checks only; not browser layout verification.",
);
