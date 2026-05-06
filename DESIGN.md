# CogVest Design System

CogVest is a calm, premium, Android-first investing app for long-term portfolio
tracking. The interface should feel disciplined, local-first, low-noise, and
trustworthy. It should help a user understand their investments without pushing
them into trading behavior.

Use Material 3 as the usability foundation, but do not ship a generic Material
template. CogVest should feel quieter, more deliberate, and more portfolio-led
than a standard finance dashboard.

Every UI task must follow this document unless the issue explicitly says
otherwise.

## 1. Visual Theme & Atmosphere

CogVest should feel like a private portfolio room, not a trading floor.

The visual atmosphere is:

- Calm: surfaces are dark, stable, and low-contrast enough to reduce fatigue.
- Premium: spacing, alignment, and typography are precise; nothing feels rushed.
- Disciplined: every element has a purpose and every number has context.
- Local-first: the app feels personal and private, not social or cloud-centric.
- Fintech: numbers are readable, states are clear, and money movement is obvious.
- Android-native: navigation, touch targets, gestures, and system behavior fit Android.
- Long-term investing focused: the UI emphasizes holdings, progress, and allocation over short-term price action.

Design inspiration:

- Linear: calm precision, quiet surfaces, restrained density.
- Wise and Revolut: financial clarity and directness.
- Apple: whitespace, restraint, and confidence.
- Stripe: elegant hierarchy and polished information architecture.
- CogVest identity: green accent, behavioural discipline, and local-first trust.

Do not copy any brand directly. Use the references only as directional cues.

## 2. Color Palette & Roles

Use these colors as the canonical CogVest palette.

| Token | Hex | Role |
| --- | --- | --- |
| Background | `#000000` | OLED root canvas and app background |
| Surface | `#1C1C1E` | Default cards, panels, grouped content |
| Elevated Surface | `#2C2C2E` | Inputs, active cards, selected panels, action wells |
| Primary Text | `#F5F5F7` | Headings, primary values, selected labels |
| Secondary Text | `#98989D` | Body copy, labels, supporting metrics |
| Muted Text | `#636366` | Captions, timestamps, empty-state helper text |
| Primary Green | `#34C759` | Main CTA, active tab, selected state, positive brand emphasis |
| Deep Green | `#248A3D` | Pressed states and selected backgrounds |
| Separator | `rgba(255,255,255,0.10)` | Hairline separators only when needed |
| Positive | `#34C759` | Gains, positive returns, successful states |
| Warning | `#F59E0B` | Incomplete data, stale quotes, non-blocking risk |
| Negative | `#FF453A` | Losses, destructive actions, validation errors |

Rules:

- Green is an accent, not decoration.
- Use green to signal brand, progress, selected state, and clear positive outcomes.
- Do not flood dashboards with green.
- Avoid saturated gradient cards unless an issue explicitly asks for them.
- Use `Positive` and `Negative` only for financial state, not generic ornament.
- Warning should be sparse and explanatory, never alarming.
- Prefer borderless true-dark surfaces. Use only subtle hairline separators when structure needs extra clarity.
- Financial values must remain readable on all surfaces.
- All financial values must be maskable and INR-first.

## 3. Typography Rules

Typography should feel calm, numeric, and disciplined. Use type to create
confidence and hierarchy, not visual noise.

Preferred rules:

- Use the app's configured font system consistently.
- Avoid too many font weights on one screen.
- Prefer clear type-size changes over aggressive color changes.
- Financial values need tabular or visually stable numerals where available.
- Headings should be confident but not oversized.
- Labels should be legible and close to the value they describe.
- Captions should clarify data freshness, input meaning, or privacy.

Suggested hierarchy:

| Role | Use |
| --- | --- |
| Display value | Portfolio total, cash balance, major KPI |
| Screen title | Dashboard, Holdings, Add Trade, Cash, Settings |
| Section title | Allocation, Quote freshness, Trade details |
| Body | Explanatory copy and insight text |
| Label | Field labels and metric labels |
| Caption | Timestamps, helper text, stale data notes |

Numeric formatting:

- Use INR formatting by default.
- Use explicit signs for P&L where useful.
- Percentages should be precise enough to be useful but not overfit.
- Do not show excessive decimal precision.
- Masked values should keep layout stable.

## 4. Component Styling

Components should feel tactile, quiet, and clearly Android-native.

Cards:

- Use spacious borderless cards with 16-20px radius.
- Prefer `Surface` for standard cards and `Elevated Surface` for interactive or nested surfaces.
- Use consistent large radii that feel closer to continuous/squircle curves than sharp Material boxes.
- Avoid coloured card shadows.
- Avoid dense card grids unless the screen is explicitly analytical.

