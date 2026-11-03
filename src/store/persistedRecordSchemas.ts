import { z } from "zod";
import { getCalendarDatePart } from "@/src/domain/dates";

// Persisted shapes of market records: assets, cash, opening positions and trades.

export const finiteNumberSchema = z.number().finite();
export const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
export const calendarDateSchema = nonEmptyStringSchema.refine(
  (value) => getCalendarDatePart(value) === value,
);
export const normalizedIsinSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{12}$/)
  .transform((value) => value.toUpperCase());
export const convictionScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const stockSplitIsinSchema = z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/);
export const stockSplitEvidenceUrlSchema = z.string().url().refine((value) => {
  if (!value.startsWith("https://") || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    // Syntax validation is not issuer/exchange verification; catalog matching owns trust.
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
});

export const stockSplitEventSchema = z
  .object({
    id: nonEmptyStringSchema,
    kind: z.enum(["split", "bonus"]),
    effectiveDate: calendarDateSchema,
    creditedDate: calendarDateSchema.optional(),
    availableFrom: calendarDateSchema.optional(),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    oldIsin: stockSplitIsinSchema,
    newIsin: stockSplitIsinSchema,
    newShares: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    oldShares: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    evidence: z
      .object({
        url: stockSplitEvidenceUrlSchema,
        publishedDate: calendarDateSchema,
        verifiedDate: calendarDateSchema,
      })
      .strict(),
  })
  .strict()
  .refine((event) => event.kind !== "split" || event.newShares !== event.oldShares, {
    message: "Stock split ratios must not equal one.",
    path: ["newShares"],
  })
  .refine((event) => event.kind !== "bonus" || event.oldIsin === event.newIsin, {
    message: "Bonus credits must preserve the asset ISIN.",
    path: ["newIsin"],
  })
  .refine((event) => event.kind === "bonus"
    ? (event.creditedDate !== undefined) !== (event.availableFrom !== undefined)
      && (event.creditedDate ?? event.availableFrom)! >= event.effectiveDate
    : event.creditedDate === undefined && event.availableFrom === undefined, {
    message: "Bonuses require exactly one credit or availability date on or after the ex-date; splits must have neither.",
    path: ["creditedDate"],
  });

export const stockSplitsSchema = z
  .array(stockSplitEventSchema)
  .max(100)
  .superRefine((events, context) => {
    for (const field of ["id"] as const) {
      const seen = new Set<string>();
      events.forEach((event, index) => {
        if (seen.has(event[field])) {
          context.addIssue({
            code: "custom",
            message: `Stock split ${field} values must be unique per asset.`,
            path: [index, field],
          });
        }
        seen.add(event[field]);
      });
    }
    const dates = new Map<string, number[]>();
    events.forEach((event, index) => {
      dates.set(event.effectiveDate, [...(dates.get(event.effectiveDate) ?? []), index]);
    });
    for (const indices of dates.values()) {
      if (indices.length < 2) continue;
      const sequences = new Set<number>();
      for (const index of indices) {
        const sequence = events[index].sequence;
        if (sequence === undefined || sequences.has(sequence)) {
          context.addIssue({
            code: "custom",
            message: "Same-date share adjustments require explicit unique sequences.",
            path: [index, "sequence"],
          });
        }
        if (sequence !== undefined) sequences.add(sequence);
      }
    }
  });

export const assetSchema = z.object({
  assetClass: z.enum(["crypto", "debt", "stock", "etf", "cash"]),
  currency: z.enum(["INR", "USD"]),
  demerger: z
    .object({
      childAssetId: z.string().trim().min(1),
      eventId: z.string().trim().min(1),
    })
    .strict()
    .optional(),
  exchange: z.enum(["NSE", "BSE", "CRYPTO"]).optional(),
  id: nonEmptyStringSchema,
  instrumentType: z
    .enum([
      "bond",
      "cash",
      "crypto",
      "debt",
      "etf",
      "fixedDeposit",
      "liquidFund",
      "mutualFund",
      "other",
      "ppf",
      "arbitrageFund",
      "stock",
    ])
    .optional(),
  isin: normalizedIsinSchema.optional(),
  isTaxEligible: z.boolean().optional(),
  logoUrl: z.string().optional(),
  name: nonEmptyStringSchema,
  quoteSourceId: nonEmptyStringSchema.optional(),
  sectorType: z
    .enum([
      "consumer",
      "communicationServices",
      "digitalAsset",
      "diversified",
      "energy",
      "financialServices",
      "fixedIncome",
      "healthcare",
      "industrial",
      "liquidity",
      "materials",
      "other",
      "realEstate",
      "technology",
      "utilities",
    ])
    .optional(),
  stockSplits: stockSplitsSchema.optional(),
  symbol: nonEmptyStringSchema,
  ticker: nonEmptyStringSchema,
});

export const cashEntrySchema = z.object({
  amount: finiteNumberSchema,
  date: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  institution: nonEmptyStringSchema.optional(),
  label: nonEmptyStringSchema,
  linkedTradeId: nonEmptyStringSchema.optional(),
  linkedFutures: z.object({ accountId: nonEmptyStringSchema, eventId: nonEmptyStringSchema }).strict().optional(),
  linkedEpf: z.object({ accountId: nonEmptyStringSchema, eventId: nonEmptyStringSchema }).strict().optional(),
  linkedDistributionId: nonEmptyStringSchema.optional(),
  linkedPpf: z.object({ accountId: nonEmptyStringSchema, entryId: nonEmptyStringSchema }).strict().optional(),
  notes: z.string().optional(),
  // V1-V3 entries did not persist a purpose. The current migration supplies it.
  purpose: z
    .enum([
      "capitalContribution",
      "income",
      "legacyUncategorized",
      "purchaseFunding",
      "saleProceeds",
      "futuresTransfer",
      "epfTransfer",
      "distribution",
      "ppfTransfer",
      "withdrawal",
    ])
    .optional(),
  type: z.enum(["addition", "withdrawal"]),
});

export const openingPositionSchema = z
  .object({
    assetId: nonEmptyStringSchema,
    averageCostPrice: finiteNumberSchema,
    conviction: convictionScoreSchema.optional(),
    currentPrice: finiteNumberSchema.optional(),
    date: nonEmptyStringSchema.nullable(),
    id: nonEmptyStringSchema,
    intendedHoldDays: finiteNumberSchema.optional(),
    manualValuation: z
      .object({
        asOf: z.string().datetime({ offset: true }).nullable(),
        currency: z.enum(["INR", "USD"]),
        price: finiteNumberSchema,
        provenance: z.enum(["legacy", "user"]),
        source: z.literal("manual"),
      })
      .optional(),
    measuredAsOf: calendarDateSchema.optional(),
    notes: z.string().optional(),
    quantity: finiteNumberSchema,
    recordedAt: z.string().datetime({ offset: true }).optional(),
    recordedOn: calendarDateSchema.optional(),
  })
  .superRefine((position, context) => {
    if (
      position.intendedHoldDays !== undefined &&
      (!Number.isInteger(position.intendedHoldDays) ||
        position.intendedHoldDays <= 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Planned holding periods must be positive whole days.",
        path: ["intendedHoldDays"],
      });
    }

    if (
      position.date === null &&
      (position.recordedAt === undefined || position.recordedOn === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Unknown acquisition dates require stable record-time provenance.",
        path: [
          position.recordedAt === undefined ? "recordedAt" : "recordedOn",
        ],
      });
    }

    if (position.currentPrice !== undefined && position.manualValuation) {
      context.addIssue({
        code: "custom",
        message: "Opening positions cannot store two manual valuations.",
        path: ["manualValuation"],
      });
    }

    if (position.currentPrice !== undefined && position.currentPrice <= 0) {
      context.addIssue({
        code: "custom",
        message: "Legacy opening-position prices must be positive.",
        path: ["currentPrice"],
      });
    }

    if (position.manualValuation) {
      const valuation = position.manualValuation;

      if (valuation.price <= 0) {
        context.addIssue({
          code: "custom",
          message: "Manual valuation prices must be positive.",
          path: ["manualValuation", "price"],
        });
      }

      if (
        (valuation.provenance === "user" && valuation.asOf === null) ||
        (valuation.provenance === "legacy" && valuation.asOf !== null)
      ) {
        context.addIssue({
          code: "custom",
          message: "Manual valuation provenance does not match its as-of date.",
          path: ["manualValuation", "asOf"],
        });
      }
    }
  });

