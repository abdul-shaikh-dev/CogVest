const $ = (id) => document.getElementById(id);
const glyphs = {
  add: 61699,
  search: 62819,
  more: 62158,
  forward: 62011,
  back: 61735,
  eye: 62186,
  hidden: 62184,
  equity: 62972,
  debt: 62846,
  crypto: 62429,
};
const icon = (name) =>
  `<i class="icon" aria-hidden="true">&#${glyphs[name]};</i>`;
const base = [
  {
    id: "hdfc",
    name: "HDFC Bank",
    symbol: "HDFCBANK",
    ticker: "HDFCBANK.NS",
    group: "equity",
    type: "Stock",
    sector: "Financial Services",
    value: 182850,
    invested: 164235,
    units: 100,
    source: "Yahoo Finance",
    date: "15 Apr 2024",
  },
  {
    id: "nifty",
    name: "Nifty 50 ETF",
    symbol: "NIFTYBEES",
    ticker: "NIFTYBEES.NS",
    group: "equity",
    type: "ETF",
    sector: "Diversified",
    value: 50665,
    invested: 44220,
    units: 200,
    source: "Yahoo Finance",
    date: "10 Jan 2025",
  },
  {
    id: "gold",
    name: "Sovereign Gold Bond",
    symbol: "SGBJUN30",
    ticker: "SGBJUN30.NS",
    group: "debt",
    type: "Government bond",
    sector: "Fixed Income",
    value: 57110,
    invested: 52950,
    units: 10,
    source: "Manual",
    date: "12 Jun 2022",
  },
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    ticker: "bitcoin",
    group: "crypto",
    type: "Crypto",
    sector: "Digital Asset",
    value: 139040,
    invested: 150000,
    units: 0.02,
    source: "CoinGecko",
    date: "08 Mar 2025",
  },
  {
    id: "liquid",
    name: "Liquid Fund",
    symbol: "LIQUID",
    ticker: "LIQUID",
    group: "debt",
    type: "Debt fund",
    sector: "Liquid / Overnight",
    value: 250250,
    invested: 250000,
    units: 2500,
    source: "Manual",
    date: "03 May 2026",
  },
  {
    id: "tcs",
    name: "Tata Consultancy Services",
    symbol: "TCS",
    ticker: "TCS.NS",
    group: "equity",
    type: "Stock",
    sector: "Information Technology",
    value: 98400,
    invested: 106000,
    units: 30,
    source: "Yahoo Finance",
    date: "14 Nov 2024",
  },
];
const state = { filter: "all", tab: "market", masked: false, selected: null };
const labels = { equity: "Equity", debt: "Debt", crypto: "Crypto" };
const percent = (value, digits = 1) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
function money(value, compact = true) {
  if (value === null) return "Unavailable";
  if (state.masked) return "Hidden";
  if (compact && Math.abs(value) >= 100000)
    return `₹${(value / 100000).toFixed(2)}L`;
  if (compact && Math.abs(value) >= 1000)
    return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function rows() {
  const mode = $("scenario").value;
  if (mode === "empty" || mode === "ppf") return [];
  if (mode === "many")
    return Array.from({ length: 30 }, (_, i) => ({
      ...base[i % 6],
      id: `item-${i}`,
      name: `${base[i % 6].name}${i < 6 ? "" : ` ${Math.floor(i / 6) + 1}`}`,
    }));
  return base.map((row) => ({
    ...row,
    value: mode === "pending" && row.id === "tcs" ? null : row.value,
  }));
}
function snapshot() {
  const all = rows();
  return {
    all,
    total: all.reduce((s, r) => s + (r.value ?? 0), 0),
    pending: all.some((r) => r.value === null),
  };
}
function matches(row, key, total, pending) {
  return (
    key === "all" ||
    (key === "winners" && row.value !== null && row.value >= row.invested) ||
    (key === "losers" && row.value !== null && row.value < row.invested) ||
    (key === "high" && !pending && total > 0 && row.value / total >= 0.1)
  );
}
function hasPpf() {
  return $("scenario").value === "ppf" || $("with-ppf").checked;
}
function weight(row, total, pending) {
  return pending || !total || row.value === null
    ? "Unavailable"
    : `${((row.value / total) * 100).toFixed(1)}%`;
}
function holding(row, total, pending) {
  const share = pending
    ? ""
    : `<span>Allocation ${weight(row, total, pending)}</span>`;
  const gain =
    row.value === null
      ? null
      : ((row.value - row.invested) / row.invested) * 100;
  return `<button class="holding" data-holding="${row.id}" aria-label="Open ${row.name} details"><div class="row-top"><span class="asset-icon ${row.group}">${icon(row.group)}</span><span class="identity"><strong>${row.name}</strong><small>${row.symbol} · ${row.type}${row.source === "Manual" ? " · Manual" : ""}</small></span><span class="amount"><strong>${row.value === null ? "Pending" : money(row.value)}</strong><small class="${gain === null ? "pending" : gain >= 0 ? "up" : "down"}">${gain === null ? "Price needed" : percent(gain)}</small></span></div><span class="row-bottom"><span>Invested ${money(row.invested)}</span>${share}</span></button>`;
}
function render() {
  const { all, total, pending } = snapshot(),
    ppf = hasPpf();
  if (!ppf) state.tab = "market";
  if (!all.length && ppf) state.tab = "ppf";
  const market = state.tab === "market";
  $("subtitle").textContent =
    `${all.length ? `${all.length} market positions` : "Your portfolio"}${ppf ? " · PPF 1" : ""}`;
  $("accounts").innerHTML =
    ppf && all.length
      ? ["market", "ppf"]
          .map(
            (tab) =>
              `<button data-tab="${tab}" aria-pressed="${tab === state.tab}">${tab === "market" ? `Market ${all.length}` : "PPF 1"}</button>`,
          )
          .join("")
      : "";
  $("search").parentElement.hidden = !all.length || !market;
  $("notice").innerHTML =
    pending && market
      ? '<div class="notice"><strong>One holding needs a price</strong>Invested value is saved. Current totals and allocations are incomplete.<br><button data-action="prices">View valuation details</button></div>'
      : "";
  $("filters").innerHTML =
    all.length && market
      ? [
          ["all", "All"],
          ["winners", "Winners"],
          ["losers", "Losers"],
          ["high", "High allocation"],
        ]
          .map(
            ([key, label]) =>
              `<button data-filter="${key}" aria-pressed="${state.filter === key}">${label}<small>${all.filter((r) => matches(r, key, total, pending)).length}</small></button>`,
          )
          .join("")
      : "";
  const query = $("search").value.trim().toLowerCase();
  const visible = all
    .filter((r) =>
      [
        r.name,
        r.symbol,
        r.ticker,
        r.group,
        labels[r.group],
        r.type,
        r.sector,
      ].some((v) => v.toLowerCase().includes(query)),
    )
    .filter((r) => matches(r, state.filter, total, pending))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  $("insights").hidden = !all.length || !market || $("minimal").checked;
  $("list-caption").textContent =
    market && all.length
      ? `${visible.length} positions · value order`
      : ppf
        ? "PPF accounts"
        : "";
  $("results").innerHTML = !market
    ? `<div class="list"><button class="holding" data-action="ppf"><div class="row-top"><span class="asset-icon debt">${icon("debt")}</span><span class="identity"><strong>My PPF</strong><small>SBI · confirmed balance</small></span><span class="amount"><strong>${money(350000)}</strong></span></div><span class="row-bottom">Balance confirmed 31 Aug 2026</span></button></div>`
    : !all.length
      ? '<div class="empty"><h3>Bring your portfolio together.</h3><p>Add one holding, enter several, or import your existing records.</p><button class="primary" data-action="add">Set up your portfolio</button></div>'
      : visible.length
        ? `<div class="list">${visible.map((r) => holding(r, total, pending)).join("")}</div>`
        : '<div class="empty"><h3>No matching holdings</h3><p>Try a different search or filter.</p><button class="secondary" data-action="clear">Clear search and filters</button></div>';
  $("scope").textContent =
    all.length && market
      ? "Allocation across market holdings; excludes cash and PPF. Returns are since investment, not today."
      : "";
  $("mask").innerHTML = icon(state.masked ? "hidden" : "eye");
  $("mask").setAttribute(
    "aria-label",
    state.masked ? "Show values" : "Hide values",
  );
  document
    .querySelector(".phone")
    .classList.toggle("minimal", $("minimal").checked);
}
function position(dialog, short = false) {
  const rect = document.querySelector(".phone").getBoundingClientRect();
  const height = Math.min(short ? 640 : rect.height, window.innerHeight - 24);
  dialog.style.left = `${rect.left}px`;
  dialog.style.top = `${Math.max(12, Math.min(rect.top + (short ? rect.height - height : 0), window.innerHeight - height - 12))}px`;
  dialog.style.width = `${rect.width}px`;
  dialog.style.height = `${height}px`;
  dialog.style.setProperty("--scale", $("large").checked ? "1.3" : "1");
  dialog.classList.toggle("minimal", $("minimal").checked);
}
function openSheet(title, content) {
  $("sheet-title").textContent = title;
  $("sheet-content").innerHTML = content;
  position($("sheet"), true);
  if (!$("sheet").open) $("sheet").showModal();
}
function action(title, note = "") {
  return `<button class="action-row" data-destination="${title}"><span>${title}${note ? `<small>${note}</small>` : ""}</span>${icon("forward")}</button>`;
}
function detail(id) {
  state.selected = id;
  const { all, total, pending } = snapshot(),
    row = all.find((r) => r.id === id);
  if (!row) return;
  const gain = row.value === null ? null : row.value - row.invested;
  $("detail-title").textContent = "Holding details";
  $("detail-mask").innerHTML = icon(state.masked ? "hidden" : "eye");
  $("detail-mask").setAttribute(
    "aria-label",
    state.masked ? "Show values" : "Hide values",
  );
  $("detail-content").innerHTML =
    `<div class="detail-identity"><span class="asset-icon ${row.group}">${icon(row.group)}</span><div><h3>${row.name}</h3><p>${row.symbol} · ${row.type} · INR</p></div></div><section class="valuation"><p>Current value</p><strong class="hero">${row.value === null ? "Valuation pending" : money(row.value, false)}</strong><div class="performance ${gain === null ? "pending" : gain >= 0 ? "up" : "down"}">${gain === null ? "Add a price to calculate return" : `${state.masked ? "Hidden" : `${gain >= 0 ? "+" : "−"}${money(Math.abs(gain), false)}`}<span> / </span>${percent((gain / row.invested) * 100)} <span>since investment</span>`}</div><div class="metric-line"><span>Invested</span><strong>${money(row.invested, false)}</strong></div></section><h3 class="section-title">Your position</h3><dl class="facts"><div><dt>Quantity</dt><dd>${row.units}</dd></div><div><dt>Average cost / unit</dt><dd>${unitMoney(row.invested / row.units)}</dd></div><div><dt>Current price / unit</dt><dd>${row.value === null ? "Unavailable" : unitMoney(row.value / row.units)}</dd></div><div><dt>Allocation (excluding cash and PPF)</dt><dd>${weight(row, total, pending)}</dd></div><div><dt>Sector / type</dt><dd>${row.sector}</dd></div><div><dt>First purchase</dt><dd>${row.date}</dd></div></dl><p class="detail-note">${row.value === null ? "Price missing. Your invested value is preserved." : `${row.source === "Manual" ? "Price entered manually" : `${row.source} price`} · 08 Sep 2026, 10:30 AM.`} ${row.group === "crypto" ? "Crypto prices in this example are quoted directly in INR." : ""}</p><div class="manage">${row.value === null ? action("Enter a price", "Manual fallback remains available") : ""}${action("View records", "Opening position and corrections")}${action("Sell / redeem", "Record a disposal and its cash proceeds")}</div>`;
  position($("detail"));
  if (!$("detail").open) {
    $("detail").showModal();
    $("detail-content").scrollTop = 0;
  }
}
function unitMoney(value) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function insights() {
  const { all, total, pending } = snapshot();
  if (pending)
    return openSheet(
      "Portfolio insights",
      "<p>Current prices are incomplete. Concentration and asset shares will be available when every holding is valued.</p>",
    );
  const sorted = [...all].sort((a, b) => b.value - a.value);
  const best = [...all]
    .filter((r) => r.value > r.invested && r.id !== sorted[0]?.id)
    .sort(
      (a, b) =>
        (b.value - b.invested) / b.invested -
        (a.value - a.invested) / a.invested,
    )[0];
  openSheet(
    "Portfolio insights",
    `<p>Market holdings only. Cash and PPF are excluded.</p><div class="insight-item"><span>Largest position</span><strong>${sorted[0]?.name ?? "No holdings"}</strong><p>${total ? `${((sorted[0].value / total) * 100).toFixed(1)}% of market holdings` : ""}</p></div>${best ? `<div class="insight-item"><span>Best return · another holding</span><strong>${best.name}</strong><p>${percent(((best.value - best.invested) / best.invested) * 100)} since investment</p></div>` : ""}<div class="insight-item"><span>Top three concentration</span><strong>${total ? ((sorted.slice(0, 3).reduce((s, r) => s + r.value, 0) / total) * 100).toFixed(1) : 0}%</strong></div><h3 class="section-title">Asset mix</h3>${Object.entries(
      labels,
    )
      .map(
        ([key, label]) =>
          `<div class="mix-row"><span>${icon(key)} ${label}</span><strong>${total ? ((all.filter((r) => r.group === key).reduce((s, r) => s + r.value, 0) / total) * 100).toFixed(1) : 0}%</strong></div>`,
      )
      .join("")}`,
  );
}
function add() {
  openSheet(
    "Add to your portfolio",
    action("Add one holding") +
      action("Add multiple holdings", "Rapid entry for an existing portfolio") +
      action("Import holdings CSV") +
      action("Import transactions") +
      action("Add PPF account"),
  );
}
function toggleMask() {
  state.masked = !state.masked;
  render();
  if ($("detail").open) detail(state.selected);
}
$("add").innerHTML = icon("add");
$("more").innerHTML = icon("more");
$("search-icon").innerHTML = icon("search");
$("add").onclick = add;
$("insights").onclick = insights;
$("mask").onclick = toggleMask;
$("detail-mask").onclick = toggleMask;
$("more").onclick = () =>
  openSheet(
    "Holdings options",
    action("Valuation details") +
      action("Manage assets") +
      action("Transactions") +
      action("Add PPF account"),
  );
$("back").onclick = () => $("detail").close();
$("close-sheet").onclick = () => $("sheet").close();
$("search").oninput = render;
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.holding) detail(button.dataset.holding);
  if (button.dataset.filter) {
    state.filter = button.dataset.filter;
    render();
    document
      .querySelector(`[data-filter="${state.filter}"]`)
      .focus({ preventScroll: true });
  }
  if (button.dataset.tab) {
    state.tab = button.dataset.tab;
    render();
    document.querySelector(`[data-tab="${state.tab}"]`)?.focus();
  }
  if (button.dataset.destination)
    openSheet(
      button.dataset.destination,
      `<p>This action opens the existing ${button.dataset.destination.toLowerCase()} flow in the app.</p><p>It is a navigation boundary in this Holdings design study. No financial data is saved or changed.</p>`,
    );
  if (button.dataset.action === "add") add();
  if (button.dataset.action === "clear") {
    $("search").value = "";
    state.filter = "all";
    render();
    $("search").focus();
  }
  if (button.dataset.action === "prices")
    openSheet(
      "Valuation details",
      "<p>One holding is missing a price. Use its detail view to enter a manual price, or refresh prices in the app. This preview does not contact providers.</p>",
    );
  if (button.dataset.action === "ppf")
    openSheet(
      "My PPF",
      `<div class="insight-item"><span>Confirmed balance · 31 Aug 2026</span><strong>${money(350000, false)}</strong></div><p>SBI · PPF account. This is a confirmed account balance, not a market valuation.</p>${action("View PPF account", "Contribution history, annual limits and maturity")}`,
    );
});
for (const id of ["scenario", "with-ppf", "minimal", "large", "narrow"])
  $(id).onchange = () => {
    for (const dialog of document.querySelectorAll("dialog[open]"))
      dialog.close();
    state.filter = "all";
    state.tab = "market";
    $("search").value = "";
    document
      .querySelector(".phone")
      .classList.toggle("large", $("large").checked);
    document
      .querySelector(".phone")
      .classList.toggle("narrow", $("narrow").checked);
    render();
  };
window.addEventListener("resize", () => {
  for (const dialog of document.querySelectorAll("dialog[open]"))
    position(dialog, dialog.id === "sheet");
});
render();