Buttons:

- Primary actions use `Primary Green`.
- Secondary actions use elevated neutral surfaces or subtle hairline separators.
- Destructive actions use `Negative` only when the action is genuinely destructive.
- Button labels should be direct: `Add Trade`, `Save`, `Refresh Quotes`, `Add Cash`.
- Avoid marketing-style CTA language.

Inputs:

- Inputs use `Elevated Surface`, clear labels, and subtle separators only where needed.
- Validation errors use `Negative` with concise copy.
- Keep finance inputs explicit: quantity, price per unit, fees, date, currency.
- Preserve keyboard ergonomics on Android.

Navigation:

- Bottom tabs should be stable and predictable.
- Active tab uses green sparingly.
- The Add action can be visually prominent, but not playful.
- Avoid hidden critical navigation.

Insight Cards:

- Behaviour insights should be non-judgmental and reflective.
- Use neutral language: "You tend to...", "This may indicate...", "Consider reviewing..."
- Never shame the user for losses, selling, conviction changes, or inactivity.
- Prefer one useful insight over multiple weak cards.

Financial States:

- Gains can use `Positive`; losses can use `Negative`.
- Losses should not dominate the screen.
- Quote failures should explain fallback state calmly.
- Stale quotes should be visible but not urgent unless blocking.

## 5. Layout Principles

CogVest layouts should be readable at a glance and calm under repeated use.

Rules:

- Lead with the most important portfolio state.
- Place actions near the context they affect.
- Keep screens vertically scannable.
- Group related metrics in cards.
- Prefer fewer, clearer sections over many small widgets.
- Use whitespace as a privacy and calmness tool.
- Avoid noisy dashboards.
- Avoid a trading-app layout with flashing prices, market tickers, or dense watchlists.

Spacing:

- Use generous padding around cards.
- Keep section gaps consistent.
- Do not squeeze numeric tables to imitate Excel.
- If data becomes dense, use progressive disclosure rather than shrinking type.

Dashboard:

- Portfolio value is primary.
- Allocation is secondary.
- Quote freshness is informational.
- Behaviour/conviction state is reflective, not urgent.

Holdings:

- Prioritize current value, invested value, P&L, and allocation.
- Keep quantity and average cost readable.
- Use metadata such as sector and instrument type as supporting context.

Forms:

- Use stepwise grouping: asset, trade details, conviction, review.
- Avoid long unbroken forms.
- Keep review before save for financial entries.

## 6. Depth & Elevation

Depth should be quiet and structural.

Rules:

- Use OLED black background with dark surface shifts before shadows.
- Avoid solid card borders. Use `Separator` hairlines only for internal dividers or rare edge clarity.
- Shadows should be rare and subtle.
- Do not use coloured shadows.
- Elevation should imply interaction or grouping, not decoration.
- The background should stay visually stable across screens.

Recommended hierarchy:

- Background: root app canvas.
- Surface: default card.
- Elevated Surface: inputs, selected panels, nested cards.
- Separator: subtle internal grouping and scannability.
- Green accent: selected/action state only.

## 7. Motion Rules

Motion should reduce cognitive load, not add energy.

Rules:

- Use motion sparingly.
- Motion should confirm transitions, selection, save success, or refresh state.
- Prefer short, soft easing.
- Avoid bouncy, playful, or gamified motion.
- Avoid market-style flashing updates.
- Do not animate financial values in a way that creates trading urgency.
- Respect platform accessibility settings for reduced motion.

Good motion:

- Subtle screen entry.
- Button press feedback.
- Smooth card reveal after data loads.
- Pull-to-refresh progress.
- Mask/unmask transition that preserves privacy.

Bad motion:

- Flashing P&L.
- Confetti after trades.
- Aggressive chart movement.
- Animated price tickers.

## 8. Screen-Level Rules

Dashboard:

- Must feel calm on app open.
- Show portfolio value, allocation, quote freshness, and a small reflective cue.
- Do not turn the dashboard into a trading terminal.
- Avoid more than one primary call to action.

Holdings:

- Show holdings as durable positions, not quick trades.
- Include current value, invested value, P&L, P&L %, and allocation where appropriate.
- Metadata such as instrument type and sector should support understanding without crowding.

Add Trade / Add Holding:

- Use clear sectioning and direct labels.
- Financial entry must be reviewable before save.
- Opening positions should feel like migration from Excel, not a workaround.

Cash:

- Treat cash as part of portfolio value.
- Additions and withdrawals should be clear and auditable.
- Cash history should be simple and readable.

Settings:

- Settings should reinforce local-first privacy.
- Value masking should be obvious and reliable.
- Keep release/build/technical notes secondary.

