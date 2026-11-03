import { z } from "zod";
import { decimal } from "@/src/domain/precision";
import { validateUsdmFuturesAccount } from "@/src/domain/usdmFutures";

import {
  calendarDateSchema,
  finiteNumberSchema,
  nonEmptyStringSchema,
} from "./persistedRecordSchemas";

// Persisted shapes of snapshots, PPF, preferences, payouts and Futures accounts.

export const historicalPriceBasisSchema = z.enum([
  "historical-close",
  "reconciled-historical-close",
  "cached-historical-close",
  "latest-local-fallback",
  "manual-fallback",
  "demerger-cost-basis",
  "unavailable",
]);

export const monthlySnapshotSchema = z.object({
  cashValue: finiteNumberSchema,
  cryptoValue: finiteNumberSchema,
  debtValue: finiteNumberSchema,
  equityValue: finiteNumberSchema,
  generated: z
    .object({
      confidence: z.enum(["confirmed", "provisional"]).optional(),
      generatedAt: nonEmptyStringSchema,
      priceBasis: z.union([historicalPriceBasisSchema, z.literal("mixed")]),
      priceEvidence: z
        .array(
          z.object({
            assetId: nonEmptyStringSchema,
            basis: historicalPriceBasisSchema,
            price: finiteNumberSchema.optional(),
          }),
        )
        .optional(),
      source: z.enum(["auto", "manual"]),
      warnings: z.array(z.string()),
    })
    .optional(),
  id: nonEmptyStringSchema,
  investedValue: finiteNumberSchema,
  month: nonEmptyStringSchema,
  monthlyExpense: finiteNumberSchema.nonnegative().optional(),
  monthlyInvestment: finiteNumberSchema,
  notes: z.string().optional(),
  performanceBasis: z
    .union([
      z.object({
        netExternalFlow: finiteNumberSchema,
        status: z.literal("complete"),
        warnings: z.array(z.string()),
        weightedExternalFlow: finiteNumberSchema,
      }),
      z.object({
        reason: z.enum([
          "ambiguous-cash-flow",
          "legacy-snapshot",
          "manual-snapshot",
          "ppf-reconciliation",
          "unknown-opening-position-date",
        ]),
        status: z.literal("unavailable"),
        warnings: z.array(z.string()),
      }),
    ])
    .optional(),
  portfolioValue: finiteNumberSchema,
  salary: finiteNumberSchema.nonnegative().optional(),
});

export const ppfOpeningSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("date"),
      openedOn: calendarDateSchema,
    })
    .strict(),
  z
    .object({
      financialYearStart: z.number().int(),
      kind: z.literal("financialYear"),
    })
    .strict(),
]);

export const ppfAccountSchema = z
  .object({
    accountNumberSuffix: z.string().regex(/^\d{2,4}$/).optional(),
    balanceAsOf: calendarDateSchema,
    baselineFinancialYearContributions: z
      .object({
        amount: finiteNumberSchema.nonnegative(),
        financialYearStart: z.number().int(),
      })
      .strict()
      .optional(),
    confirmedBalance: finiteNumberSchema.nonnegative(),
    confirmedExtensionStartFinancialYear: z.number().int().optional(),
    createdAt: z.string().datetime({ offset: true }),
    id: nonEmptyStringSchema,
    legacyAssetId: nonEmptyStringSchema.optional(),
    nickname: nonEmptyStringSchema,
    opening: ppfOpeningSchema,
    provider: nonEmptyStringSchema,
    status: z.enum([
      "active",
      "discontinued",
      "matured",
      "extendedWithContributions",
      "continuedWithoutContributions",
    ]),
  })
  .strict();

export const ppfLedgerBaseSchema = z.object({
  accountId: nonEmptyStringSchema,
  date: calendarDateSchema,
  id: nonEmptyStringSchema,
  notes: z.string().optional(),
  recordedAt: z.string().datetime({ offset: true }),
});

export const fundingSourceSchema = z.enum(["cash", "external"]);

export const ppfLedgerEntrySchema = z.discriminatedUnion("type", [
  ppfLedgerBaseSchema
    .extend({ amount: finiteNumberSchema.positive(), fundingSource: fundingSourceSchema.optional(), type: z.literal("contribution") })
    .strict(),
  ppfLedgerBaseSchema
    .extend({
      amount: finiteNumberSchema.positive(),
      financialYearStart: z.number().int(),
      type: z.literal("interestCredit"),
    })
    .strict(),
  ppfLedgerBaseSchema
    .extend({ amount: finiteNumberSchema.positive(), fundingSource: fundingSourceSchema.optional(), type: z.literal("withdrawal") })
    .strict(),
  ppfLedgerBaseSchema
    .extend({
      confirmedBalance: finiteNumberSchema.nonnegative(),
      reason: nonEmptyStringSchema,
      type: z.literal("reconciliation"),
    })
    .strict(),
]);

export const preferencesSchema = z
  .object({
    appearance: z.enum(["system", "light", "dark"]).optional(),
    defaultChartRange: z
      .enum(["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"])
      .optional(),
    displayMode: z.enum(["minimal", "standard"]).optional(),
    hasCompletedOnboarding: z.boolean().optional(),
    maskWealthValues: z.boolean().optional(),
    nudgeVersions: z.object({
      metadata: z.number().int().positive().optional().catch(undefined),
      minimal: z.number().int().positive().optional().catch(undefined),
      insights: z.number().int().positive().optional().catch(undefined),
    }).catch({}).optional(),
  })
  .optional();

