import { z } from "zod";

import { getCalendarDatePart } from "@/src/domain/dates";
import {
  calculatePpfConfirmedBalance,
  comparePpfLedgerEntries,
  validatePpfAccount,
  validatePpfLedgerEntryForAccount,
} from "@/src/domain/ppf";

const finiteNumberSchema = z.number().finite();
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const calendarDateSchema = nonEmptyStringSchema.refine(
  (value) => getCalendarDatePart(value) === value,
);
const normalizedIsinSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{12}$/)
  .transform((value) => value.toUpperCase());
const convictionScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const assetSchema = z.object({
  assetClass: z.enum(["crypto", "debt", "stock", "etf", "cash"]),
  currency: z.enum(["INR", "USD"]),
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
  symbol: nonEmptyStringSchema,
  ticker: nonEmptyStringSchema,
});

const cashEntrySchema = z.object({
  amount: finiteNumberSchema,
  date: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  institution: nonEmptyStringSchema.optional(),
  label: nonEmptyStringSchema,
  linkedTradeId: nonEmptyStringSchema.optional(),
  notes: z.string().optional(),
  // V1-V3 entries did not persist a purpose. The current migration supplies it.
  purpose: z
    .enum([
      "capitalContribution",
      "income",
      "legacyUncategorized",
      "purchaseFunding",
      "saleProceeds",
      "withdrawal",
    ])
    .optional(),
  type: z.enum(["addition", "withdrawal"]),
});

