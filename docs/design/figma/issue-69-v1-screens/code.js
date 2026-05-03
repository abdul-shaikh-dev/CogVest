// CogVest Issue #69 V1 editable Figma screens.
// Run from Figma Desktop as a development plugin.

async function main() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  const C = {
    bg: "#1C1B1F",
    surface: "#242329",
    elevated: "#2B2930",
    text: "#E6E1E5",
    secondary: "#CAC4D0",
    muted: "#938F99",
    green: "#2E7D52",
    positive: "#22C55E",
    warning: "#F59E0B",
    negative: "#EF4444",
    border: "#3A3740",
    blue: "#3D5FA8",
    cashBlue: "#2E5F9E",
    amber: "#B7791F"
  };

  const PAGE_NAME = "Issue 69 - V1 UI Concepts";
  const existing = figma.root.children.find((page) => page.name === PAGE_NAME);
  if (existing) existing.remove();

  const page = figma.createPage();
  page.name = PAGE_NAME;
  await figma.setCurrentPageAsync(page);

  function rgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255
    };
  }

  function paint(hex, opacity = 1) {
    return { type: "SOLID", color: rgb(hex), opacity };
  }

  function text(parent, value, x, y, size, color = C.text, style = "Regular", width = 160, align = "LEFT") {
    const node = figma.createText();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(width, Math.max(size + 10, 20));
    node.fontName = { family: "Inter", style };
    node.fontSize = size;
    node.fills = [paint(color)];
    node.textAlignHorizontal = align;
    node.textAutoResize = "HEIGHT";
    node.characters = value;
    return node;
  }

  function card(parent, x, y, width, height, radius = 14, fill = C.surface) {
    const node = figma.createRectangle();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(width, height);
    node.cornerRadius = radius;
    node.fills = [paint(fill)];
    node.strokes = [paint(C.border)];
    node.strokeWeight = 1;
    return node;
  }

  function line(parent, x, y, width, color = C.border, opacity = 0.65) {
    const node = figma.createLine();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(width, 0);
    node.strokes = [paint(color, opacity)];
    node.strokeWeight = 1;
    return node;
  }

  function iconSvg(name, color = C.secondary) {
    const s = color;
    const icons = {
      home: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z" stroke="${s}" stroke-width="2" stroke-linejoin="round"/></svg>`,
      pie: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v9h9A9 9 0 1 1 12 3Z" stroke="${s}" stroke-width="2"/><path d="M14 3.3A9 9 0 0 1 20.7 10H14V3.3Z" stroke="${s}" stroke-width="2"/></svg>`,
      plus: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="${s}" stroke-width="2.4" stroke-linecap="round"/></svg>`,
      wallet: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v12H4z" stroke="${s}" stroke-width="2" stroke-linejoin="round"/><path d="M4 7l11-3 2 3" stroke="${s}" stroke-width="2"/><path d="M15 13h5" stroke="${s}" stroke-width="2"/></svg>`,
      gear: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" stroke="${s}" stroke-width="2"/><path d="M4 13v-2l2.1-.6c.2-.6.4-1.1.7-1.6L5.8 6.7 7.2 5.3l2.1 1c.5-.3 1-.5 1.6-.7L11.5 3h2l.6 2.6c.6.2 1.1.4 1.6.7l2.1-1 1.4 1.4-1 2.1c.3.5.5 1 .7 1.6L21 11v2l-2.1.6c-.2.6-.4 1.1-.7 1.6l1 2.1-1.4 1.4-2.1-1c-.5.3-1 .5-1.6.7l-.6 2.6h-2l-.6-2.6c-.6-.2-1.1-.4-1.6-.7l-2.1 1-1.4-1.4 1-2.1c-.3-.5-.5-1-.7-1.6L4 13Z" stroke="${s}" stroke-width="2" stroke-linejoin="round"/></svg>`,
      trend: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16l5-5 4 4 7-8" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" stroke="${s}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      shield: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3 20 6v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V6l8-3Z" stroke="${s}" stroke-width="2" stroke-linejoin="round"/></svg>`,
      btc: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 4v16M13 4v16M7 7h6.2c2 0 3.3 1 3.3 2.6 0 1.1-.7 2-1.9 2.3 1.5.3 2.4 1.3 2.4 2.8 0 1.8-1.5 3.3-3.8 3.3H7M7 12h6" stroke="${s}" stroke-width="2" stroke-linecap="round"/></svg>`,
      eye: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="${s}" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="${s}" stroke-width="2"/></svg>`,
      refresh: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 7v5h-5M4 17v-5h5" stroke="${s}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 12a6 6 0 0 0-10.2-4.2L4 11m16 2-3.8 3.2A6 6 0 0 1 6 12" stroke="${s}" stroke-width="2" stroke-linecap="round"/></svg>`,
      search: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="${s}" stroke-width="2"/><path d="m16 16 5 5" stroke="${s}" stroke-width="2" stroke-linecap="round"/></svg>`
    };
    return icons[name] || icons.trend;
  }

  function svg(parent, name, x, y, size = 22, color = C.secondary) {
    const node = figma.createNodeFromSvg(iconSvg(name, color));
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(size, size);
    return node;
  }

  function iconCircle(parent, x, y, type, size = 36) {
    const config = {
      equity: [C.green, "trend"],
      debt: [C.blue, "shield"],
      crypto: [C.amber, "btc"],
      cash: [C.cashBlue, "wallet"],
      neutral: [C.elevated, "trend"]
    };
    const [fill, icon] = config[type] || config.neutral;
    const outer = figma.createEllipse();
    parent.appendChild(outer);
    outer.x = x;
    outer.y = y;
    outer.resize(size, size);
    outer.fills = [paint(fill, type === "neutral" ? 0.55 : 0.88)];
    outer.strokes = [paint(fill, 0.35)];
    outer.strokeWeight = 1;
    svg(parent, icon, x + 8, y + 8, size - 16, C.text);
    return outer;
  }

  function screen(name, x) {
    const frame = figma.createFrame();
    page.appendChild(frame);
    frame.name = name;
    frame.x = x;
    frame.y = 130;
    frame.resize(393, 852);
    frame.cornerRadius = 34;
    frame.clipsContent = true;
    frame.fills = [paint(C.bg)];
    text(frame, "10:42", 24, 22, 12, C.text, "Medium", 60);
    text(frame, "◢  ▰ 100%", 304, 22, 12, C.text, "Medium", 72, "RIGHT");
    return frame;
  }

  function top(frame, title, subtitle, actions = []) {
    const titleWidth = actions.length > 0 ? 220 : 285;
    text(frame, title, 24, 72, 23, C.text, "Semi Bold", titleWidth);
    text(frame, subtitle, 24, 104, 13, C.secondary, "Regular", 255);
    actions.forEach((action, i) => {
      const x = 286 + i * 46;
      card(frame, x, 68, 38, 38, 10);
      svg(frame, action, x + 9, 77, 20, C.text);
    });
  }

  function topBack(frame, title, subtitle, action = null) {
    svg(frame, "home", 24, 74, 20);
    text(frame, title, 70, 70, 22, C.text, "Semi Bold", 230);
    text(frame, subtitle, 70, 102, 13, C.secondary, "Regular", 240);
    if (action) {
      card(frame, 331, 68, 38, 38, 10);
      svg(frame, action, 340, 77, 20, C.text);
    }
  }

  function nav(frame, selected) {
    card(frame, 0, 778, 393, 74, 0, "#202026").strokes = [];
    const items = [
      ["Dashboard", "home", 48],
      ["Holdings", "pie", 122],
      ["Add", "plus", 196],
      ["Cash", "wallet", 270],
      ["Settings", "gear", 344]
    ];
    items.forEach(([label, icon, x]) => {
      const active = label === selected;
      if (label === "Add") {
        const circle = figma.createEllipse();
        frame.appendChild(circle);
        circle.x = 176;
        circle.y = 787;
        circle.resize(40, 40);
        circle.fills = [paint(C.green, 0.86)];
        svg(frame, "plus", 186, 797, 20, C.text);
      } else {
        svg(frame, icon, x - 12, 793, 24, active ? C.positive : C.secondary);
        if (active) card(frame, x - 24, 778, 48, 3, 2, C.green).strokes = [];
      }
      text(frame, label, x - 34, 829, 11, active ? C.positive : C.secondary, "Regular", 68, "CENTER");
    });
  }

  function metric(frame, label, value, x, y, width = 80, color = C.text) {
    text(frame, label, x, y, 12, C.secondary, "Regular", width);
    text(frame, value, x, y + 22, 15, color, "Medium", width);
  }

  function summary(frame, y, values) {
    card(frame, 24, y, 345, 112);
    values.forEach(([label, value, color], i) => {
      const x = 38 + i * 84;
      metric(frame, label, value, x, y + 26, 78, color || C.text);
      if (i > 0) line(frame, x - 14, y + 26, 64);
    });
  }

  function chip(frame, label, x, y, active = false) {
    card(frame, x, y, 58, 30, 15, active ? C.green : C.bg);
    text(frame, label, x, y + 7, 12, active ? C.text : C.secondary, "Medium", 58, "CENTER");
  }

  function allocationRows(frame, x, y) {
    const rows = [
      ["equity", "Equity", "68%", "₹12,71,300"],
      ["debt", "Debt", "15%", "₹2,76,000"],
      ["crypto", "Crypto", "7%", "₹1,29,600"],
      ["cash", "Cash", "10%", "₹1,65,600"]
    ];
    rows.forEach(([type, label, pct, value], i) => {
      const yy = y + i * 56;
      iconCircle(frame, x, yy, type, 34);
      text(frame, label, x + 50, yy + 4, 14, C.text, "Medium", 80);
      text(frame, pct, x + 230, yy + 4, 14, C.text, "Medium", 45, "RIGHT");
      card(frame, x + 50, yy + 30, 120, 5, 3, "#34313B").strokes = [];
      const width = Math.max(12, (120 * parseInt(pct, 10)) / 75);
      const fill = type === "equity" ? C.green : type === "debt" ? C.blue : type === "crypto" ? C.warning : C.cashBlue;
      card(frame, x + 50, yy + 30, width, 5, 3, fill).strokes = [];
      text(frame, value, x + 166, yy + 30, 11, C.secondary, "Regular", 90, "RIGHT");
    });
  }

  function holdingRow(frame, y, type, name, meta, current, invested, pnl, alloc, note = "") {
    card(frame, 24, y, 345, 72, 12);
    iconCircle(frame, 36, y + 14, type, 32);
    text(frame, name, 78, y + 12, 14, C.text, "Medium", 150);
    text(frame, meta, 78, y + 33, 10, C.secondary, "Regular", 178);
    if (note) text(frame, note, 78, y + 50, 9, C.warning, "Regular", 130);
    text(frame, current, 265, y + 14, 14, C.text, "Medium", 82, "RIGHT");
    text(frame, `Invested ${invested}`, 36, y + 52, 9, C.secondary, "Regular", 106);
    text(frame, `P&L ${pnl}`, 158, y + 52, 9, C.positive, "Regular", 88);
    text(frame, alloc, 318, y + 52, 9, C.secondary, "Regular", 36, "RIGHT");
  }

  text(page, "CogVest V1 UI Concepts - Issue #69", 24, 24, 28, C.text, "Bold", 620);
  text(page, "Editable Figma frames based on DESIGN.md Private Ledger direction. These replace generated PNGs as the stable design source.", 24, 62, 14, C.secondary, "Regular", 980);

  const dashboard = screen("Dashboard", 24);
  top(dashboard, "Dashboard", "Local portfolio • 3 May 2026", ["eye", "refresh"]);
  summary(dashboard, 132, [["Current value", "₹18,42,500"], ["Invested", "₹15,32,000"], ["P&L", "+₹3,10,500", C.positive], ["P&L %", "+20.26%", C.positive]]);
  card(dashboard, 24, 258, 345, 44, 12);
  text(dashboard, "●  Quotes updated 2m ago  •  Manual fallback ready", 38, 272, 12, C.secondary, "Regular", 250);
  svg(dashboard, "refresh", 324, 268, 18);
  card(dashboard, 24, 318, 345, 230);
  text(dashboard, "Allocation", 38, 334, 16, C.text, "Semi Bold", 150);
  text(dashboard, "View details", 274, 336, 12, C.positive, "Medium", 80, "RIGHT");
  allocationRows(dashboard, 38, 378);
  card(dashboard, 24, 562, 345, 98);
  text(dashboard, "This month", 38, 578, 16, C.text, "Semi Bold", 130);
  text(dashboard, "May 2026", 294, 580, 12, C.positive, "Medium", 60, "RIGHT");
  metric(dashboard, "Invested", "₹1,20,000", 42, 616, 92);
  metric(dashboard, "Savings rate", "42%", 154, 616, 92);
  metric(dashboard, "Cash change", "+₹70,000", 266, 616, 84);
  card(dashboard, 24, 674, 345, 64);
  iconCircle(dashboard, 38, 689, "neutral", 32);
  text(dashboard, "Conviction data is still building", 82, 688, 14, C.text, "Medium", 230);
  text(dashboard, "Optional conviction improves context over time.", 82, 710, 11, C.secondary, "Regular", 240);
  nav(dashboard, "Dashboard");

  const holdings = screen("Holdings", 448);
  top(holdings, "Holdings", "24 positions • local data", ["search", "eye"]);
  summary(holdings, 128, [["Current value", "₹12,48,212"], ["Invested", "₹11,05,823"], ["P&L", "+₹1,42,389", C.positive], ["Drift", "3.2%", C.warning]]);
  text(holdings, "●  Quotes updated 2m ago  •  1 manual price", 38, 218, 12, C.secondary, "Regular", 230);
  ["All", "Equity", "Debt", "Crypto", "Cash"].forEach((label, i) => chip(holdings, label, 24 + i * 68, 260, i === 0));
  text(holdings, "Sorted by asset class", 24, 310, 12, C.secondary, "Regular", 160);
  holdingRow(holdings, 334, "equity", "HDFC Bank", "Equity · Financial Services", "₹1,82,850", "₹1,64,235", "+₹18,615", "14.6%");
  holdingRow(holdings, 414, "equity", "Nifty 50 ETF", "Equity · Index Fund", "₹50,665", "₹44,220", "+₹6,445", "4.1%");
  holdingRow(holdings, 494, "debt", "Sovereign Gold Bond", "Debt · Government Bond", "₹57,110", "₹52,950", "+₹4,160", "4.6%");
  holdingRow(holdings, 574, "crypto", "Bitcoin", "Crypto · Coin", "₹13,90,400", "₹11,05,000", "+₹2,85,400", "11.1%", "● Manual · 8h ago");
  holdingRow(holdings, 654, "debt", "Liquid Fund", "Debt · Liquid / Overnight", "₹2,50,250", "₹2,50,000", "+₹250", "2.0%");
  nav(holdings, "Holdings");

  const addHolding = screen("Add Holding", 872);
  topBack(addHolding, "Add Holding", "Opening position • local only");
  text(addHolding, "?", 342, 74, 22, C.secondary, "Semi Bold", 24, "CENTER");
  ["Asset", "Classification", "Position", "Review"].forEach((label, i) => {
    const x = 58 + i * 86;
    iconCircle(addHolding, x, 142, "neutral", 32);
    text(addHolding, label, x - 22, 180, 11, i === 2 ? C.positive : C.secondary, "Medium", 76, "CENTER");
    if (i < 3) line(addHolding, x + 42, 158, 42);
  });
  card(addHolding, 24, 222, 345, 58, 12);
  iconCircle(addHolding, 38, 234, "neutral", 32);
  text(addHolding, "Asset", 82, 234, 15, C.text, "Medium", 120);
  text(addHolding, "HDFC Bank · HDFCBANK · INR", 82, 256, 11, C.secondary, "Regular", 190);
  text(addHolding, "Edit ›", 310, 242, 13, C.secondary, "Medium", 50);
  card(addHolding, 24, 292, 345, 58, 12);
  iconCircle(addHolding, 38, 304, "equity", 32);
  text(addHolding, "Classification", 82, 304, 15, C.text, "Medium", 130);
  text(addHolding, "Equity · Large Cap · Financial Services", 82, 326, 11, C.secondary, "Regular", 220);
  text(addHolding, "Edit ›", 310, 312, 13, C.secondary, "Medium", 50);
  card(addHolding, 24, 364, 345, 196, 12);
  iconCircle(addHolding, 38, 378, "neutral", 32);
  text(addHolding, "Position details", 82, 382, 16, C.text, "Semi Bold", 160);
  metric(addHolding, "Quantity *", "25", 42, 426, 74);
  metric(addHolding, "Average cost *", "₹1,450.00", 136, 426, 104);
  metric(addHolding, "Current price *", "₹1,678.25", 252, 426, 110);
  chip(addHolding, "Live", 42, 486, true);
  chip(addHolding, "Manual", 112, 486, false);
  text(addHolding, "Date acquired: 15 Apr 2024", 42, 532, 12, C.secondary, "Regular", 210);
  card(addHolding, 24, 574, 345, 96, 12);
  text(addHolding, "Derived preview", 82, 592, 16, C.text, "Semi Bold", 150);
  ["₹36,250", "₹41,956", "+₹5,706", "+2.34%"].forEach((value, i) => metric(addHolding, ["Invested", "Current", "P&L", "Allocation"][i], value, 42 + i * 80, 626, 76, i > 1 ? C.positive : C.text));
  card(addHolding, 24, 684, 345, 52, 12);
  text(addHolding, "Conviction optional", 82, 697, 14, C.text, "Medium", 170);
  text(addHolding, "Add later", 82, 718, 11, C.secondary, "Regular", 100);
  card(addHolding, 24, 750, 160, 40, 8, C.bg);
  text(addHolding, "Save and add another", 34, 761, 12, C.text, "Medium", 140, "CENTER");
  card(addHolding, 202, 750, 166, 40, 8, C.green);
  text(addHolding, "Save holding", 218, 761, 12, C.text, "Medium", 130, "CENTER");
  nav(addHolding, "Add");

  const cash = screen("Cash", 1296);
  top(cash, "Cash", "Manual ledger • local only", ["plus", "eye"]);
  card(cash, 24, 130, 345, 88);
  iconCircle(cash, 38, 152, "cash", 38);
  text(cash, "Cash balance", 92, 146, 13, C.secondary, "Regular", 120);
  text(cash, "₹1,65,600", 92, 174, 28, C.text, "Semi Bold", 180);
  text(cash, "₹••,•••", 282, 174, 16, C.secondary, "Medium", 70);
  [["May added", "₹70,000"], ["May invested", "₹45,000"], ["Available", "₹1,20,600"], ["Savings rate", "32.8%"]].forEach(([label, value], i) => {
    const x = 24 + i * 86;
    card(cash, x, 234, 78, 82, 10);
    text(cash, label, x + 10, 248, 10, C.secondary, "Regular", 60);
    text(cash, value, x + 10, 286, 15, C.text, "Medium", 62);
  });
  card(cash, 24, 332, 345, 178);
  text(cash, "Add cash entry", 38, 348, 16, C.text, "Semi Bold", 160);
  chip(cash, "Deposit", 38, 386, true);
  chip(cash, "Withdrawal", 112, 386, false);
  card(cash, 200, 386, 132, 30, 15, C.bg);
  text(cash, "Investment transfer", 200, 394, 10, C.secondary, "Medium", 132, "CENTER");
  metric(cash, "Amount (INR) *", "₹0", 38, 438, 110);
  metric(cash, "Date *", "03 May 2026", 192, 438, 120);
  text(cash, "Note (optional)  e.g., Salary, SIP transfer", 38, 488, 11, C.muted, "Regular", 260);
  card(cash, 250, 520, 92, 34, 8, C.green);
  text(cash, "Save entry", 262, 530, 12, C.text, "Medium", 70, "CENTER");
  card(cash, 24, 574, 345, 150);
  text(cash, "Recent cash ledger", 38, 590, 16, C.text, "Semi Bold", 180);
  text(cash, "View all", 296, 592, 12, C.positive, "Medium", 60, "RIGHT");
  [["Salary added", "₹70,000", C.positive], ["SIP transfer – Index Fund", "-₹15,000", C.text], ["Emergency fund top-up", "₹10,000", C.positive], ["SIP transfer – Large Cap", "-₹15,000", C.text]].forEach(([label, value, color], i) => {
    const y = 626 + i * 24;
    text(cash, label, 42, y, 11, C.secondary, "Regular", 160);
    text(cash, value, 286, y, 12, color, "Medium", 70, "RIGHT");
  });
  card(cash, 24, 738, 345, 48, 12);
  iconCircle(cash, 38, 745, "cash", 28);
  text(cash, "Cash is included in total allocation", 78, 748, 12, C.text, "Medium", 200);
  text(cash, "Last updated 03 May 2026, 9:40 AM", 78, 768, 10, C.secondary, "Regular", 200);
  nav(cash, "Cash");

  const monthly = screen("Monthly Progression", 1720);
  topBack(monthly, "Monthly Progression", "May 2026 snapshot", "eye");
  text(monthly, "‹  Apr 2026", 24, 128, 13, C.secondary, "Regular", 100);
  text(monthly, "May 2026", 164, 128, 15, C.positive, "Medium", 80, "CENTER");
  text(monthly, "Jun 2026  ›", 286, 128, 13, C.secondary, "Regular", 80, "RIGHT");
  [["Portfolio value", "₹19,87,450"], ["Monthly investment", "₹1,40,000"], ["Cash balance", "₹3,25,470"], ["Savings rate", "34%"]].forEach(([label, value], i) => {
    const x = 24 + i * 86;
    card(monthly, x, 170, 78, 82, 10);
    text(monthly, label, x + 10, 184, 10, C.secondary, "Regular", 58);
    text(monthly, value, x + 10, 222, 14, C.text, "Medium", 60);
  });
  card(monthly, 24, 270, 345, 196);
  text(monthly, "What changed this month?", 38, 286, 16, C.text, "Semi Bold", 210);
  [["equity", "Equity", "Market value and contributions", "+₹58,000"], ["debt", "Debt", "Stable allocation", "+₹12,000"], ["crypto", "Crypto", "Manual price movement", "-₹8,500"], ["cash", "Cash", "Net cash change", "+₹70,000"]].forEach(([type, label, caption, value], i) => {
    const y = 326 + i * 34;
    iconCircle(monthly, 38, y - 5, type, 28);
    text(monthly, label, 78, y, 13, C.text, "Medium", 80);
    text(monthly, caption, 78, y + 16, 10, C.secondary, "Regular", 170);
    text(monthly, value, 288, y + 4, 13, value.startsWith("-") ? C.negative : C.text, "Medium", 70, "RIGHT");
  });
  card(monthly, 24, 484, 345, 100);
  text(monthly, "Progression (last 6 months)", 38, 500, 16, C.text, "Semi Bold", 230);
  line(monthly, 60, 568, 270, C.secondary, 0.75);
  card(monthly, 24, 600, 345, 128);
  text(monthly, "Asset class snapshot", 38, 616, 16, C.text, "Semi Bold", 200);
  [["equity", "Equity", "₹12,45,000", "62.6%"], ["debt", "Debt", "₹3,22,000", "16.2%"], ["crypto", "Crypto", "₹1,20,000", "6.0%"], ["cash", "Cash", "₹3,25,470", "16.3%"]].forEach(([type, label, value, pct], i) => {
    const y = 654 + i * 26;
    iconCircle(monthly, 38, y - 6, type, 24);
    text(monthly, label, 70, y, 12, C.text, "Medium", 70);
    text(monthly, value, 226, y, 12, C.text, "Regular", 80, "RIGHT");
    text(monthly, pct, 322, y, 12, C.secondary, "Regular", 40, "RIGHT");
  });
  card(monthly, 24, 742, 345, 40, 12);
  text(monthly, "May note", 76, 750, 13, C.text, "Medium", 120);
  text(monthly, "Optional note", 246, 752, 10, C.secondary, "Regular", 90);
  nav(monthly, "Dashboard");

  const settings = screen("Settings", 2144);
  top(settings, "Settings", "Local-first controls", []);
  text(settings, "ⓘ", 342, 76, 20, C.secondary, "Regular", 24, "CENTER");
  function settingCard(y, title, lines, height = 106) {
    card(settings, 24, y, 345, height);
    iconCircle(settings, 40, y + 20, "neutral", 34);
    text(settings, title, 92, y + 22, 16, C.text, "Semi Bold", 180);
    lines.forEach(([label, color], i) => text(settings, label, 92, y + 48 + i * 22, 12, color || C.secondary, "Regular", 225));
  }
  settingCard(128, "Privacy", [["Data stays on this device"], ["●  Local storage: Active", C.positive], ["No account • No cloud sync • No analytics"]], 100);
  settingCard(240, "Value masking", [["Hide amounts on screen and app switcher."], ["Masked preview   ₹••,••,•••"]], 92);
  settingCard(344, "Quotes", [["Live refresh     Every 15 min"], ["Last refresh     3 May, 10:15 AM"], ["Provider status     Available", C.positive]], 110);
  settingCard(466, "Currency", [["Base currency     INR"], ["Foreign assets summary     On"], ["USD & crypto fallback     On"]], 110);
  settingCard(588, "Display & App info", [["Density     Standard (V1)"], ["Minimal Mode     V2 locked", C.muted], ["App version 1.0.0 · preview"]], 110);
  card(settings, 24, 720, 345, 38, 10, C.bg).strokes = [paint(C.negative, 0.45)];
  text(settings, "Clear local data", 52, 730, 12, C.negative, "Medium", 150);
  text(settings, "Deletes local data", 224, 730, 10, C.muted, "Regular", 114, "RIGHT");
  nav(settings, "Settings");

  figma.viewport.scrollAndZoomIntoView([dashboard, holdings, addHolding, cash, monthly, settings]);
  figma.closePlugin("Created CogVest issue #69 V1 editable screens.");
}

main().catch((error) => {
  figma.closePlugin(`CogVest screen generation failed: ${error.message}`);
});
