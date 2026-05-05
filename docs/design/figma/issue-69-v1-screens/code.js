// CogVest — V1 editable Figma screens
// Run from Figma Desktop as a development plugin.
// Improvements: conviction stars, better spacing system,
// improved hero card, insight card, consistent borders,
// better typography contrast.
// Navigation model fixed:
// Main tabs: Dashboard, Holdings, Progress, Cash, Settings
// Quick Add: header action button, not middle FAB
// Secondary screen: Add Holding

async function main() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  // ─── COLOUR SYSTEM ───────────────────────────────────────────
  const C = {
    // Backgrounds
    bg: "#0A0A0B",
    surface: "#1C1C1E",
    elevated: "#2C2C2E",
    field: "#111113",

    // Text
    text: "#F5F5F7",
    secondary: "#98989D",
    muted: "#636366",
    inverse: "#000000",

    // Brand
    green: "#2E7D52",
    greenDim: "#1A4A30",
    greenText: "#4CAF50",

    // Semantic
    positive: "#34C759",
    negative: "#FF453A",
    warning: "#F59E0B",
    blue: "#0A84FF",
    amber: "#FF9F0A",
    cashBlue: "#64D2FF",
    purple: "#BF5AF2",

    // Borders
    border: "#38383A",
    borderDim: "#28282A",
  };

  // ─── SPACING SYSTEM ──────────────────────────────────────────
  const S = {
    screenPad: 20,
    cardPad: 16,
    cardGap: 10,
    rowH: 52,
    headerH: 32,
    navH: 74,
    navY: 778,
    radius: {
      sm: 8,
      md: 14,
      lg: 18,
      full: 999,
    },
  };

  // ─── PAGE SETUP ──────────────────────────────────────────────
  const PAGE_NAME = "Issue 69 - V1 UI Concepts";
  let page = figma.root.children.find((p) => p.name === PAGE_NAME);
  if (!page) {
    page = figma.createPage();
    page.name = PAGE_NAME;
  }

  await figma.setCurrentPageAsync(page);

  for (const child of [...page.children]) {
    child.remove();
  }

  // ─── PRIMITIVE HELPERS ───────────────────────────────────────
  function rgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
    };
  }

  function paint(hex, opacity = 1) {
    return {
      type: "SOLID",
      color: rgb(hex),
      opacity,
    };
  }

  function rect(parent, x, y, w, h, radius = 0, fill = C.surface, strokeColor = null, strokeOpacity = 0.5) {
    const node = figma.createRectangle();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(w, h);
    node.cornerRadius = radius;
    node.fills = [paint(fill)];

    if (strokeColor) {
      node.strokes = [paint(strokeColor, strokeOpacity)];
      node.strokeWeight = 1;
    } else {
      node.strokes = [];
    }

    return node;
  }

  function card(parent, x, y, w, h, radius = S.radius.lg, fill = C.surface) {
    return rect(parent, x, y, w, h, radius, fill, C.border, 0.35);
  }

  function t(parent, value, x, y, size, color = C.text, style = "Regular", width = 160, align = "LEFT") {
    const node = figma.createText();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(width, Math.max(size + 10, 18));
    node.fontName = { family: "Inter", style };
    node.fontSize = size;
    node.fills = [paint(color)];
    node.textAlignHorizontal = align;
    node.textAutoResize = "HEIGHT";
    node.characters = value;
    return node;
  }

  function line(parent, x, y, width, color = C.border, opacity = 0.35) {
    const node = figma.createLine();
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(width, 0);
    node.strokes = [paint(color, opacity)];
    node.strokeWeight = 1;
    return node;
  }

  function svgNode(parent, svgStr, x, y, w, h) {
    const node = figma.createNodeFromSvg(svgStr);
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    node.resize(w, h);
    return node;
  }

  // ─── ICON SYSTEM ─────────────────────────────────────────────
  function icon(name, color = C.secondary, size = 20) {
    const s = color;

    const icons = {
      home: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z" stroke="${s}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,

      pie: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M12 3v9h9A9 9 0 1 1 12 3Z" stroke="${s}" stroke-width="1.8"/><path d="M14 3.3A9 9 0 0 1 20.7 10H14V3.3Z" stroke="${s}" stroke-width="1.8"/></svg>`,

      plus: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="${s}" stroke-width="2.2" stroke-linecap="round"/></svg>`,

      wallet: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v12H4z" stroke="${s}" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 7l11-3 2 3" stroke="${s}" stroke-width="1.8"/><path d="M15 13h5" stroke="${s}" stroke-width="1.8"/><circle cx="17" cy="13" r="1" fill="${s}"/></svg>`,

      gear: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" stroke="${s}" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/></svg>`,

      trend: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M4 16l5-5 4 4 7-8" stroke="${s}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" stroke="${s}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

      shield: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M12 3 20 6v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V6l8-3Z" stroke="${s}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,

      btc: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M9 4v16M13 4v16M7 7h6.2c2 0 3.3 1 3.3 2.6 0 1.1-.7 2-1.9 2.3 1.5.3 2.4 1.3 2.4 2.8 0 1.8-1.5 3.3-3.8 3.3H7M7 12h6" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/></svg>`,

      eye: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="${s}" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="${s}" stroke-width="1.8"/></svg>`,

      eyeOff: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/><path d="M1 1l22 22" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/></svg>`,

      refresh: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M20 7v5h-5M4 17v-5h5" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 12a6 6 0 0 0-10.2-4.2L4 11m16 2-3.8 3.2A6 6 0 0 1 6 12" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/></svg>`,

      search: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="${s}" stroke-width="1.8"/><path d="m16 16 5 5" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/></svg>`,

      back: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke="${s}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

      chevron: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="${s}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

      check: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="${s}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

      sparkle: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.2H22l-6.2 4.6 2.4 7.2L12 16.6l-6.2 4.4 2.4-7.2L2 9.2h7.6L12 2Z" stroke="${s}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,

      info: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="${s}" stroke-width="1.8"/><path d="M12 11v6" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1" fill="${s}"/></svg>`,

      calendar: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="${s}" stroke-width="1.8"/><path d="M3 9h18M8 2v4M16 2v4" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    };

    return icons[name] || icons.trend;
  }

  function ico(parent, name, x, y, size = 20, color = C.secondary) {
    return svgNode(parent, icon(name, color, size), x, y, size, size);
  }

  // ─── ASSET CLASS CONFIG ──────────────────────────────────────
  const assetClass = {
    equity: { color: C.positive, icon: "trend", label: "Equity" },
    debt: { color: C.blue, icon: "shield", label: "Debt" },
    crypto: { color: C.amber, icon: "btc", label: "Crypto" },
    cash: { color: C.cashBlue, icon: "wallet", label: "Cash" },
  };

  function assetDot(parent, x, y, type, dotSize = 8) {
    const ac = assetClass[type] || assetClass.equity;
    const dot = figma.createEllipse();
    parent.appendChild(dot);
    dot.x = x;
    dot.y = y;
    dot.resize(dotSize, dotSize);
    dot.fills = [paint(ac.color)];
    dot.strokes = [];
    return dot;
  }

  // ─── PILL / BADGE ────────────────────────────────────────────
  function pill(parent, label, x, y, bgColor, textColor, width = null, height = 24, radius = S.radius.full) {
    const textW = width ? width - 20 : label.length * 7 + 16;
    const pillW = width || textW + 20;
    rect(parent, x, y, pillW, height, radius, bgColor, null);
    t(parent, label, x, y + (height - 14) / 2, 11, textColor, "Semi Bold", pillW, "CENTER");
    return pillW;
  }

  function convictionStars(parent, x, y, filled, outOf = 5) {
    const starSize = 11;
    const gap = 2;

    for (let i = 0; i < outOf; i++) {
      const starX = x + i * (starSize + gap);
      const isFilled = i < filled;
      t(parent, "★", starX, y, starSize, isFilled ? C.warning : C.muted, "Semi Bold", starSize + 2);
    }
  }

  // ─── SCREEN FRAME ────────────────────────────────────────────
  function screen(name, x) {
    const frame = figma.createFrame();
    page.appendChild(frame);
    frame.name = name;
    frame.x = x;
    frame.y = 130;
    frame.resize(393, 852);
    frame.cornerRadius = 36;
    frame.clipsContent = true;
    frame.fills = [paint(C.bg)];

    t(frame, "10:42", 24, 20, 12, C.text, "Semi Bold", 60);
    t(frame, "◢  ▰ 100%", 300, 20, 11, C.text, "Medium", 80, "RIGHT");

    return frame;
  }

  // ─── HEADER COMPONENTS ───────────────────────────────────────
  function header(frame, title, subtitle, actions = []) {
    t(frame, title, S.screenPad, 60, 26, C.text, "Bold", 210);

    if (subtitle) {
      t(frame, subtitle, S.screenPad, 96, 12, C.secondary, "Regular", 245);
    }

    actions.forEach((action, i) => {
      const x = 330 - (actions.length - 1 - i) * 42;
      rect(frame, x, 60, 34, 34, S.radius.sm, C.elevated, C.border, 0.3);
      ico(frame, action, x + 7, 67, 20, C.secondary);
    });
  }

  function headerBack(frame, title, subtitle, action = null) {
    ico(frame, "back", S.screenPad, 66, 20, C.text);
    t(frame, title, 54, 60, 22, C.text, "Bold", action ? 220 : 280);

    if (subtitle) {
      t(frame, subtitle, 54, 92, 11, C.secondary, "Regular", 240);
    }

    if (action) {
      rect(frame, 335, 60, 34, 34, S.radius.sm, C.elevated, C.border, 0.3);
      ico(frame, action, 342, 67, 20, C.secondary);
    }
  }

  // ─── BOTTOM NAVIGATION ───────────────────────────────────────
  function nav(frame, selected) {
    rect(frame, 0, S.navY, 393, S.navH, 0, C.surface, C.border, 0.5);

    const items = [
      ["Dashboard", "home", 38],
      ["Holdings", "pie", 118],
      ["Progress", "trend", 197],
      ["Cash", "wallet", 276],
      ["Settings", "gear", 354],
    ];

    items.forEach(([label, iconName, cx]) => {
      const active = label === selected;
      const iconColor = active ? C.green : C.secondary;
      const labelColor = active ? C.green : C.secondary;

      if (active) {
        rect(frame, cx - 18, S.navY, 36, 3, S.radius.full, C.green, null);
      }

      ico(frame, iconName, cx - 11, S.navY + 14, 22, iconColor);

      t(
        frame,
        label,
        cx - 34,
        S.navY + 40,
        10,
        labelColor,
        active ? "Medium" : "Regular",
        68,
        "CENTER"
      );
    });
  }

  // ─── METRIC HELPERS ──────────────────────────────────────────
  function metricPair(parent, label, value, x, y, width = 80, valueColor = C.text) {
    t(parent, label, x, y, 11, C.secondary, "Regular", width);
    t(parent, value, x, y + 18, 15, valueColor, "Semi Bold", width);
  }

  function metricStrip(frame, x, y, items) {
    const w = 353;
    card(frame, x, y, w, 72, S.radius.md);

    const colW = Math.floor(w / items.length);

    items.forEach(([label, value, color], i) => {
      const colX = x + 14 + i * colW;

      t(frame, label, colX, y + 12, 10, C.secondary, "Regular", colW - 8);
      t(frame, value, colX, y + 30, 15, color || C.text, "Semi Bold", colW - 8);

      if (i > 0) {
        line(frame, colX - 10, y + 16, 0, C.border, 0.4);
      }
    });
  }

  function filterChips(frame, y, labels, activeIndex = 0) {
    let x = S.screenPad;

    labels.forEach((label, i) => {
      const active = i === activeIndex;
      const chipW = label.length * 7 + 24;

      rect(frame, x, y, chipW, 30, S.radius.full, active ? C.green : C.elevated, active ? null : C.border, 0.3);
      t(frame, label, x, y + 8, 12, active ? C.text : C.secondary, active ? "Semi Bold" : "Regular", chipW, "CENTER");

      x += chipW + 8;
    });
  }

  function statusBar(frame, y, message) {
    rect(frame, S.screenPad, y, 353, 36, S.radius.sm, C.elevated, C.border, 0.2);

    const dot = figma.createEllipse();
    frame.appendChild(dot);
    dot.x = S.screenPad + 14;
    dot.y = y + 13;
    dot.resize(10, 10);
    dot.fills = [paint(C.positive)];
    dot.strokes = [];

    t(frame, message, S.screenPad + 32, y + 11, 11, C.secondary, "Regular", 260);
    ico(frame, "refresh", 348, y + 8, 18, C.secondary);
  }

  // ─── DONUT CHART ─────────────────────────────────────────────
  function donutChart(frame, x, y) {
    card(frame, x, y, 353, 220, S.radius.lg);

    t(frame, "Allocation", x + S.cardPad, y + 16, 15, C.text, "Semi Bold", 140);
    t(frame, "View details", x + 263, y + 18, 11, C.green, "Medium", 76, "RIGHT");

    const segments = [
      { label: "Equity", pct: 68, color: C.positive },
      { label: "Debt", pct: 15, color: C.blue },
      { label: "Crypto", pct: 7, color: C.amber },
      { label: "Cash", pct: 10, color: C.cashBlue },
    ];

    const cx = 100;
    const cy = 110;
    const outerR = 52;
    const innerR = 34;
    const gap = 2;

    const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
    let start = 0;

    const paths = segments
      .map((seg) => {
        const sweep = (seg.pct / 100) * 360;
        const s1 = start + gap;
        const e1 = start + sweep - gap;
        const large = sweep > 180 ? 1 : 0;

        const x1 = cx + outerR * Math.cos(toRad(s1));
        const y1 = cy + outerR * Math.sin(toRad(s1));

        const x2 = cx + outerR * Math.cos(toRad(e1));
        const y2 = cy + outerR * Math.sin(toRad(e1));

        const x3 = cx + innerR * Math.cos(toRad(e1));
        const y3 = cy + innerR * Math.sin(toRad(e1));

        const x4 = cx + innerR * Math.cos(toRad(s1));
        const y4 = cy + innerR * Math.sin(toRad(s1));

        start += sweep;

        return `<path d="M${x1} ${y1} A${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4}Z" fill="${seg.color}"/>`;
      })
      .join("");

    const legendRows = segments
      .map((seg, i) => {
        const ly = 68 + i * 26;

        return `
          <circle cx="212" cy="${ly}" r="5" fill="${seg.color}"/>
          <text x="226" y="${ly + 4}" font-family="Inter" font-size="12" font-weight="500" fill="${C.text}">${seg.label}</text>
          <text x="339" y="${ly + 4}" font-family="Inter" font-size="12" fill="${C.secondary}" text-anchor="end">${seg.pct}%</text>
        `;
      })
      .join("");

    const donutSvg = `
      <svg width="353" height="220" viewBox="0 0 353 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${innerR - 2}" fill="${C.surface}"/>
        <text x="${cx}" y="${cy - 6}" font-family="Inter" font-size="17" font-weight="700" fill="${C.text}" text-anchor="middle">68%</text>
        <text x="${cx}" y="${cy + 12}" font-family="Inter" font-size="10" fill="${C.secondary}" text-anchor="middle">Equity</text>
        ${legendRows}
        <text x="14" y="208" font-family="Inter" font-size="10" fill="${C.muted}">Equity-heavy allocation · Consider rebalancing at 70%+</text>
      </svg>
    `;

    svgNode(frame, donutSvg, x, y, 353, 220);
  }

  // ─── HOLDINGS TABLE ──────────────────────────────────────────
  function holdingsTable(frame, x, y) {
    const W = 353;
    const HEADER_H = 32;
    const ROW_H = 58;

    const rows = [
      {
        type: "equity",
        name: "HDFC Bank",
        meta: "Equity · Financials",
        current: "₹1.83L",
        invested: "₹1.64L",
        pnl: "+₹18.6K",
        pnlPct: "+11.4%",
        alloc: "14.6%",
        conviction: 4,
      },
      {
        type: "equity",
        name: "Nifty 50 ETF",
        meta: "Equity · Index",
        current: "₹50.7K",
        invested: "₹44.2K",
        pnl: "+₹6.5K",
        pnlPct: "+14.7%",
        alloc: "4.1%",
        conviction: 3,
      },
      {
        type: "debt",
        name: "Gold Bond",
        meta: "Debt · Govt Bond",
        current: "₹57.1K",
        invested: "₹53.0K",
        pnl: "+₹4.1K",
        pnlPct: "+7.7%",
        alloc: "4.6%",
        conviction: 5,
      },
      {
        type: "crypto",
        name: "Bitcoin",
        meta: "Crypto · Manual",
        current: "₹13.9L",
        invested: "₹11.1L",
        pnl: "+₹2.85L",
        pnlPct: "+25.7%",
        alloc: "11.1%",
        conviction: 4,
      },
      {
        type: "debt",
        name: "Liquid Fund",
        meta: "Debt · Overnight",
        current: "₹2.50L",
        invested: "₹2.50L",
        pnl: "+₹250",
        pnlPct: "+0.1%",
        alloc: "2.0%",
        conviction: null,
      },
      {
        type: "cash",
        name: "Cash Reserve",
        meta: "Available cash",
        current: "₹1.65L",
        invested: "—",
        pnl: "+₹70K",
        pnlPct: "",
        alloc: "10.0%",
        conviction: null,
      },
    ];

    const tableH = HEADER_H + rows.length * ROW_H;

    card(frame, x, y, W, tableH, S.radius.lg);

    t(frame, "Asset", x + 14, y + 10, 10, C.secondary, "Medium", 110);
    t(frame, "Current", x + 214, y + 10, 10, C.secondary, "Medium", 68, "RIGHT");
    t(frame, "P&L", x + 310, y + 10, 10, C.secondary, "Medium", 42, "RIGHT");

    line(frame, x + 14, y + HEADER_H, W - 28, C.border, 0.5);

    rows.forEach((row, i) => {
      const rowY = y + HEADER_H + i * ROW_H;
      const pnlColor = row.pnl.startsWith("-") ? C.negative : C.positive;
      const ac = assetClass[row.type] || assetClass.equity;

      if (i > 0) {
        line(frame, x + 14, rowY, W - 28, C.border, 0.2);
      }

      rect(frame, x + 1, rowY + 8, 3, ROW_H - 16, S.radius.full, ac.color, null);

      assetDot(frame, x + 14, rowY + 20, row.type, 8);
      ico(frame, ac.icon, x + 26, rowY + 14, 16, ac.color);

      t(frame, row.name, x + 50, rowY + 8, 13, C.text, "Semi Bold", 130);
      t(frame, row.meta, x + 50, rowY + 28, 10, C.secondary, "Regular", 130);

      t(frame, row.current, x + 198, rowY + 8, 13, C.text, "Semi Bold", 84, "RIGHT");
      t(frame, row.invested, x + 198, rowY + 28, 10, C.secondary, "Regular", 84, "RIGHT");

      t(frame, row.pnl, x + 282, rowY + 8, 13, pnlColor, "Semi Bold", 68, "RIGHT");
      t(frame, row.pnlPct, x + 282, rowY + 28, 10, C.secondary, "Regular", 68, "RIGHT");

      if (row.conviction) {
        convictionStars(frame, x + W - 80, rowY + 10, row.conviction);
      }
    });
  }

  // ─── PORTFOLIO TREND CHART ───────────────────────────────────
  function trendChart(frame, x, y, w = 353, h = 140) {
    card(frame, x, y, w, h, S.radius.md);

    t(frame, "Portfolio trend", x + 14, y + 14, 14, C.text, "Semi Bold", 160);
    t(frame, "Last 6 months", x + 14, y + 34, 11, C.secondary, "Regular", 140);

    const chartSvg = `
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${C.positive}" stop-opacity="0.22"/>
            <stop offset="1" stop-color="${C.positive}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="48" y1="56" x2="${w - 20}" y2="56" stroke="${C.border}" stroke-width="0.6" stroke-dasharray="3 5"/>
        <line x1="48" y1="80" x2="${w - 20}" y2="80" stroke="${C.border}" stroke-width="0.6" stroke-dasharray="3 5"/>
        <line x1="48" y1="104" x2="${w - 20}" y2="104" stroke="${C.border}" stroke-width="0.6"/>
        <text x="38" y="60"  font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="end">20L</text>
        <text x="38" y="84"  font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="end">17L</text>
        <text x="38" y="108" font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="end">14L</text>
        <path d="M52 106 L97 96 L142 89 L187 76 L232 65 L277 57 L318 46 L318 104 L52 104Z" fill="url(#areaGrad)"/>
        <path d="M52 106 L97 96 L142 89 L187 76 L232 65 L277 57 L318 46" stroke="${C.positive}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="318" cy="46" r="5" fill="${C.bg}" stroke="${C.positive}" stroke-width="2.5"/>
        <text x="52"  y="126" font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="middle">Dec</text>
        <text x="97"  y="126" font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="middle">Jan</text>
        <text x="142" y="126" font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="middle">Feb</text>
        <text x="187" y="126" font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="middle">Mar</text>
        <text x="232" y="126" font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="middle">Apr</text>
        <text x="277" y="126" font-family="Inter" font-size="9" fill="${C.muted}" text-anchor="middle">May</text>
        <text x="318" y="126" font-family="Inter" font-size="9" fill="${C.positive}" text-anchor="middle" font-weight="600">Jun</text>
      </svg>
    `;

    svgNode(frame, chartSvg, x, y, w, h);
  }

  // ─── SECTION TITLE ───────────────────────────────────────────
  function sectionTitle(frame, label, x, y, actionLabel = null, actionColor = C.green) {
    t(frame, label, x, y, 14, C.text, "Semi Bold", 200);
    if (actionLabel) {
      t(frame, actionLabel, 345, y + 1, 12, actionColor, "Medium", 80, "RIGHT");
    }
  }

  // ──────────────────────────────────────────────────────────────
  // SCREEN 1 — DASHBOARD
  // ──────────────────────────────────────────────────────────────
  const dashboard = screen("1. Dashboard", 24);

  header(dashboard, "Dashboard", "Local portfolio  ·  3 May 2026", ["eye", "refresh", "plus"]);

  const heroY = 124;

  card(dashboard, S.screenPad, heroY, 353, 128, S.radius.lg);

  t(dashboard, "Portfolio value", S.screenPad + 16, heroY + 14, 11, C.secondary, "Medium", 140);
  t(dashboard, "₹18.42L", S.screenPad + 16, heroY + 34, 34, C.text, "Bold", 180);
  t(dashboard, "+₹3.10L  (+20.2%)", S.screenPad + 16, heroY + 80, 13, C.positive, "Semi Bold", 170);

  t(dashboard, "Invested", S.screenPad + 226, heroY + 22, 10, C.secondary, "Regular", 90);
  t(dashboard, "₹15.32L", S.screenPad + 226, heroY + 38, 15, C.text, "Semi Bold", 100);

  t(dashboard, "Today's change", S.screenPad + 226, heroY + 68, 10, C.secondary, "Regular", 110);
  t(dashboard, "+0.57%", S.screenPad + 226, heroY + 84, 13, C.positive, "Semi Bold", 80);

  statusBar(dashboard, 264, "Quotes updated 2m ago  ·  Manual fallback ready");

  donutChart(dashboard, S.screenPad, 312);

  const insightY = 546;

  rect(dashboard, S.screenPad, insightY, 353, 76, S.radius.md, "#1A1530", C.purple, 0.4);
  ico(dashboard, "sparkle", S.screenPad + 14, insightY + 14, 18, C.purple);
  t(dashboard, "INSIGHT", S.screenPad + 40, insightY + 14, 9, C.purple, "Semi Bold", 80);
  t(dashboard, "Conviction data still building", S.screenPad + 14, insightY + 36, 13, C.text, "Semi Bold", 230);
  t(dashboard, "Rate your next 3 trades to unlock personalised insights.", S.screenPad + 14, insightY + 54, 11, C.secondary, "Regular", 280);
  t(dashboard, "×", 353, insightY + 10, 16, C.muted, "Regular", 22, "CENTER");

  const monthY = 638;

  card(dashboard, S.screenPad, monthY, 353, 90, S.radius.md);
  t(dashboard, "This month", S.screenPad + 14, monthY + 14, 13, C.text, "Semi Bold", 120);
  t(dashboard, "May 2026", 315, monthY + 16, 11, C.green, "Medium", 60, "RIGHT");

  metricPair(dashboard, "Invested", "₹1.20L", S.screenPad + 14, monthY + 46, 88);
  metricPair(dashboard, "Savings rate", "42%", S.screenPad + 112, monthY + 46, 88);
  metricPair(dashboard, "Cash change", "+₹70K", S.screenPad + 214, monthY + 46, 88, C.positive);

  nav(dashboard, "Dashboard");

  // ──────────────────────────────────────────────────────────────
  // SCREEN 2 — HOLDINGS
  // ──────────────────────────────────────────────────────────────
  const holdings = screen("2. Holdings", 448);

  header(holdings, "Holdings", "24 positions  ·  Updated 2m ago", ["search", "plus"]);

  metricStrip(holdings, S.screenPad, 124, [
    ["Current", "₹12.48L"],
    ["Invested", "₹11.05L"],
    ["P&L", "+₹1.42L", C.positive],
    ["Drift", "3.2%", C.warning],
  ]);

  statusBar(holdings, 208, "Quotes updated 2m ago  ·  1 manual price");

  filterChips(holdings, 256, ["All", "Equity", "Debt", "Crypto", "Cash"], 0);

  holdingsTable(holdings, S.screenPad, 302);

  nav(holdings, "Holdings");

  // ──────────────────────────────────────────────────────────────
  // SCREEN 3 — ADD HOLDING
  // ──────────────────────────────────────────────────────────────
  const addTrade = screen("3. Add Holding", 872);

  headerBack(addTrade, "Add Holding", "Opening position  ·  local only");
  ico(addTrade, "info", 348, 66, 18, C.secondary);

  const stepperY = 130;
  const steps = ["Asset", "Class", "Position", "Review"];
  const stepX = [54, 150, 246, 342];

  steps.forEach((label, i) => {
    const cx = stepX[i];
    const done = i < 2;
    const active = i === 2;
    const bg = done || active ? C.green : C.elevated;

    const ellipse = figma.createEllipse();
    addTrade.appendChild(ellipse);
    ellipse.x = cx - 12;
    ellipse.y = stepperY;
    ellipse.resize(24, 24);
    ellipse.fills = [paint(bg)];
    ellipse.strokes = [];

    if (done) {
      ico(addTrade, "check", cx - 7, stepperY + 4, 14, C.text);
    } else {
      t(addTrade, String(i + 1), cx - 12, stepperY + 4, 11, C.text, "Semi Bold", 24, "CENTER");
    }

    t(addTrade, label, cx - 24, stepperY + 30, 10, active ? C.green : C.secondary, active ? "Semi Bold" : "Regular", 48, "CENTER");

    if (i < steps.length - 1) {
      const lineColor = done ? C.green : C.border;
      rect(addTrade, cx + 14, stepperY + 11, stepX[i + 1] - cx - 26, 2, S.radius.full, lineColor, null);
    }
  });

  const assetSummaryY = 184;

  card(addTrade, S.screenPad, assetSummaryY, 353, 52, S.radius.md);
  ico(addTrade, "trend", S.screenPad + 12, assetSummaryY + 16, 18, C.positive);
  t(addTrade, "HDFC Bank", S.screenPad + 38, assetSummaryY + 10, 14, C.text, "Semi Bold", 160);
  t(addTrade, "HDFCBANK.NS  ·  NSE  ·  INR", S.screenPad + 38, assetSummaryY + 30, 11, C.secondary, "Regular", 190);
  t(addTrade, "Edit ›", 330, assetSummaryY + 18, 12, C.secondary, "Medium", 48, "RIGHT");

  const classY = 248;

  card(addTrade, S.screenPad, classY, 353, 52, S.radius.md);
  ico(addTrade, "pie", S.screenPad + 12, classY + 16, 18, C.positive);
  t(addTrade, "Classification", S.screenPad + 38, classY + 10, 14, C.text, "Semi Bold", 140);
  t(addTrade, "Equity · Large Cap · Financial Services", S.screenPad + 38, classY + 30, 11, C.secondary, "Regular", 220);
  t(addTrade, "Edit ›", 330, classY + 18, 12, C.secondary, "Medium", 48, "RIGHT");

  const posY = 312;

  card(addTrade, S.screenPad, posY, 353, 188, S.radius.md);
  t(addTrade, "Position details", S.screenPad + 14, posY + 14, 15, C.text, "Semi Bold", 180);

  [
    [S.screenPad + 14, "Quantity *", "25"],
    [S.screenPad + 118, "Average cost *", "₹1,450.00"],
    [S.screenPad + 230, "Current price *", "₹1,678.25"],
  ].forEach(([ix, label, val]) => {
    t(addTrade, label, ix, posY + 46, 10, C.secondary, "Regular", 90);
    rect(addTrade, ix, posY + 64, 88, 34, S.radius.sm, C.field, C.border, 0.3);
    t(addTrade, val, ix + 8, posY + 75, 13, C.text, "Semi Bold", 72);
  });

  rect(addTrade, S.screenPad + 14, posY + 108, 50, 24, S.radius.full, C.green, null);
  t(addTrade, "Live", S.screenPad + 14, posY + 115, 11, C.text, "Semi Bold", 50, "CENTER");

  rect(addTrade, S.screenPad + 72, posY + 108, 60, 24, S.radius.full, C.elevated, C.border, 0.3);
  t(addTrade, "Manual", S.screenPad + 72, posY + 115, 11, C.secondary, "Regular", 60, "CENTER");

  t(addTrade, "Date acquired: 15 Apr 2024", S.screenPad + 14, posY + 146, 11, C.secondary, "Regular", 200);

  const previewY = 512;

  card(addTrade, S.screenPad, previewY, 353, 82, S.radius.md);
  t(addTrade, "Derived preview", S.screenPad + 14, previewY + 12, 13, C.secondary, "Medium", 160);

  [
    ["Invested", "₹36K"],
    ["Current", "₹41.9K"],
    ["P&L", "+₹5.9K"],
    ["Alloc", "2.34%"],
  ].forEach(([label, val], i) => {
    const vx = S.screenPad + 14 + i * 82;
    const vColor = label === "P&L" ? C.positive : C.text;

    t(addTrade, label, vx, previewY + 34, 10, C.secondary, "Regular", 76);
    t(addTrade, val, vx, previewY + 52, 14, vColor, "Semi Bold", 76);
  });

  const convY = 606;

  rect(addTrade, S.screenPad, convY, 353, 56, S.radius.md, C.elevated, C.border, 0.2);
  t(addTrade, "Conviction  ", S.screenPad + 14, convY + 10, 12, C.text, "Medium", 100);
  t(addTrade, "optional", S.screenPad + 100, convY + 11, 11, C.secondary, "Regular", 60);

  [1, 2, 3, 4, 5].forEach((n, i) => {
    const bx = S.screenPad + 14 + i * 46;
    const active = n === 4;

    rect(addTrade, bx, convY + 30, 38, 22, S.radius.sm, active ? C.greenDim : C.elevated, active ? C.green : C.border, 0.4);
    t(addTrade, String(n), bx, convY + 36, 12, active ? C.green : C.secondary, "Semi Bold", 38, "CENTER");
  });

  rect(addTrade, S.screenPad, 676, 353, 48, S.radius.md, C.green, null);
  t(addTrade, "Save holding", S.screenPad, 692, 14, C.text, "Bold", 353, "CENTER");
  t(addTrade, "Save and add another", S.screenPad, 734, 11, C.secondary, "Medium", 353, "CENTER");

  nav(addTrade, "Holdings");

  // ──────────────────────────────────────────────────────────────
  // SCREEN 4 — CASH
  // ──────────────────────────────────────────────────────────────
  const cash = screen("4. Cash", 1296);

  header(cash, "Cash", "Manual ledger  ·  local only", ["plus", "eye"]);

  card(cash, S.screenPad, 124, 353, 92, S.radius.lg);
  ico(cash, "wallet", S.screenPad + 16, 156, 24, C.cashBlue);
  t(cash, "Cash balance", S.screenPad + 50, 136, 11, C.secondary, "Regular", 130);
  t(cash, "₹1,65,600", S.screenPad + 50, 158, 28, C.text, "Bold", 180);
  t(cash, "₹•• •••", 294, 162, 14, C.secondary, "Medium", 60, "RIGHT");
  t(cash, "+₹70K this month", S.screenPad + 50, 194, 12, C.positive, "Medium", 160);

  metricStrip(cash, S.screenPad, 228, [
    ["Added", "₹70K", C.positive],
    ["Invested", "₹45K"],
    ["Available", "₹1.20L"],
    ["Savings", "32.8%", C.green],
  ]);

  const addCashY = 312;

  card(cash, S.screenPad, addCashY, 353, 218, S.radius.lg);
  t(cash, "Add cash entry", S.screenPad + 14, addCashY + 14, 15, C.text, "Semi Bold", 160);

  [
    ["Deposit", true],
    ["Withdraw", false],
    ["Transfer", false],
  ].forEach(([label, active], i) => {
    const cx = S.screenPad + 14 + i * 98;
    const cw = 86;

    rect(cash, cx, addCashY + 44, cw, 28, S.radius.full, active ? C.green : C.elevated, active ? null : C.border, 0.3);
    t(cash, label, cx, addCashY + 52, 12, active ? C.text : C.secondary, active ? "Semi Bold" : "Regular", cw, "CENTER");
  });

  t(cash, "Amount (INR) *", S.screenPad + 14, addCashY + 86, 10, C.secondary, "Regular", 120);
  rect(cash, S.screenPad + 14, addCashY + 104, 148, 36, S.radius.sm, C.field, C.border, 0.3);
  t(cash, "₹0", S.screenPad + 28, addCashY + 116, 13, C.muted, "Regular", 100);

  t(cash, "Date *", S.screenPad + 178, addCashY + 86, 10, C.secondary, "Regular", 80);
  rect(cash, S.screenPad + 178, addCashY + 104, 148, 36, S.radius.sm, C.field, C.border, 0.3);
  t(cash, "03 May 2026", S.screenPad + 192, addCashY + 116, 13, C.text, "Regular", 120);
  ico(cash, "calendar", S.screenPad + 298, addCashY + 112, 16, C.secondary);

  t(cash, "Note", S.screenPad + 14, addCashY + 152, 10, C.secondary, "Regular", 60);
  rect(cash, S.screenPad + 50, addCashY + 148, 276, 28, S.radius.sm, C.field, C.border, 0.25);
  t(cash, "Salary, SIP transfer…", S.screenPad + 62, addCashY + 156, 11, C.muted, "Regular", 230);

  rect(cash, S.screenPad + 14, addCashY + 188, 325, 22, S.radius.full, C.green, null);
  t(cash, "Save entry", S.screenPad + 14, addCashY + 193, 11, C.text, "Bold", 325, "CENTER");

  sectionTitle(cash, "Recent ledger", S.screenPad, 546, "View all");

  const ledgerRows = [
    ["Salary added", "+₹70,000", C.positive],
    ["SIP — Index Fund", "-₹15,000", C.secondary],
    ["Emergency fund top-up", "+₹10,000", C.positive],
    ["SIP — Large Cap", "-₹15,000", C.secondary],
  ];

  card(cash, S.screenPad, 568, 353, ledgerRows.length * 40 + 8, S.radius.md);

  ledgerRows.forEach(([label, value, color], i) => {
    const ly = 576 + i * 40;

    if (i > 0) {
      line(cash, S.screenPad + 14, ly, 325, C.border, 0.2);
    }

    t(cash, label, S.screenPad + 14, ly + 14, 12, C.secondary, "Regular", 180);
    t(cash, value, 350, ly + 12, 13, color, "Semi Bold", 60, "RIGHT");
  });

  nav(cash, "Cash");

  // ──────────────────────────────────────────────────────────────
  // SCREEN 5 — MONTHLY PROGRESS
  // ──────────────────────────────────────────────────────────────
  const progress = screen("5. Progress", 1720);

  headerBack(progress, "Progress", "May 2026 snapshot", "calendar");

  t(progress, "‹  Apr 2026", S.screenPad, 122, 12, C.secondary, "Regular", 100);
  t(progress, "May 2026", 164, 122, 14, C.green, "Semi Bold", 80, "CENTER");
  t(progress, "Jun 2026  ›", 294, 122, 12, C.secondary, "Regular", 80, "RIGHT");

  metricStrip(progress, S.screenPad, 148, [
    ["Portfolio", "₹19.87L"],
    ["Invested", "₹1.40L"],
    ["Cash", "₹3.25L"],
    ["Savings", "34%", C.green],
  ]);

  const changedY = 232;

  card(progress, S.screenPad, changedY, 353, 212, S.radius.lg);
  t(progress, "What changed this month?", S.screenPad + 14, changedY + 14, 15, C.text, "Semi Bold", 220);

  [
    ["equity", "Equity", "Market value and contributions", "+₹58,000"],
    ["debt", "Debt", "Stable allocation", "+₹12,000"],
    ["crypto", "Crypto", "Manual price movement", "-₹8,500"],
    ["cash", "Cash", "Net cash change", "+₹70,000"],
  ].forEach(([type, label, caption, value], i) => {
    const ac = assetClass[type];
    const wy = changedY + 52 + i * 38;
    const isNeg = value.startsWith("-");

    assetDot(progress, S.screenPad + 14, wy + 8, type, 8);
    ico(progress, ac.icon, S.screenPad + 26, wy + 2, 16, ac.color);

    t(progress, label, S.screenPad + 52, wy, 13, C.text, "Semi Bold", 110);
    t(progress, caption, S.screenPad + 52, wy + 17, 10, C.secondary, "Regular", 180);
    t(progress, value, 310, wy + 2, 13, isNeg ? C.negative : C.text, "Semi Bold", 62, "RIGHT");
  });

  trendChart(progress, S.screenPad, 456, 353, 140);

  const snapY = 610;

  card(progress, S.screenPad, snapY, 353, 118, S.radius.md);
  t(progress, "Asset class snapshot", S.screenPad + 14, snapY + 12, 14, C.text, "Semi Bold", 200);

  [
    ["equity", "Equity", "₹12,45,000", "62.6%"],
    ["debt", "Debt", "₹3,22,000", "16.2%"],
    ["crypto", "Crypto", "₹1,20,000", "6.0%"],
    ["cash", "Cash", "₹3,25,470", "16.3%"],
  ].forEach(([type, label, value, pct], i) => {
    const sy = snapY + 42 + i * 18;

    assetDot(progress, S.screenPad + 14, sy + 5, type, 7);
    t(progress, label, S.screenPad + 28, sy, 12, C.text, "Medium", 70);
    t(progress, value, 250, sy, 12, C.text, "Regular", 80, "RIGHT");
    t(progress, pct, 340, sy, 12, C.secondary, "Regular", 36, "RIGHT");
  });

  nav(progress, "Progress");

  // ──────────────────────────────────────────────────────────────
  // SCREEN 6 — SETTINGS
  // ──────────────────────────────────────────────────────────────
  const settings = screen("6. Settings", 2144);

  header(settings, "Settings", "Local-first controls");
  ico(settings, "info", 350, 66, 18, C.secondary);

  let sy = 128;

  function settingsSection(title, rows) {
    t(settings, title, S.screenPad, sy, 13, C.secondary, "Semi Bold", 160);
    sy += 24;

    const sH = rows.length * 48;

    card(settings, S.screenPad, sy, 353, sH, S.radius.lg);

    rows.forEach(([label, value, valueColor, iconName], i) => {
      const ry = sy + i * 48;

      if (i > 0) {
        line(settings, S.screenPad + 14, ry, 325, C.border, 0.25);
      }

      if (iconName) {
        ico(settings, iconName, S.screenPad + 14, ry + 14, 18, C.secondary);
        t(settings, label, S.screenPad + 42, ry + 15, 13, C.text, "Medium", 160);
      } else {
        t(settings, label, S.screenPad + 14, ry + 15, 13, C.text, "Medium", 190);
      }

      if (value) {
        t(settings, value, 340, ry + 15, 12, valueColor || C.secondary, "Regular", 90, "RIGHT");
        ico(settings, "chevron", 346, ry + 14, 16, C.muted);
      }
    });

    sy += sH + 18;
  }

  settingsSection("PRIVACY", [
    ["Local storage", "Active", C.positive, "shield"],
    ["Account", "None", C.secondary, null],
    ["Analytics", "Off", C.secondary, null],
  ]);

  settingsSection("DISPLAY", [
    ["Value masking", "Off", C.secondary, "eye"],
    ["Display mode", "Standard", C.green, null],
    ["Base currency", "INR  ₹", C.secondary, null],
  ]);

  settingsSection("QUOTES", [
    ["Live quotes", "15 min", C.secondary, "refresh"],
    ["Manual fallback", "Enabled", C.positive, null],
    ["Last updated", "2m ago", C.secondary, null],
  ]);

  settingsSection("APP", [
    ["Density", "Standard", C.secondary, null],
    ["Version", "1.0.0", C.secondary, null],
  ]);

  rect(settings, S.screenPad, sy, 353, 44, S.radius.md, C.bg, C.negative, 0.4);
  t(settings, "Clear local data", S.screenPad + 14, sy + 14, 13, C.negative, "Medium", 180);
  t(settings, "Permanently deletes all holdings", 304, sy + 14, 11, C.muted, "Regular", 154, "RIGHT");

  nav(settings, "Settings");

  // ─── PAGE TITLE ──────────────────────────────────────────────
  t(page, "CogVest — V1 UI Concepts", 24, 24, 28, C.text, "Bold", 900);
  t(
    page,
    "6 screens · Dashboard · Holdings · Add Holding · Cash · Progress · Settings · Quick actions moved to header · Bottom nav is navigation only",
    24,
    62,
    13,
    C.secondary,
    "Regular",
    1300
  );

  // ─── VIEWPORT ────────────────────────────────────────────────
  figma.viewport.scrollAndZoomIntoView([
    dashboard,
    holdings,
    addTrade,
    cash,
    progress,
    settings,
  ]);

  figma.closePlugin("✓ CogVest V1 screens generated — quick actions moved to header.");
}

main().catch((err) => figma.closePlugin(`Failed: ${err.message}`));
