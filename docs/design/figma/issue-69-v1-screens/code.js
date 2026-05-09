// CogVest Figma Plugin
// Generates the approved Issue 86 premium V1 screen set.
//
// Main tabs: Dashboard, Holdings, Progress, Cash, Settings
// Secondary flow: Add Holding
// State coverage: V1 States
//
// This script intentionally creates a fresh versioned page instead of removing
// existing nodes. That avoids Figma "Removing this node is not allowed" errors
// seen during reruns and keeps previous revisions available for comparison.

let stage = "initialise";

async function main() {
  stage = "load fonts";
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  const C = {
    bg: "#000000",
    canvas: "#0A0A0B",
    surface: "#1C1C1E",
    elevated: "#2C2C2E",
    field: "#111113",
    text: "#F5F5F7",
    secondary: "#98989D",
    muted: "#636366",
    separator: "#38383A",
    green: "#34C759",
    brandGreen: "#2E7D52",
    blue: "#0A84FF",
    cashBlue: "#64D2FF",
    amber: "#FF9F0A",
    negative: "#FF453A",
    equityLine: "#7C83FF",
    debtLine: "#62C99A",
    investedLine: "#636366",
  };

  const W = 390;
  const H = 844;
  const PAD = 20;
  const NAV_H = 78;
  const CONTENT_W = W - PAD * 2;
  const PAGE_NAME = "Issue 86 - Premium V1 Screens";

  stage = "create page";
  const page = figma.createPage();
  page.name = uniquePageName(PAGE_NAME);
  await figma.setCurrentPageAsync(page);

  function uniquePageName(base) {
    const existing = new Set(figma.root.children.map((p) => p.name));
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base} v${i}`)) i += 1;
    return `${base} v${i}`;
  }

  function rgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
    };
  }

  function paint(hex, opacity = 1) {
    return { type: "SOLID", color: rgb(hex), opacity };
  }

  function rect(parent, x, y, w, h, fill = C.surface, radius = 0, stroke = null, strokeOpacity = 0.28) {
    const node = figma.createRectangle();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(w, h);
    node.cornerRadius = radius;
    node.fills = [paint(fill)];
    node.strokes = stroke ? [paint(stroke, strokeOpacity)] : [];
    node.strokeWeight = stroke ? 1 : 0;
    return node;
  }

  function line(parent, x, y, w, opacity = 0.42) {
    const node = figma.createLine();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(w, 0);
    node.strokes = [paint(C.separator, opacity)];
    node.strokeWeight = 1;
    return node;
  }

  function text(parent, value, x, y, size, color = C.text, style = "Regular", width = 180, align = "LEFT") {
    const node = figma.createText();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(width, 1);
    node.characters = value;
    node.fontName = { family: "Inter", style };
    node.fontSize = size;
    node.fills = [paint(color)];
    node.textAlignHorizontal = align;
    node.textAutoResize = "HEIGHT";
    return node;
  }

  function svg(parent, source, x, y, w, h) {
    // Figma creates SVG nodes on the current page. Move only after geometry is set.
    const node = figma.createNodeFromSvg(source);
    node.x = x;
    node.y = y;
    node.resize(w, h);
    parent.appendChild(node);
    return node;
  }

  function iconSvg(name, color = C.secondary) {
    const s = color;
    const icons = {
      home: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3z"/></svg>`,
      holdings: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9h9A9 9 0 1 1 12 3Z"/><path d="M14 3.3A9 9 0 0 1 20.7 10H14z"/></svg>`,
      progress: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></svg>`,
      cash: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v12H4z"/><path d="M4 7l11-3 2 3"/><path d="M15 13h5"/></svg>`,
      settings: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`,
      eye: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`,
      refresh: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10.2-4.2L4 11m16 2-3.8 3.2A6 6 0 0 1 6 12"/></svg>`,
      search: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>`,
      up: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15l5-5 4 4 7-8"/><path d="M14 6h6v6"/></svg>`,
      shield: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/></svg>`,
      coin: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.2 9h4.1a2 2 0 0 1 0 4H9.2M9.2 13h4.8a2 2 0 0 1 0 4H9.2"/></svg>`,
      plus: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
      help: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 9a2.8 2.8 0 1 1 4.9 1.8c-.9.8-1.9 1.3-1.9 3.2"/><path d="M12 18h.01"/></svg>`,
      info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,
    };
    return icons[name] || icons.up;
  }

  function icon(parent, name, x, y, color = C.secondary, size = 20) {
    return svg(parent, iconSvg(name, color), x, y, size, size);
  }

  const assetMeta = {
    equity: { color: C.green, icon: "up" },
    debt: { color: C.blue, icon: "shield" },
    crypto: { color: C.amber, icon: "coin" },
    cash: { color: C.cashBlue, icon: "cash" },
    neutral: { color: C.secondary, icon: "up" },
  };

  function glyph(parent, x, y, type = "neutral", size = 34) {
    const meta = assetMeta[type] || assetMeta.neutral;
    const g = figma.createFrame();
    parent.appendChild(g);
    g.x = x;
    g.y = y;
    g.resize(size, size);
    g.cornerRadius = size / 2;
    g.fills = [paint(C.elevated)];
    g.strokes = [];
    icon(g, meta.icon, (size - 17) / 2, (size - 17) / 2, meta.color, 17);
    return g;
  }

  function action(parent, x, y, iconName, label = null) {
    const r = rect(parent, x, y, 36, 36, C.surface, 13);
    icon(parent, iconName, x + 8, y + 8, C.text, 20);
    if (label) text(parent, label, x - 12, y + 40, 10, C.secondary, "Regular", 60, "CENTER");
    return r;
  }

  function screen(name, x, y = 150) {
    const frame = figma.createFrame();
    page.appendChild(frame);
    frame.name = name;
    frame.x = x;
    frame.y = y;
    frame.resize(W, H);
    frame.cornerRadius = 34;
    frame.fills = [paint(C.bg)];
    frame.clipsContent = true;
    text(frame, "10:42", 22, 18, 12, C.text, "Semi Bold", 60);
    text(frame, "100%", 330, 18, 12, C.text, "Semi Bold", 42, "RIGHT");
    return frame;
  }

  function header(frame, title, subtitle, actions = []) {
    text(frame, title, PAD, 76, 28, C.text, "Bold", 230);
    text(frame, subtitle, PAD, 111, 13, C.secondary, "Regular", 240);
    actions.forEach((a, i) => action(frame, 310 - i * 44, 76, a));
  }

  function nav(frame, selected) {
    rect(frame, 0, H - NAV_H, W, NAV_H, C.surface, 0, C.separator, 0.35);
    const items = [
      ["Dashboard", "home"],
      ["Holdings", "holdings"],
      ["Progress", "progress"],
      ["Cash", "cash"],
      ["Settings", "settings"],
    ];
    items.forEach(([label, iconName], i) => {
      const active = label === selected;
      const cx = 38 + i * 78;
      if (active) rect(frame, cx - 19, H - NAV_H, 38, 3, C.green, 999);
      icon(frame, iconName, cx - 10, H - 52, active ? C.green : C.secondary, 21);
      text(frame, label, cx - 34, H - 24, 10, active ? C.green : C.secondary, "Regular", 68, "CENTER");
    });
  }

  function card(parent, x, y, w, h, radius = 24) {
    return rect(parent, x, y, w, h, C.surface, radius);
  }

  function sectionLabel(parent, value, x, y) {
    text(parent, value.toUpperCase(), x, y, 10.5, C.muted, "Bold", 160);
  }

  function sectionTitle(parent, title, x, y, action = null) {
    text(parent, title, x, y, 17, C.text, "Bold", 200);
    if (action) text(parent, action, x + 245, y + 2, 12, C.green, "Semi Bold", 86, "RIGHT");
  }

  function metric(parent, label, value, x, y, w = 90, color = C.text) {
    text(parent, label, x, y, 11, C.secondary, "Regular", w);
    text(parent, value, x, y + 19, 14, color, "Semi Bold", w);
  }

  function metricStrip(parent, x, y, items) {
    card(parent, x, y, CONTENT_W, 88, 20);
    const colW = CONTENT_W / items.length;
    items.forEach((item, i) => {
      metric(parent, item.label, item.value, x + 14 + i * colW, y + 22, colW - 18, item.color || C.text);
      if (i > 0) line(parent, x + i * colW, y + 18, 52, 0.32).rotation = 90;
    });
  }

  function chip(parent, label, x, y, active = false, w = null) {
    const width = w || label.length * 7 + 24;
    rect(parent, x, y, width, 30, active ? C.brandGreen : C.surface, 999, active ? null : C.separator, active ? 0 : 0.55);
    text(parent, label, x, y + 8, 12, active ? C.text : C.secondary, "Semi Bold", width, "CENTER");
    return width;
  }

  function row(parent, x, y, w, type, title, meta, value, sub = null, valueColor = C.text) {
    rect(parent, x, y, w, 72, C.surface, 18);
    glyph(parent, x + 12, y + 19, type, 34);
    text(parent, title, x + 58, y + 15, 14, C.text, "Semi Bold", 150);
    text(parent, meta, x + 58, y + 36, 10.5, C.secondary, "Regular", 180);
    text(parent, value, x + w - 112, y + 15, 14, valueColor, "Bold", 96, "RIGHT");
    if (sub) text(parent, sub, x + w - 112, y + 38, 10.5, sub.startsWith("-") ? C.negative : C.green, "Semi Bold", 96, "RIGHT");
  }

  function groupedRows(parent, x, y, rows) {
    const h = rows.length * 58;
    card(parent, x, y, CONTENT_W, h, 18);
    rows.forEach((r, i) => {
      const yy = y + i * 58;
      if (i > 0) line(parent, x + 14, yy, CONTENT_W - 28, 0.3);
      glyph(parent, x + 12, yy + 12, r.type, 34);
      text(parent, r.title, x + 58, yy + 12, 13.5, C.text, "Semi Bold", 160);
      text(parent, r.meta, x + 58, yy + 33, 10.5, C.secondary, "Regular", 180);
      text(parent, r.value, x + CONTENT_W - 96, yy + 18, 13.5, r.color || C.text, "Bold", 82, "RIGHT");
    });
    return h;
  }

  function formField(parent, x, y, w, label, value) {
    rect(parent, x, y, w, 58, C.field, 16);
    text(parent, label, x + 12, y + 10, 10.5, C.secondary, "Semi Bold", w - 24);
    text(parent, value, x + 12, y + 31, 13.5, C.text, "Semi Bold", w - 24);
  }

  function valueGraph(parent, x, y) {
    const graph = `
      <svg width="320" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="portfolioFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${C.text}"/><stop offset="100%" stop-color="${C.text}" stop-opacity="0"/></linearGradient></defs>
        <path d="M32 24H306M32 58H306M32 92H306M32 126H306" stroke="${C.separator}" stroke-opacity="0.42"/>
        <path d="M34 104 C60 96 78 108 100 82 C122 58 144 72 166 64 C190 56 208 88 230 38 C252 10 274 64 306 26 L306 132 L34 132Z" fill="url(#portfolioFade)" opacity="0.26"/>
        <path d="M34 104 C60 96 78 108 100 82 C122 58 144 72 166 64 C190 56 208 88 230 38 C252 10 274 64 306 26" stroke="${C.text}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M34 118 C72 116 92 112 120 108 C152 104 180 100 210 94 C246 88 276 82 306 76" stroke="${C.investedLine}" stroke-width="3" stroke-dasharray="6 7" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="100" cy="82" r="3.5" fill="${C.surface}" stroke="${C.text}" stroke-width="2"/>
        <circle cx="230" cy="38" r="3.5" fill="${C.surface}" stroke="${C.text}" stroke-width="2"/>
        <circle cx="306" cy="26" r="3.5" fill="${C.surface}" stroke="${C.text}" stroke-width="2"/>
        <circle cx="306" cy="76" r="3" fill="${C.surface}" stroke="${C.investedLine}" stroke-width="2"/>
        <text x="4" y="28" fill="${C.muted}" font-size="9">20L</text><text x="5" y="95" fill="${C.muted}" font-size="9">10L</text><text x="13" y="130" fill="${C.muted}" font-size="9">0</text>
        <text x="34" y="152" fill="${C.muted}" font-size="9">Dec</text><text x="138" y="152" fill="${C.muted}" font-size="9">Mar</text><text x="282" y="152" fill="${C.muted}" font-size="9">May</text>
      </svg>`;
    return svg(parent, graph, x, y, 320, 160);
  }

  function assetGraph(parent, x, y) {
    const graph = `
      <svg width="320" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 24H306M32 58H306M32 92H306M32 126H306" stroke="${C.separator}" stroke-opacity="0.42"/>
        <path d="M34 98 C58 90 78 106 100 78 C124 52 144 68 166 60 C190 52 210 84 230 38 C252 18 276 58 306 36" stroke="${C.equityLine}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M34 126 C60 122 78 124 100 116 C128 108 150 112 176 102 C206 92 236 98 262 86 C282 78 294 84 306 76" stroke="${C.debtLine}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M34 138 C58 132 78 144 102 122 C124 102 140 134 164 112 C188 86 206 126 230 108 C258 78 282 118 306 96" stroke="${C.amber}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="306" cy="36" r="3.5" fill="${C.surface}" stroke="${C.equityLine}" stroke-width="2"/>
        <circle cx="306" cy="76" r="3.5" fill="${C.surface}" stroke="${C.debtLine}" stroke-width="2"/>
        <circle cx="306" cy="96" r="3.5" fill="${C.surface}" stroke="${C.amber}" stroke-width="2"/>
        <text x="250" y="32" fill="${C.equityLine}" font-size="10" font-weight="700">₹12.45L</text>
        <text x="254" y="72" fill="${C.debtLine}" font-size="10" font-weight="700">₹3.22L</text>
        <text x="254" y="92" fill="${C.amber}" font-size="10" font-weight="700">₹1.20L</text>
        <text x="4" y="28" fill="${C.muted}" font-size="9">15L</text><text x="5" y="95" fill="${C.muted}" font-size="9">7.5L</text><text x="13" y="130" fill="${C.muted}" font-size="9">0</text>
        <text x="34" y="152" fill="${C.muted}" font-size="9">Dec</text><text x="138" y="152" fill="${C.muted}" font-size="9">Mar</text><text x="282" y="152" fill="${C.muted}" font-size="9">May</text>
      </svg>`;
    return svg(parent, graph, x, y, 320, 160);
  }

  function legend(parent, x, y, items) {
    let offset = 0;
    items.forEach((item) => {
      const dot = figma.createEllipse();
      parent.appendChild(dot);
      dot.x = x + offset;
      dot.y = y + 3;
      dot.resize(7, 7);
      dot.fills = [paint(item.color)];
      text(parent, item.label, x + offset + 12, y, 11, item.color, "Regular", 70);
      offset += item.label.length * 6 + 38;
    });
  }

  function pageTitle() {
    text(page, "CogVest Issue 86 Premium V1 Screens", 24, 24, 30, C.text, "Bold", 900);
    text(page, "Generated from docs/design/issue-86-premium-preview. Main tabs: Dashboard, Holdings, Progress, Cash, Settings. Add Holding is a secondary flow.", 24, 64, 13, C.secondary, "Regular", 980);
  }

  stage = "draw canvas";
  rect(page, -80, -80, 3200, 1120, C.canvas, 0);
  stage = "draw title";
  pageTitle();

  // Dashboard
  stage = "draw dashboard";
  const dashboard = screen("Dashboard", 24);
  header(dashboard, "Dashboard", "Local portfolio · 9 May 2026", ["refresh", "eye"]);
  card(dashboard, PAD, 144, CONTENT_W, 134);
  text(dashboard, "Portfolio value", 38, 166, 12, C.secondary, "Semi Bold", 120);
  text(dashboard, "₹18.42L", 38, 190, 42, C.text, "Bold", 180);
  chip(dashboard, "+₹3.10L · +20.2%", 38, 238, true, 124);
  metric(dashboard, "Invested", "₹15.32L", 188, 178, 72);
  metric(dashboard, "P&L", "+₹3.10L", 268, 178, 72, C.green);
  metric(dashboard, "Quotes", "2m ago", 268, 232, 72);
  sectionTitle(dashboard, "Allocation", PAD, 302, "View details");
  groupedRows(dashboard, PAD, 330, [
    { type: "equity", title: "Equity", meta: "68% · ₹12.71L", value: "68%" },
    { type: "debt", title: "Debt", meta: "15% · ₹2.76L", value: "15%" },
    { type: "crypto", title: "Crypto", meta: "7% · ₹1.29L", value: "7%" },
    { type: "cash", title: "Cash", meta: "10% · ₹1.65L", value: "10%" },
  ]);
  card(dashboard, PAD, 584, CONTENT_W, 86);
  sectionTitle(dashboard, "This month", 38, 606, "May 2026");
  metric(dashboard, "Invested", "₹1.20L", 38, 632, 80);
  metric(dashboard, "Savings", "42%", 152, 632, 70);
  metric(dashboard, "Cash", "+₹70K", 262, 632, 72, C.green);
  card(dashboard, PAD, 688, CONTENT_W, 74);
  glyph(dashboard, 36, 708, "neutral");
  text(dashboard, "Conviction data is still building", 84, 706, 14, C.text, "Semi Bold", 230);
  text(dashboard, "Optional conviction improves context over time.", 84, 730, 11, C.secondary, "Regular", 230);
  nav(dashboard, "Dashboard");

  // Holdings
  stage = "draw holdings";
  const holdings = screen("Holdings", 448);
  header(holdings, "Holdings", "24 positions · local data", ["eye", "search"]);
  metricStrip(holdings, PAD, 144, [
    { label: "Current", value: "₹12.48L" },
    { label: "Invested", value: "₹11.05L" },
    { label: "P&L", value: "+₹1.42L", color: C.green },
    { label: "Drift", value: "3.2%", color: C.amber },
  ]);
  text(holdings, "Quotes updated 2m ago · 1 manual price", PAD, 246, 12, C.secondary, "Regular", 240);
  let chipX = PAD;
  ["All", "Equity", "Debt", "Crypto", "Cash"].forEach((c, i) => {
    chipX += chip(holdings, c, chipX, 272, i === 0) + 8;
  });
  [
    ["equity", "HDFC Bank", "Equity · Financial Services", "₹1.83L", "+₹18.6K"],
    ["equity", "Nifty 50 ETF", "Equity · Index Fund", "₹50.7K", "+₹6.5K"],
    ["debt", "Sovereign Gold Bond", "Debt · Government Bond · Manual", "₹57.1K", "+₹4.1K"],
    ["crypto", "Bitcoin", "Crypto · Manual price", "₹13.90L", "+₹2.85L"],
    ["debt", "Liquid Fund", "Debt · Overnight", "₹2.50L", "+₹250"],
  ].forEach((r, i) => row(holdings, PAD, 326 + i * 82, CONTENT_W, r[0], r[1], r[2], r[3], r[4]));
  nav(holdings, "Holdings");

  // Add Holding
  stage = "draw add holding";
  const add = screen("Add Holding", 872);
  header(add, "Add Holding", "Opening position · local only", ["help"]);
  ["Asset", "Class", "Position", "Review"].forEach((s, i) => {
    const cx = 55 + i * 94;
    glyph(add, cx - 14, 144, i === 0 ? "equity" : "neutral", 28);
    text(add, s, cx - 34, 180, 10, i === 0 ? C.green : C.secondary, i === 0 ? "Bold" : "Regular", 68, "CENTER");
    if (i < 3) line(add, cx + 20, 158, 50, 0.32);
  });
  card(add, PAD, 216, CONTENT_W, 122);
  sectionTitle(add, "Find asset", 38, 238);
  rect(add, 38, 268, 314, 44, C.field, 16);
  icon(add, "search", 52, 280, C.secondary, 18);
  text(add, "Search name or symbol", 80, 280, 13, C.secondary, "Regular", 190);
  text(add, "Only search text is sent to quote providers.", 38, 318, 10.5, C.muted, "Regular", 260);
  row(add, PAD, 352, CONTENT_W, "equity", "HDFC Bank", "HDFCBANK.NS · NSE · INR · Equity", "₹1,678.25", "Live", C.text);
  card(add, PAD, 438, CONTENT_W, 96);
  sectionTitle(add, "Position details", 38, 458);
  formField(add, 38, 490, 148, "Quantity", "25");
  formField(add, 202, 490, 150, "Average cost", "₹1,450.00");
  formField(add, 38, 560, 148, "Current price", "₹1,678.25");
  formField(add, 202, 560, 150, "Price source", "Live");
  card(add, PAD, 632, CONTENT_W, 92);
  sectionTitle(add, "Derived preview", 38, 652);
  metric(add, "Invested", "₹36,250", 38, 684, 82);
  metric(add, "Current", "₹41,956", 134, 684, 82);
  metric(add, "P&L", "+₹5,706", 230, 684, 82, C.green);
  rect(add, PAD, 740, CONTENT_W, 48, C.brandGreen, 18);
  text(add, "Continue", PAD, 756, 13, C.text, "Bold", CONTENT_W, "CENTER");
  nav(add, "Holdings");

  // Progress
  stage = "draw progress";
  const progress = screen("Monthly Progress", 1296);
  header(progress, "Monthly Progress", "May 2026 snapshot", ["eye"]);
  chip(progress, "Apr 2026", PAD, 144, false, 86);
  chip(progress, "May 2026", PAD + 96, 144, true, 94);
  chip(progress, "Jun 2026", PAD + 200, 144, false, 88);
  metricStrip(progress, PAD, 190, [
    { label: "Portfolio", value: "₹19.87L" },
    { label: "Invested", value: "₹1.40L" },
    { label: "Cash", value: "₹3.25L" },
    { label: "Savings", value: "34%" },
  ]);
  card(progress, PAD, 298, CONTENT_W, 238);
  sectionTitle(progress, "Portfolio vs invested", 38, 318);
  valueGraph(progress, 36, 344);
  legend(progress, 58, 500, [
    { label: "Total value", color: C.text },
    { label: "Invested", color: C.investedLine },
  ]);
  card(progress, PAD, 552, CONTENT_W, 238);
  sectionTitle(progress, "Assets vs months", 38, 572);
  assetGraph(progress, 36, 598);
  legend(progress, 58, 754, [
    { label: "Equity", color: C.equityLine },
    { label: "Debt", color: C.debtLine },
    { label: "Crypto", color: C.amber },
  ]);
  nav(progress, "Progress");

  // Cash
  stage = "draw cash";
  const cash = screen("Cash Ledger", 1720);
  header(cash, "Cash Ledger", "Manual ledger · local only", ["eye", "plus"]);
  card(cash, PAD, 144, CONTENT_W, 134);
  text(cash, "Cash balance", 38, 166, 12, C.secondary, "Semi Bold", 120);
  text(cash, "₹1,65,600", 38, 194, 34, C.text, "Bold", 180);
  chip(cash, "Available · ₹1.20L", 38, 238, true, 132);
  metric(cash, "Added", "₹70K", 206, 178, 56);
  metric(cash, "Invested", "₹45K", 282, 178, 64);
  metric(cash, "Savings", "32.8%", 282, 232, 64);
  card(cash, PAD, 300, CONTENT_W, 188);
  sectionTitle(cash, "Add cash entry", 38, 322);
  chip(cash, "Deposit", 38, 354, true, 76);
  chip(cash, "Withdraw", 122, 354, false, 86);
  chip(cash, "Transfer", 216, 354, false, 78);
  formField(cash, 38, 400, 148, "Amount (INR)", "₹0");
  formField(cash, 202, 400, 150, "Date", "09 May 2026");
  formField(cash, 38, 468, 314, "Note", "Salary, SIP transfer, emergency fund");
  sectionTitle(cash, "Recent cash ledger", PAD, 524, "View all");
  groupedRows(cash, PAD, 552, [
    { type: "cash", title: "Salary added", meta: "Cash deposit", value: "+₹70K", color: C.green },
    { type: "equity", title: "SIP transfer", meta: "Index Fund", value: "-₹15K" },
    { type: "cash", title: "Emergency fund top-up", meta: "Cash reserve", value: "+₹10K", color: C.green },
  ]);
  nav(cash, "Cash");

  // Settings
  stage = "draw settings";
  const settings = screen("Settings", 2144);
  header(settings, "Settings", "Local-first controls", ["info"]);
  sectionLabel(settings, "Privacy", PAD, 144);
  groupedRows(settings, PAD, 166, [
    { type: "debt", title: "Privacy", meta: "Local storage active · No account · No cloud", value: "On", color: C.green },
    { type: "neutral", title: "Value masking", meta: "Hide sensitive values on screen", value: "Ready" },
  ]);
  sectionLabel(settings, "Quotes", PAD, 300);
  groupedRows(settings, PAD, 322, [
    { type: "cash", title: "Quotes", meta: "Every 15 min · Manual fallback on", value: "OK", color: C.green },
  ]);
  sectionLabel(settings, "Currency", PAD, 396);
  card(settings, PAD, 418, CONTENT_W, 106);
  sectionTitle(settings, "Currency", 38, 438);
  metric(settings, "Base currency", "INR", 38, 474, 90);
  metric(settings, "Foreign summary", "On", 150, 474, 90);
  metric(settings, "Fallback", "On", 264, 474, 74);
  sectionLabel(settings, "Display", PAD, 546);
  card(settings, PAD, 568, CONTENT_W, 122);
  sectionTitle(settings, "Display and app info", 38, 588);
  groupedRows(settings, 38, 622, [
    { type: "neutral", title: "Density", meta: "Standard V1", value: "" },
    { type: "neutral", title: "Minimal Mode", meta: "V2 locked", value: "" },
  ]);
  sectionLabel(settings, "Data", PAD, 710);
  card(settings, PAD, 732, CONTENT_W, 48);
  text(settings, "Clear local data", 38, 748, 13, C.negative, "Semi Bold", 140);
  text(settings, "Destructive", 255, 748, 12, C.negative, "Regular", 80, "RIGHT");
  nav(settings, "Settings");

  // V1 States
  stage = "draw states";
  const states = screen("V1 States", 2568);
  header(states, "V1 States", "Implementation coverage", []);
  card(states, PAD, 144, CONTENT_W, 128);
  glyph(states, 38, 166, "equity", 56);
  sectionTitle(states, "Empty portfolio", 112, 166);
  text(states, "No holdings yet. Start with one opening position; no spreadsheet required.", 112, 196, 12, C.secondary, "Regular", 220);
  rect(states, 112, 230, 150, 36, C.brandGreen, 999);
  text(states, "Add first holding", 112, 240, 12, C.text, "Bold", 150, "CENTER");
  card(states, PAD, 298, CONTENT_W, 120);
  sectionTitle(states, "Quote lookup loading", 38, 320);
  rect(states, 38, 358, 260, 12, C.elevated, 999);
  rect(states, 38, 382, 170, 12, C.elevated, 999);
  text(states, "Skeletons match the result row shape. Avoid spinners for ordinary lookup latency.", 38, 400, 11, C.secondary, "Regular", 280);
  card(states, PAD, 444, CONTENT_W, 112);
  sectionTitle(states, "Provider unavailable", 38, 466);
  text(states, "Could not fetch a live quote. Continue manually and CogVest will mark the price source.", 38, 496, 12, C.secondary, "Regular", 280);
  text(states, "Enter price manually", 38, 530, 12, C.green, "Semi Bold", 160);
  card(states, PAD, 582, CONTENT_W, 92);
  sectionTitle(states, "No monthly snapshots", 38, 604);
  text(states, "Monthly Progress becomes useful after the first saved snapshot. Keep the chart area calm.", 38, 634, 12, C.secondary, "Regular", 280);

  stage = "zoom to screens";
  figma.viewport.scrollAndZoomIntoView([dashboard, holdings, add, progress, cash, settings, states]);
  figma.closePlugin("CogVest Issue 86 premium screens generated.");
}

main().catch((err) => {
  figma.closePlugin(`CogVest screen generation failed at ${stage}: ${err.message}`);
});