Progression:

- Monthly progression should feel like long-term tracking, not performance pressure.
- Show trend, monthly contribution, cash, and savings context with restraint.
- Avoid noisy historical charts in V1 unless explicitly scoped.

Minimal Mode:

- Minimal Mode should reduce emotional noise.
- It should not remove core functionality.
- It should soften colour, hide sensitive values if enabled, reduce P&L prominence,
  and emphasize long-term framing.

## 9. Do's and Don'ts

Do:

- Make financial values readable, maskable, and INR-first.
- Use green as a disciplined accent.
- Use spacious cards and clear hierarchy.
- Keep copy calm and non-judgmental.
- Show stale/fallback data clearly.
- Respect Android navigation and touch expectations.
- Prefer durable portfolio language over trading language.
- Make empty states useful and direct.

Don't:

- Do not make the app look like a trading app or crypto exchange.
- Do not use flashy gradients, neon accents, or dense market widgets.
- Do not overuse green.
- Do not use red/green everywhere.
- Do not shame the user with behavioural insights.
- Do not hide important calculations behind vague labels.
- Do not use tiny table text to copy Excel density.
- Do not add social, gamified, leaderboard, streak, or notification-driven UI.
- Do not introduce generic Material screens without CogVest-specific hierarchy.

## 10. Accessibility

Accessibility is part of the design system, not a final pass.

Rules:

- Maintain sufficient contrast for text and financial values.
- Touch targets should be at least Android-recommended minimum size.
- All interactive controls need clear labels.
- Value masking must be reliable and visible.
- Do not rely on colour alone for P&L state.
- Pair positive/negative colour with signs, labels, or text.
- Error messages should explain the fix.
- Forms should be usable with the Android keyboard visible.
- Support reduced motion.
- Avoid tiny captions for critical financial information.

Financial accessibility:

- Currency, quantity, average cost, and current value should be distinguishable.
- Percentages should include `%`.
- INR values should use `₹`.
- Masked values should not leak precision or magnitude through layout where avoidable.

## 11. Android-Specific Rules

CogVest is Android-first.

Rules:

- Use Android-native navigation expectations.
- Bottom tabs should be reachable and stable.
- Preserve safe areas and system UI readability.
- Avoid iOS-only visual assumptions.
- Test important screens on the Android Emulator.
- Ensure keyboard behavior does not hide primary form actions.
- Use `testID`s for stable Maestro E2E flows.
- Keep local APK install testing part of V1 verification.
- Do not assume a physical phone is required.

Material 3 usage:

- Use Material 3 principles for usability, spacing, states, and interaction.
- Do not blindly copy default Material component appearances.
- CogVest surfaces should feel quieter and more premium than stock templates.

## 12. Agent Prompt Guide

Use this guide when asking Codex or any design agent to work on CogVest UI.

Default prompt prefix:

```text
Follow DESIGN.md. CogVest should feel calm, premium, disciplined, local-first,
Android-native, low-noise, fintech, and long-term investing focused. Use
Material 3 usability foundations without making the screen look like a generic
Material template. Green is an accent, not decoration.
```

For dashboard work:

```text
Design this as a calm portfolio overview, not a trading dashboard. Prioritize
portfolio value, allocation, quote freshness, and reflective long-term context.
Avoid noisy widgets, flashing prices, and exchange-like layouts.
```

For holdings work:

```text
Make holdings feel like durable positions. Show current value, invested value,
P&L, P&L %, allocation, and relevant metadata clearly. Keep density controlled
and INR values readable and maskable.
```

For forms:

```text
Use grouped, Android-friendly form sections with clear labels and review-before-save
for financial entries. The keyboard must not block critical actions.
```

For behaviour insights:

```text
Use non-judgmental, reflective language. The insight should help the user
understand patterns without creating shame, urgency, or trading pressure.
```

For Minimal Mode:

```text
Reduce emotional noise. Lower P&L prominence, soften colour, preserve core
functionality, and emphasize long-term framing. Minimal Mode is a display
preference, not a restricted app mode.
```

For Excel tracker parity:

```text
Preserve the user's spreadsheet mental model while making it calmer and more
mobile-native. Do not copy Excel density. Translate holdings, allocation,
sector/instrument context, cash, and monthly progression into spacious,
readable mobile screens.
```

Design review checklist for agents:

- Does the screen follow the CogVest palette?
- Is green used only as an accent?
- Are financial values readable, maskable, and INR-first?
- Does the screen avoid trading-app energy?
- Is hierarchy clear within five seconds?
- Are Android keyboard, touch, and navigation constraints handled?
- Are behavioural messages non-judgmental?
- Is the UI calmer than the Excel tracker while preserving its core information?
