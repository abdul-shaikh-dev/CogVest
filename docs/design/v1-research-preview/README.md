# CogVest V1 Research Preview

Static visual reference for the current V1 private-ledger direction.

Canonical references:

- `docs/cogvest-master-spec.md`
- `DESIGN.md`
- `docs/design/v1-ux-research-baseline.md`
- `docs/design/v1-screen-baseline.md`
- The active GitHub issue for screen-specific acceptance criteria

## Purpose

The preview demonstrates the accepted hierarchy for Dashboard, Holdings, Add
Holding, Progress, Cash Ledger, and Settings. It is a design reference only: it
uses sample data and does not prove production behavior.

Use the screen baseline for behavioral requirements. When a maintained
screen-specific preview exists under `docs/design/screens/`, it supersedes the
matching screen in this all-screen preview.

## Run

Foreground server from the repository root:

```powershell
npm run preview:v1:research
```

Open `http://127.0.0.1:4175`.

Background server commands:

```powershell
npm run preview:v1:research:start
npm run preview:v1:research:status
npm run preview:v1:research:stop
```

The background server stores its PID under `.preview-server/`. Override the
location with `COGVEST_PREVIEW_STATE_DIR` only when needed.

## Design Contract

- Answer first, evidence second, action last.
- Keep Dashboard portfolio-first and low-noise.
- Treat Holdings as position review, not a second Dashboard.
- Keep Add Holding explicit-selection-first with review before save.
- Treat Progress as a statement summary using stored monthly snapshots.
- Treat Cash Ledger as deployable capital and auditable movement.
- Use Settings to make local-first privacy and value masking clear.
- Preserve Dashboard, Holdings, Progress, Cash, and Settings as primary tabs.
- Keep Add Holding as a secondary flow from Dashboard or Holdings.
- Use real stored data or honest empty states in production; never ship the
  preview's sample values.

## Maintenance

Do not update this preview for every implementation detail. Update it only when
the accepted app-wide visual direction changes. Record screen-specific changes
in `docs/design/v1-screen-baseline.md` and the active issue; maintain a separate
screen preview only when it remains useful for future implementation review.
