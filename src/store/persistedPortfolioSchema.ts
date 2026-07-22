import { z } from "zod";

const finiteNumberSchema = z.number().finite();
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
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
  isTaxEligible: z.boolean().optional(),
  logoUrl: z.string().optional(),
  name: nonEmptyStringSchema,
  quoteSourceId: nonEmptyStringSchema.optional(),
  sectorType: z
    .enum([
      "consumer",
      "digitalAsset",
      "diversified",
      "energy",
      "financialServices",
      "fixedIncome",
      "healthcare",
      "industrial",
      "liquidity",
      "other",
      "technology",
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

const openingPositionSchema = z.object({
  assetId: nonEmptyStringSchema,
  averageCostPrice: finiteNumberSchema,
  conviction: convictionScoreSchema.optional(),
  currentPrice: finiteNumberSchema.optional(),
  date: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  notes: z.string().optional(),
  quantity: finiteNumberSchema,
});

const tradeSchema = z.object({
  assetId: nonEmptyStringSchema,
  conviction: convictionScoreSchema.optional(),
  date: nonEmptyStringSchema,
  fees: finiteNumberSchema.optional(),
  id: nonEmptyStringSchema,
  intendedHoldDays: finiteNumberSchema.optional(),
  notes: z.string().optional(),
  pricePerUnit: finiteNumberSchema,
  quantity: finiteNumberSchema,
  totalValue: finiteNumberSchema,
  type: z.enum(["buy", "sell"]),
  whyThisTrade: z.string().optional(),
});

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
        ]),
        status: z.literal("unavailable"),
        warnings: z.array(z.string()),
      }),
    ])
    .optional(),
  portfolioValue: finiteNumberSchema,
  salary: finiteNumberSchema,
});

const preferencesSchema = z
  .object({
    defaultChartRange: z
      .enum(["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"])
      .optional(),
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
]);

const persistedPortfolioSchema = z.object({
  assets: z.array(assetSchema).optional(),
  cashEntries: z.array(cashEntrySchema).optional(),
  monthlySnapshots: z.array(monthlySnapshotSchema).optional(),
  openingPositions: z.array(openingPositionSchema).optional(),
  preferences: preferencesSchema,
  schemaVersion: schemaVersionSchema,
  trades: z.array(tradeSchema).optional(),
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
    ![1, 2, 3, 4, 5].includes(
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
