# Issue #135 Settings Parity Design Spec

## Goal

Bring the Settings screen into accepted V1 design and capability parity by
making it a compact local-first trust surface, not a miscellaneous control dump.

Settings should answer, within the first visible area:

- Is my portfolio data local?
- Is value masking available?
- Are quote sources/fallbacks transparent?
- Are destructive or unsupported actions protected?

## Source Of Truth

This spec is based on the approved Settings preview:

`G:\Projects\2026\cool_projects\CogVest\.superpowers\brainstorm\issue-135-settings-parity\content\settings-trust-first-v1.html`

The implementation must also respect:

- `DESIGN.md`
- `docs/design/v1-screen-baseline.md`
- `docs/design/v1-ux-research-baseline.md`
- GitHub issue #135

The preview is a visual direction, not a pixel-perfect mandate. The React Native
implementation should use existing CogVest components and Android-friendly
patterns rather than copying HTML/CSS literally.

## Product Principles

Settings should reinforce trust and reduce uncertainty.

The screen should feel:

- calm
- private
- local-first
- compact
- clear about what is real in V1
- honest about deferred or unsupported behavior

The screen should not feel:

- technical
- cloud-account oriented
- like a debug/status dashboard
- like a list of future features pretending to work
- visually louder than Dashboard, Holdings, Progress, or Cash

## Information Architecture

Use this hierarchy:

1. Header
2. Local-first privacy summary
3. Value masking control
4. Quote source/fallback status
5. Currency & App information
6. Deferred/destructive data action

### Header

Keep:

- title: `Settings`
- subtitle: `Local-first controls`
- small trust pill: `Local only`

The trust pill should be informational, not a button.

### Local-First Privacy Summary

The first card should communicate that CogVest V1 keeps data on device.

Use the headline:

`Your portfolio stays here`

Use supporting copy close to:

`CogVest V1 is local-first by default. The key privacy guarantees are visible at a glance.`

Show a compact checklist, not a large 2x2 grid:

- `Local storage` -> `Active`
- `Account` -> `Not required`
- `Cloud sync` -> `Off`
- `Analytics` -> `Off`

This avoids repeating the same privacy claims in paragraph and grid form.

### Value Masking

Value masking is the primary real control on this screen.

Show it as a prominent card or grouped row with:

- title: `Value masking`
- helper copy: `Hide INR wealth values in shared or public spaces.`
- masked preview: `Preview ₹••,•••`
- real switch/toggle

The toggle must use the existing `maskWealthValues` preference and remain
testable through `value-mask-toggle`.

If masking is on, the preview should communicate masked state. If masking is
off, the preview can still show the masked result so the user understands what
will happen.

### Quote Source/Fallback Status

Quotes should read as calm evidence, not an error wall.

Use section title:

`Quotes`

Use section note or helper copy:

`Freshness and fallback`

Rows:

- `Latest quote refresh`
  - value: latest quote date, or `No quotes yet`
  - meta: count of cached quote records
- `Quote source`
  - value: derived from real cache state
  - avoid the technical label `Provider status`
- `Manual fallback`
  - value: manual quote count
  - meta: manual prices remain available when quote APIs fail

Quote source values should avoid overstating capability:

- no quotes: `Waiting`
- only live quotes: `Live`
- only manual quotes: `Manual`
- live and manual quotes: `Mixed`

The underlying hook may keep richer internal names, but user-facing copy should
use the simpler labels above.

### Currency & App

Use one compact section named:

`Currency & App`

Rows:

- `Base currency`
  - value: `INR`
  - meta: `INR-first summaries across CogVest.`
- `Version`
  - value: `Preview`
  - meta: `Android preview build for V1 testing.`

Do not show foreign asset summary or USD/crypto fallback as working settings if
they are not real user controls.

Do not show Minimal Mode, LTCG, export, backup, or account/cloud settings as
working controls in V1.

### Data Action

`Clear local data` should be separated from normal settings.

For V1, this action remains disabled/deferred until a confirmation flow and
backup guidance exist.

Show:

- title: `Clear local data`
- meta: `Disabled until confirmation and backup guidance exist.`
- value/status: `Deferred`

It must not expose a tappable destructive control or `clear-local-data-button`
testID until the confirmation flow exists.

## Visual Rules

Use existing CogVest design tokens and common components where possible.

Rules:

- true black app background
- dark elevated cards
- restrained green accent only for trust/active state
- no colored glow
- no generic Material settings template
- no large repeated card grid
- no technical status wall
- no noisy badges
- compact grouped rows with clear right-side status values
- destructive/deferred row visually separated from normal settings

The HTML preview used a display/body font pairing to satisfy preview tooling.
The app implementation should follow the existing React Native font system and
not introduce a new app-wide font dependency for this issue.

## Accessibility

Requirements:

- `value-mask-toggle` remains accessible as a switch.
- Switch state must expose checked/unchecked state.
- Informational rows should not be announced as buttons.
- Deferred destructive action should not be focusable as an enabled action.
- Text contrast must remain readable on dark surfaces.
- The screen should remain usable with Android font scaling as far as current
  shared components allow.

## Data And Behavior

Settings must reflect real local state only.

Use existing preference/store data:

- `preferences.maskWealthValues`
- quote cache records
- quote source counts
- latest quote timestamp

Do not add backend, auth, cloud sync, analytics, export, backup, or clear-data
implementation in this issue.

Derived quote status should be pure and testable. It may live in
`useSettings.ts` if scoped only to Settings.

## Testing Requirements

Update or add tests for:

- privacy summary contains local storage, no account, cloud off, analytics off
- value masking toggle changes stored preference and updates accessible state
- quote source label uses `Quote source`, not `Provider status`
- mixed live/manual quote cache renders `Mixed`
- no quote cache renders `Waiting` or equivalent non-live state
- clear local data is shown as `Deferred` but is not exposed as an enabled
  button
- V2/V3 leaks remain absent: Minimal Mode, LTCG, export/backup as working
  controls

Run before PR:

```bash
npm run typecheck
npm test
```

If emulator is available, visually verify Settings after install/launch or
through the normal Expo emulator loop.

## Acceptance Criteria

- Settings starts with a compact local-first trust summary.
- Value masking is the primary real control and remains functional.
- Quote source/fallback status reflects real quote cache state.
- `Provider status` is not used as user-facing Settings copy.
- Unsupported/deferred features do not appear as working controls.
- Clear local data is separated, destructive in tone, and disabled/deferred.
- Screen follows the approved preview direction without adding new unrelated
  features.
- Typecheck and tests pass.
- Android emulator visual check is captured or a blocker is documented.

## Out Of Scope

- Implementing clear local data.
- Implementing export or backup.
- Adding cloud sync, accounts, analytics, or auth.
- Adding Minimal Mode controls.
- Adding LTCG/tax controls.
- Redesigning other screens.
- Changing core portfolio domain logic.
