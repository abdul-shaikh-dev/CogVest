import { z } from "zod";
import { emptyEpfState, epfStateSchema, validateEpfState } from "@/src/domain/epf/persistence";
import { validateEpfLegacyLinks } from "@/src/domain/epf/legacyLinks";
import { distributionGraphProblems } from "@/src/domain/distributions";
import { ppfCashLinkProblems } from "@/src/domain/ppfCashLinks";
import type {
  Asset,
  CashEntry,
  Distribution,
  DistributionCoverage,
  PpfLedgerEntry,
  Trade,
} from "@/src/types";
import {
  calculatePpfConfirmedBalance,
  comparePpfLedgerEntries,
  validatePpfAccount,
  validatePpfLedgerEntryForAccount,
} from "@/src/domain/ppf";

import {
  assetSchema,
  cashEntrySchema,
  finiteNumberSchema,
  nonEmptyStringSchema,
  openingPositionSchema,
  tradeSchema,
} from "./persistedRecordSchemas";
import {
  distributionCoverageSchema,
  distributionSchema,
  futuresAccountSchema,
  historicalPriceBasisSchema,
  measurementBasisSchema,
  monthlySnapshotSchema,
  ppfAccountSchema,
  ppfLedgerEntrySchema,
  preferencesSchema,
  schemaVersionSchema,
} from "./persistedAccountSchemas";

export { stockSplitEventSchema } from "./persistedRecordSchemas";

const persistedPortfolioSchema = z
  .object({
    epf: epfStateSchema.optional(),
    assets: z.array(assetSchema).optional(),
    cashEntries: z.array(cashEntrySchema).optional(),
    distributionCoverage: z.array(distributionCoverageSchema).optional(),
    distributions: z.array(distributionSchema).optional(),
    futuresAccounts: z.array(futuresAccountSchema).max(10).optional(),
    measurementBasis: measurementBasisSchema.nullable().optional(),
    monthlySnapshots: z.array(monthlySnapshotSchema).optional(),
    openingPositions: z.array(openingPositionSchema).optional(),
    ppfAccounts: z.array(ppfAccountSchema).optional(),
    ppfLedgerEntries: z.array(ppfLedgerEntrySchema).optional(),
    preferences: preferencesSchema,
    schemaVersion: schemaVersionSchema,
    trades: z.array(tradeSchema).optional(),
  })
  .superRefine((portfolio, context) => {
    if (portfolio.schemaVersion >= 14 && portfolio.futuresAccounts === undefined) {
      context.addIssue({ code: "custom", message: "V14 and later require futures accounts.", path: ["futuresAccounts"] });
    }
    const futuresIds = (portfolio.futuresAccounts ?? []).map((account) => account.id);
    if (new Set(futuresIds).size !== futuresIds.length) {
      context.addIssue({ code: "custom", message: "Futures account IDs must be unique.", path: ["futuresAccounts"] });
    }
    if (portfolio.schemaVersion >= 15) {
      (portfolio.cashEntries ?? []).forEach((entry, index) => {
        if (entry.purpose === "income" || entry.purpose === undefined) context.addIssue({ code: "custom", message: "An investing Cash purpose is required.", path: ["cashEntries", index, "purpose"] });
      });
      (portfolio.monthlySnapshots ?? []).forEach((snapshot, index) => {
        for (const field of ["salary", "monthlyExpense"] as const) {
          if (Object.hasOwn(snapshot, field)) context.addIssue({ code: "custom", message: "Household metadata is retired.", path: ["monthlySnapshots", index, field] });
        }
      });
    }
    if ((portfolio.schemaVersion >= 16) !== (portfolio.epf !== undefined)) {
      context.addIssue({ code: "custom", message: "EPF state is required from V16.", path: ["epf"] });
    }
    const hasPayouts = portfolio.distributions !== undefined && portfolio.distributionCoverage !== undefined;
    if ((portfolio.schemaVersion >= 17) !== hasPayouts || (portfolio.schemaVersion < 17 && (portfolio.distributions !== undefined || portfolio.distributionCoverage !== undefined))) {
      context.addIssue({ code: "custom", message: "Payout records are required from V17.", path: ["distributions"] });
    }
    if (portfolio.schemaVersion < 17 && (portfolio.cashEntries ?? []).some((entry) => entry.purpose === "distribution" || entry.linkedDistributionId)) {
      context.addIssue({ code: "custom", message: "Payout Cash entries require V17.", path: ["cashEntries"] });
    }
    if ((portfolio.schemaVersion >= 18) !== (portfolio.measurementBasis !== undefined)) {
      context.addIssue({ code: "custom", message: "The measurement basis is required from V18.", path: ["measurementBasis"] });
    }
    if (portfolio.schemaVersion < 18 && (
      (portfolio.cashEntries ?? []).some((entry) => entry.purpose === "ppfTransfer" || entry.linkedPpf) ||
      (portfolio.ppfLedgerEntries ?? []).some((entry) => "fundingSource" in entry && entry.fundingSource !== undefined) ||
      (portfolio.trades ?? []).some((trade) => "fundingSource" in trade && trade.fundingSource !== undefined))) {
      context.addIssue({ code: "custom", message: "Funding sources require V18.", path: ["ppfLedgerEntries"] });
    }
    if (ppfCashLinkProblems((portfolio.ppfLedgerEntries ?? []) as PpfLedgerEntry[], (portfolio.cashEntries ?? []) as CashEntry[]).length) {
      context.addIssue({ code: "custom", message: "PPF Cash links are invalid.", path: ["cashEntries"] });
    }
    const payoutProblems = distributionGraphProblems({
      assets: (portfolio.assets ?? []) as Asset[],
      cashEntries: (portfolio.cashEntries ?? []) as CashEntry[],
      trades: (portfolio.trades ?? []) as Trade[],
      distributions: (portfolio.distributions ?? []) as Distribution[],
      distributionCoverage: (portfolio.distributionCoverage ?? []) as DistributionCoverage[],
    });
    if (payoutProblems.length) {
      context.addIssue({ code: "custom", message: "Payout records or their links are invalid.", path: ["distributions"] });
    }
    try {
      validateEpfState(portfolio.epf ?? emptyEpfState(), (portfolio.cashEntries ?? []) as CashEntry[]);
      validateEpfLegacyLinks((portfolio.epf ?? emptyEpfState()).accounts, (portfolio.assets ?? []) as Asset[]);
    } catch {
      context.addIssue({ code: "custom", message: "EPF records or Cash links are invalid.", path: ["epf"] });
    }
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
  source: z.enum(["amfi", "yahoo", "coingecko", "manual"]),
});

const historicalQuoteSchema = z.object({
  assetId: nonEmptyStringSchema,
  asOfMonth: nonEmptyStringSchema,
  basis: historicalPriceBasisSchema,
  currency: z.enum(["INR", "USD"]),
  fetchedAt: nonEmptyStringSchema,
  price: finiteNumberSchema,
  source: z.enum(["amfi", "yahoo", "coingecko", "manual"]),
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
    ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].includes(
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
