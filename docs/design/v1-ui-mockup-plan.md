# V1 UI Mockup Plan

Figma: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d

## Design System

- Android frame: 390 x 844.
- Background: `#1C1B1F`.
- Card background: `#2A2930`.
- Elevated card: `#312F36`.
- Primary green: `#2E7D52`.
- Text primary: `#E6E1E5`.
- Text secondary: `#CAC4D0`.
- Border: `rgba(255,255,255,0.08)`.
- Radius: 12px for cards, 16px for primary buttons.
- No coloured shadows.

## Screens

### Empty Dashboard

Show total `₹0.00`, no allocation, and a strong `Add Trade` CTA. Empty copy should explain that holdings are created from trades.

### Filled Dashboard

Show portfolio value, day change, allocation summary, quote freshness, basic conviction nudge, and Add Trade CTA. Do not show Minimal Mode or LTCG.

### Add Trade

Top segmented control for Buy/Sell. Asset field, quantity, price, total, date, optional fees, optional conviction row, optional note, sticky Review Trade button.

### Holdings Empty

Show empty card with “No holdings yet” and CTA to Add Trade.

### Holdings Filled

Holding card rows: asset name/symbol, quantity, average cost, current value, unrealised P&L, quote freshness. No LTCG badge in V1.

### Cash Empty/Filled

Hero cash balance, Add Cash and Withdraw buttons, entry history rows.

### Settings

Value masking toggle, quote refresh note, local-first privacy copy, app version placeholder.

### Value Masking

Mask INR wealth values with `₹**** **,***.**`. Do not mask quantities, percentages, or market price per unit.

## Interactions

- Pressable opacity feedback at 0.75.
- Haptics on Add Trade confirm and value masking toggle.
- Pull-to-refresh on Dashboard/Holdings.
- Clear error text for invalid sell quantity and quote failures.

## Manual Figma Recreation Notes

Use the real Figma file as the primary reference. If it is unavailable, recreate screens with the layout order above, 16px horizontal padding, 10px card gap, and 12px internal spacing.