const openingPositionSchema = z
  .object({
    assetId: nonEmptyStringSchema,
    averageCostPrice: finiteNumberSchema,
    conviction: convictionScoreSchema.optional(),
    currentPrice: finiteNumberSchema.optional(),
    date: nonEmptyStringSchema.nullable(),
    id: nonEmptyStringSchema,
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

const importedTransactionProvenanceSchema = z.object({
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
  sourceVersion: nonEmptyStringSchema,
  taxes: finiteNumberSchema.nonnegative().optional(),
});

const tradeBaseSchema = z.object({
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

const tradeSchema = z.discriminatedUnion("type", [
  tradeBaseSchema.extend({
    fees: finiteNumberSchema.optional(),
    pricePerUnit: finiteNumberSchema,
    totalValue: finiteNumberSchema,
    type: z.literal("buy"),
  }),
  tradeBaseSchema.extend({
    fees: finiteNumberSchema.optional(),
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

const historicalPriceBasisSchema = z.enum([
  "historical-close",
  "cached-historical-close",
  "latest-local-fallback",
  "manual-fallback",
  "unavailable",
]);

const monthlySnapshotSchema = z.object({
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
  monthlyExpense: finiteNumberSchema.optional(),
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
  salary: finiteNumberSchema.optional(),
});

const ppfOpeningSchema = z.discriminatedUnion("kind", [
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

const ppfAccountSchema = z
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

const ppfLedgerBaseSchema = z.object({
  accountId: nonEmptyStringSchema,
  date: calendarDateSchema,
  id: nonEmptyStringSchema,
  notes: z.string().optional(),
  recordedAt: z.string().datetime({ offset: true }),
});

const ppfLedgerEntrySchema = z.discriminatedUnion("type", [
  ppfLedgerBaseSchema
    .extend({ amount: finiteNumberSchema.positive(), type: z.literal("contribution") })
    .strict(),
  ppfLedgerBaseSchema
    .extend({
      amount: finiteNumberSchema.positive(),
      financialYearStart: z.number().int(),
      type: z.literal("interestCredit"),
    })
    .strict(),
  ppfLedgerBaseSchema
    .extend({ amount: finiteNumberSchema.positive(), type: z.literal("withdrawal") })
    .strict(),
  ppfLedgerBaseSchema
    .extend({
      confirmedBalance: finiteNumberSchema.nonnegative(),
      reason: nonEmptyStringSchema,
      type: z.literal("reconciliation"),
    })
    .strict(),
]);

const preferencesSchema = z
  .object({
    defaultChartRange: z
      .enum(["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"])
      .optional(),
    displayMode: z.enum(["minimal", "standard"]).optional(),
    hasCompletedOnboarding: z.boolean().optional(),
    maskWealthValues: z.boolean().optional(),
  })
  .optional();

const schemaVersionSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
]);

const persistedPortfolioSchema = z
  .object({
    assets: z.array(assetSchema).optional(),
    cashEntries: z.array(cashEntrySchema).optional(),
    monthlySnapshots: z.array(monthlySnapshotSchema).optional(),
    openingPositions: z.array(openingPositionSchema).optional(),
    ppfAccounts: z.array(ppfAccountSchema).optional(),
    ppfLedgerEntries: z.array(ppfLedgerEntrySchema).optional(),
    preferences: preferencesSchema,
    schemaVersion: schemaVersionSchema,
    trades: z.array(tradeSchema).optional(),
  })
  .superRefine((portfolio, context) => {
    const currencyByAssetId = new Map(
      (portfolio.assets ?? []).map((asset) => [asset.id, asset.currency]),
    );

    (portfolio.openingPositions ?? []).forEach((position, index) => {
      const assetCurrency = currencyByAssetId.get(position.assetId);

      if (
        position.manualValuation &&
        assetCurrency !== undefined &&
        position.manualValuation.currency !== assetCurrency
      ) {
        context.addIssue({
          code: "custom",
          message: "Manual valuation currency must match its asset.",
          path: ["openingPositions", index, "manualValuation", "currency"],
        });
      }
    });

    const ppfAccountIds = new Set(
      (portfolio.ppfAccounts ?? []).map((account) => account.id),
    );
    if (ppfAccountIds.size !== (portfolio.ppfAccounts ?? []).length) {
      context.addIssue({
        code: "custom",
        message: "PPF account IDs must be unique.",
        path: ["ppfAccounts"],
      });
    }
    const ppfEntryIds = new Set(
      (portfolio.ppfLedgerEntries ?? []).map((entry) => entry.id),
    );
    if (ppfEntryIds.size !== (portfolio.ppfLedgerEntries ?? []).length) {
      context.addIssue({
        code: "custom",
        message: "PPF ledger entry IDs must be unique.",
        path: ["ppfLedgerEntries"],
      });
    }
    const linkedLegacyAssetIds = (portfolio.ppfAccounts ?? [])
      .map((account) => account.legacyAssetId)
      .filter((assetId): assetId is string => assetId !== undefined);
    if (new Set(linkedLegacyAssetIds).size !== linkedLegacyAssetIds.length) {
      context.addIssue({
        code: "custom",
        message: "A legacy PPF holding can be linked to only one account.",
        path: ["ppfAccounts"],
      });
    }
    const assetsById = new Map(
      (portfolio.assets ?? []).map((asset) => [asset.id, asset]),
    );
    (portfolio.ppfAccounts ?? []).forEach((account, index) => {
      if (!validatePpfAccount(account).isValid) {
        context.addIssue({
          code: "custom",
          message: "PPF account lifecycle is invalid.",
          path: ["ppfAccounts", index],
        });
      }
      if (
        account.legacyAssetId !== undefined &&
        assetsById.get(account.legacyAssetId)?.instrumentType !== "ppf"
      ) {
        context.addIssue({
          code: "custom",
          message: "Linked legacy asset must be a persisted PPF holding.",
          path: ["ppfAccounts", index, "legacyAssetId"],
        });
      }
    });
    (portfolio.ppfLedgerEntries ?? []).forEach((entry, index) => {
      if (!ppfAccountIds.has(entry.accountId)) {
        context.addIssue({
          code: "custom",
          message: "PPF ledger entries must reference a persisted account.",
          path: ["ppfLedgerEntries", index, "accountId"],
        });
      }
    });
    for (const account of portfolio.ppfAccounts ?? []) {
      const accountEntries = (portfolio.ppfLedgerEntries ?? [])
        .filter((entry) => entry.accountId === account.id)
        .sort(comparePpfLedgerEntries);
      for (let index = 0; index < accountEntries.length; index += 1) {
        const entry = accountEntries[index];
        if (!validatePpfLedgerEntryForAccount(account, entry).isValid) {
          context.addIssue({
            code: "custom",
            message: "PPF ledger timeline is invalid.",
            path: ["ppfLedgerEntries"],
          });
          break;
        }
        if (
          calculatePpfConfirmedBalance(
            account,
            accountEntries.slice(0, index + 1),
            entry.date,
          ).confirmedBalance < 0
        ) {
          context.addIssue({
            code: "custom",
            message: "PPF ledger cannot produce a negative balance.",
            path: ["ppfLedgerEntries"],
          });
          break;
        }
      }
    }
  });

const quoteSchema = z.object({
  assetId: nonEmptyStringSchema,
  asOf: nonEmptyStringSchema,
  currency: z.enum(["INR", "USD"]),
  dayChangeAbs: finiteNumberSchema.optional(),
  dayChangePct: finiteNumberSchema.optional(),
  price: finiteNumberSchema,
  source: z.enum(["yahoo", "coingecko", "manual"]),
});

const historicalQuoteSchema = z.object({
  assetId: nonEmptyStringSchema,
  asOfMonth: nonEmptyStringSchema,
  basis: historicalPriceBasisSchema,
  currency: z.enum(["INR", "USD"]),
  fetchedAt: nonEmptyStringSchema,
  price: finiteNumberSchema,
  source: z.enum(["yahoo", "coingecko", "manual"]),
});

const quoteCacheSchema = z.record(z.string(), quoteSchema);
const historicalQuoteCacheSchema = z.record(z.string(), historicalQuoteSchema);

export type PersistedPortfolioSnapshot = z.output<typeof persistedPortfolioSchema>;
export type PersistedQuoteCache = z.output<typeof quoteCacheSchema>;
export type PersistedHistoricalQuoteCache = z.output<
  typeof historicalQuoteCacheSchema
>;

export type PersistedParseFailure = {
  reason: "invalid-json" | "invalid-shape" | "unsupported-schema";
  success: false;
};

export type PersistedParseResult<T> =
  | { data: T; success: true }
  | PersistedParseFailure;

function parseJson(rawValue: string): PersistedParseResult<unknown> {
  try {
    return { data: JSON.parse(rawValue), success: true };
  } catch {
    return { reason: "invalid-json", success: false };
  }
}

function parseWithSchema<T>(
  rawValue: string,
  schema: z.ZodType<T>,
): PersistedParseResult<T> {
  const parsedJson = parseJson(rawValue);

  if (!parsedJson.success) {
    return parsedJson;
  }

  const parsedValue = schema.safeParse(parsedJson.data);

  return parsedValue.success
    ? { data: parsedValue.data, success: true }
    : { reason: "invalid-shape", success: false };
}

export function parsePersistedPortfolio(
  rawValue: string,
): PersistedParseResult<PersistedPortfolioSnapshot> {
  const parsedJson = parseJson(rawValue);

  if (!parsedJson.success) {
    return parsedJson;
  }

  if (
    !parsedJson.data ||
    typeof parsedJson.data !== "object" ||
    !Object.hasOwn(parsedJson.data, "schemaVersion") ||
    ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(
      (parsedJson.data as { schemaVersion?: unknown }).schemaVersion as number,
    )
  ) {
    return { reason: "unsupported-schema", success: false };
  }

  const parsedValue = persistedPortfolioSchema.safeParse(parsedJson.data);

  return parsedValue.success
    ? { data: parsedValue.data, success: true }
    : { reason: "invalid-shape", success: false };
}

export function parsePersistedQuoteCache(
  rawValue: string,
): PersistedParseResult<PersistedQuoteCache> {
  return parseWithSchema(rawValue, quoteCacheSchema);
}

export function parsePersistedHistoricalQuoteCache(
  rawValue: string,
): PersistedParseResult<PersistedHistoricalQuoteCache> {
  return parseWithSchema(rawValue, historicalQuoteCacheSchema);
}
