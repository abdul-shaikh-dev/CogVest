# SIP Templates Contract (#766)

A SIP template is a reminder for a purchase the user makes every month. It
never records anything on its own. Each due instalment waits until the user
confirms it as one purchase or skips it.

## Record

`sipTemplates` is a list of up to 50 templates. Each holds:

- the holding (`assetId`), which must exist
- the amount in INR (above 0, at most two decimal places)
- the day of the month (1 to 31)
- the first month (`YYYY-MM`)
- the funding: `cash` or `deposit`
- whether it is paused
- the handled months, each `confirmed` (with the purchase's trade id) or
  `skipped`

Adding the list raised the saved-data version to V21. Older data and backups
migrate with an empty list. Backups carry the templates, and a template that
breaks these rules, or names a missing holding, is rejected. Deleting a
holding deletes its templates.

## Due instalments

An instalment falls on the template's day each month. When the month is
shorter, it falls on the month's last day. It is due once its date has
arrived, from the first month onward, unless that month is confirmed or
skipped. A paused template has no due instalments. Missed months stay listed,
oldest first, until the user handles each one. If the purchase that confirmed
a month is deleted, that month is due again.

## Confirming

Confirming records one purchase through the same checks as Record Purchase:
the trade, its linked Cash withdrawal and refreshed snapshots, in the same
save as the month's `confirmed` mark. A `deposit` template first adds a Cash
deposit for the purchase total on the purchase date (`capitalContribution`),
so Cash ends unchanged. A `cash` template pays from Cash already recorded and
is refused when Cash cannot cover it. Nothing is saved when the purchase
fails.

The confirm form suggests a price from daily history: AMFI NAV for funds,
Yahoo closes for shares and ETFs. It uses the first price on or after the due
date, so a holiday takes the next trading day, and says which date it used.
Units are the amount divided by the price, rounded down to three decimal
places for funds and to whole units for shares and ETFs. The user can change
the date, price and units. Without a price, the user enters one.

## Display

Templates are managed from Settings, under Investment tools. A Dashboard card
counts the due instalments and opens the list, where each can be confirmed or
skipped. Masking hides the amounts.