export const schemaVersionSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
  z.literal(13),
  z.literal(14),
  z.literal(15),
  z.literal(16),
  z.literal(17),
  z.literal(18),
]);

// D9: inception has no opening value or fingerprint; an opening value is the sum of its lines.
export const measurementBasisSchema = z.object({
  confirmedAt: z.string().datetime({ offset: true }),
  evidenceDigest: z.string().regex(/^[0-9a-f]{16}$/).nullable(),
  kind: z.enum(["inception", "openingValue"]),
  openingBreakdown: z.array(z.object({ label: nonEmptyStringSchema, valueInr: finiteNumberSchema.nonnegative() }).strict()).max(100),
  openingValueInr: finiteNumberSchema.nonnegative().nullable(),
  startDate: calendarDateSchema,
}).strict().superRefine((basis, context) => {
  const valid = basis.kind === "inception"
    ? basis.openingValueInr === null && basis.openingBreakdown.length === 0 && basis.evidenceDigest === null
    : basis.openingValueInr !== null && basis.openingBreakdown.length > 0 && basis.evidenceDigest !== null &&
      basis.openingBreakdown.reduce((sum, line) => sum.plus(line.valueInr), decimal(0)).equals(basis.openingValueInr);
  if (!valid) context.addIssue({ code: "custom", message: "Measurement basis is inconsistent." });
});

export const distributionSchema = z.object({
  assetId: nonEmptyStringSchema,
  grossAmount: finiteNumberSchema,
  id: nonEmptyStringSchema,
  linkedCashEntryId: nonEmptyStringSchema.optional(),
  linkedTradeId: nonEmptyStringSchema.optional(),
  notes: z.string().optional(),
  paidOn: calendarDateSchema,
  recordedAt: nonEmptyStringSchema,
  taxWithheld: finiteNumberSchema,
  treatment: z.enum(["paidToCash", "paidOutside", "reinvested"]),
}).strict();
export const distributionCoverageSchema = z.object({
  assetId: nonEmptyStringSchema,
  confirmedAt: nonEmptyStringSchema,
  from: calendarDateSchema,
}).strict();

export const nativeFuturesAmountSchema = z.string().regex(/^-?\d+(?:\.\d{1,8})?$/);
export const nonnegativeFuturesAmountSchema = z.string().regex(/^\d+(?:\.\d{1,8})?$/);
export const positiveFuturesAmountSchema = z.string().regex(/^\d+(?:\.\d{1,8})?$/).refine((value) => Number(value) > 0);
export const futuresContractSchema = z.string().regex(/^[A-Z0-9]+USDT$/);
export const futuresEventBaseSchema = z.object({ id: nonEmptyStringSchema, at: nonEmptyStringSchema });
export const futuresEventSchema = z.discriminatedUnion("type", [
  futuresEventBaseSchema.extend({
    type: z.literal("execution"), contract: futuresContractSchema,
    side: z.enum(["buy", "sell"]), quantity: positiveFuturesAmountSchema,
    price: positiveFuturesAmountSchema, feeUsdt: nonnegativeFuturesAmountSchema,
    leverage: positiveFuturesAmountSchema.optional(),
  }).strict(),
  futuresEventBaseSchema.extend({
    type: z.literal("funding"), contract: futuresContractSchema,
    amountUsdt: nativeFuturesAmountSchema,
  }).strict(),
  futuresEventBaseSchema.extend({
    type: z.literal("transfer"), transferBoundary: z.enum(["internal", "external"]),
    amountUsdt: nativeFuturesAmountSchema, linkedCashEntryId: nonEmptyStringSchema.optional(),
    cashDate: calendarDateSchema.optional(),
    conversionFeeInr: nonnegativeFuturesAmountSchema.optional(),
  }).strict(),
]);
export const futuresRateSchema = z.object({
  inrPerUsdt: positiveFuturesAmountSchema,
  observedAt: nonEmptyStringSchema,
  source: nonEmptyStringSchema,
}).strict();
export const futuresMarkSchema = z.object({
  contract: futuresContractSchema,
  priceUsdt: positiveFuturesAmountSchema,
  reportedMarginUsdt: nonnegativeFuturesAmountSchema.optional(),
  observedAt: nonEmptyStringSchema,
  source: nonEmptyStringSchema,
}).strict();
export const futuresAccountSchema = z.object({
  id: nonEmptyStringSchema,
  settlementAsset: z.literal("USDT"),
  marginMode: z.literal("cross"),
  positionMode: z.literal("one-way"),
  openingAt: nonEmptyStringSchema,
  openingWalletUsdt: nativeFuturesAmountSchema,
  openingRate: futuresRateSchema.optional(),
  events: z.array(futuresEventSchema).max(10_000),
  eventRates: z.array(futuresRateSchema.extend({ eventId: nonEmptyStringSchema }).strict()).max(10_000).optional(),
  valuation: z.object({
    asOf: nonEmptyStringSchema,
    marks: z.array(futuresMarkSchema).max(1_000),
    inrRate: futuresRateSchema,
    reconciliation: z.object({
      observedWalletUsdt: nativeFuturesAmountSchema,
      observedAt: nonEmptyStringSchema,
      source: nonEmptyStringSchema,
      allOpenPositionsConfirmed: z.boolean(),
      allWalletEventsConfirmed: z.boolean(),
      portfolioBoundaryConfirmed: z.boolean().optional(),
    }).strict(),
  }).strict().optional(),
}).strict().superRefine((account, context) => {
  try {
    validateUsdmFuturesAccount(account);
  } catch {
    context.addIssue({ code: "custom", message: "Futures account ledger is invalid." });
  }
});