export const importedTransactionProvenanceSchema = z.object({
  account: z.string().optional(),
  externalId: nonEmptyStringSchema.optional(),
  fees: finiteNumberSchema.nonnegative().optional(),
  fingerprint: nonEmptyStringSchema.optional(),
  importBatchId: nonEmptyStringSchema,
  originalDescription: z.string().optional(),
  originalRowNumber: z.number().int().positive(),
  settlementDate: calendarDateSchema.optional(),
  sourceExchange: nonEmptyStringSchema.optional(),
  sourceExecutedAt: nonEmptyStringSchema.optional(),
  sourceFileIndex: z.number().int().nonnegative().optional(),
  sourceFileName: nonEmptyStringSchema.optional(),
  sourceFormat: nonEmptyStringSchema,
  sourceOrderId: nonEmptyStringSchema.optional(),
  sourceSegment: nonEmptyStringSchema.optional(),
  sourceSymbol: nonEmptyStringSchema.optional(),
  sourceIsin: normalizedIsinSchema.optional(),
  sourceVersion: nonEmptyStringSchema,
  taxes: finiteNumberSchema.nonnegative().optional(),
});

export const tradeBaseSchema = z.object({
  assetId: nonEmptyStringSchema,
  conviction: convictionScoreSchema.optional(),
  date: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  importProvenance: importedTransactionProvenanceSchema.optional(),
  intendedHoldDays: finiteNumberSchema.optional(),
  notes: z.string().optional(),
  quantity: finiteNumberSchema,
  whyThisTrade: z.string().optional(),
});

export const tradeSchema = z.discriminatedUnion("type", [
  tradeBaseSchema.extend({
    fees: finiteNumberSchema.optional(),
    fundingSource: z.literal("external").optional(),
    pricePerUnit: finiteNumberSchema,
    totalValue: finiteNumberSchema,
    type: z.literal("buy"),
  }),
  tradeBaseSchema.extend({
    fees: finiteNumberSchema.optional(),
    fundingSource: z.literal("external").optional(),
    pricePerUnit: finiteNumberSchema,
    totalValue: finiteNumberSchema,
    type: z.literal("sell"),
  }),
  tradeBaseSchema.extend({
    acquisitionCostPerUnit: finiteNumberSchema.nonnegative().optional(),
    type: z.literal("transferIn"),
  }),
  tradeBaseSchema.extend({
    type: z.literal("transferOut"),
  }),
]);

