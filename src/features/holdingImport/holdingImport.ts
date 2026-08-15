import { findCanonicalAsset, normalizeAssetMetadata } from "@/src/domain/assets";
import {
  calculateCashBalance,
  calculateConsolidatedHoldingRows,
  calculateHoldings,
  calculatePortfolioRollupTotals,
} from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import type { ParsedHoldingsCsvRow } from "@/src/domain/holdingsCsv";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";
import {
  calculatePpfPortfolioSummary,
  getLinkedLegacyPpfAssetIds,
} from "@/src/domain/ppf";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import type {
  OpeningPositionBatchCommandInput,
  PortfolioStoreState,
} from "@/src/store";
import type { Asset, OpeningPosition, Quote } from "@/src/types";

export type HoldingsCsvResolution = {
  allowExistingUpdate: boolean;
  asset?: Asset;
  candidates: AssetLookupResult[];
  lookupFailure?: string;
  quote?: Quote;
  quoteFailure?: string;
  row: ParsedHoldingsCsvRow;
  status: "manualRequired" | "ready" | "selectionRequired";
};

export type HoldingsCsvPlanError = {
  message: string;
  rowNumber: number;
};

export type HoldingsCsvPlan = {
  command?: OpeningPositionBatchCommandInput;
  errors: HoldingsCsvPlanError[];
  summary?: {
    additions: number;
    pendingValuations: number;
    resultingCurrentValue: number | null;
    resultingInvested: number;
    updates: number;
  };
};

function normalizeIdentity(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

export function lookupQueryForCsvRow(row: ParsedHoldingsCsvRow) {
  return row.ticker || row.symbol || row.name;
}

export function assetFromLookupResult(result: AssetLookupResult): Asset {
  return normalizeAssetMetadata({
    assetClass: result.assetClass,
    currency: result.currency,
    exchange: result.exchange,
    id: result.id,
    instrumentType: result.instrumentType,
    name: result.name,
    quoteSourceId: result.quoteSourceId,
    sectorType: result.sectorType,
    symbol: result.symbol,
    ticker: result.ticker,
  });
}

export function buildManualAssetFromCsvRow(
  row: ParsedHoldingsCsvRow,
): Asset | undefined {
  if (!row.assetClass) return undefined;

  const ticker = row.ticker || row.symbol || row.name.replace(/\s+/gu, "-");
  const symbol = row.symbol || row.ticker?.replace(/\.(NS|BO)$/u, "") || ticker;
  const exchange =
    row.exchange ??
    (row.assetClass === "crypto"
      ? "CRYPTO"
      : row.assetClass === "stock" || row.assetClass === "etf"
        ? undefined
        : undefined);

  if ((row.assetClass === "stock" || row.assetClass === "etf") && !exchange) {
    return undefined;
  }

  return normalizeAssetMetadata({
    assetClass: row.assetClass,
    currency: row.currency,
    ...(exchange ? { exchange } : {}),
    id: `csv-manual:${row.rowNumber}:${ticker.toLowerCase()}`,
    ...(row.instrumentType ? { instrumentType: row.instrumentType } : {}),
    name: row.name,
    quoteSourceId: ticker,
    ...(row.sectorType ? { sectorType: row.sectorType } : {}),
    symbol: symbol.toUpperCase(),
    ticker,
  });
}

function findExistingAssetForRow(
  row: ParsedHoldingsCsvRow,
  assets: Asset[],
) {
  const ticker = normalizeIdentity(row.ticker);
  const symbol = normalizeIdentity(row.symbol);
  const exchange = normalizeIdentity(row.exchange);

  return assets.find((asset) => {
    if (
      ticker &&
      (normalizeIdentity(asset.ticker) === ticker ||
        normalizeIdentity(asset.quoteSourceId) === ticker)
    ) {
      return !exchange || normalizeIdentity(asset.exchange) === exchange;
    }

    return (
      symbol &&
      normalizeIdentity(asset.symbol) === symbol &&
      (!exchange || normalizeIdentity(asset.exchange) === exchange)
    );
  });
}

export function classifyCsvLookupResults({
  assets,
  failures,
  results,
  row,
}: {
  assets: Asset[];
  failures: string[];
  results: AssetLookupResult[];
  row: ParsedHoldingsCsvRow;
}): HoldingsCsvResolution {
  const existing = findExistingAssetForRow(row, assets);
  if (existing) {
    return {
      allowExistingUpdate: false,
      asset: existing,
      candidates: [],
      row,
      status: "ready",
    };
  }

  const ticker = normalizeIdentity(row.ticker);
  const symbol = normalizeIdentity(row.symbol);
  const exchange = normalizeIdentity(row.exchange);
  const exact = results.filter(
    (result) =>
      (!exchange || normalizeIdentity(result.exchange) === exchange) &&
      ((ticker &&
          (normalizeIdentity(result.ticker) === ticker ||
            normalizeIdentity(result.quoteSourceId) === ticker)) ||
        (symbol && normalizeIdentity(result.symbol) === symbol)),
  );

  if (exact.length === 1) {
    return {
      allowExistingUpdate: false,
      asset: assetFromLookupResult(exact[0]),
      candidates: results,
      row,
      status: "ready",
    };
  }

  if (results.length > 0) {
    return {
      allowExistingUpdate: false,
      candidates: results,
      ...(failures.length > 0 ? { lookupFailure: failures.join(" ") } : {}),
      row,
      status: "selectionRequired",
    };
  }

  return {
    allowExistingUpdate: false,
    candidates: [],
    ...(failures.length > 0 ? { lookupFailure: failures.join(" ") } : {}),
    row,
    status: "manualRequired",
  };
}

function importedPosition(
  resolution: HoldingsCsvResolution,
  asset: Asset,
  id: string,
  now: Date,
): OpeningPosition {
  const row = resolution.row;
  return {
    assetId: asset.id,
    averageCostPrice: row.averageCost,
    date: row.firstPurchaseDate,
    id,
    ...(row.currentPrice === undefined
      ? {}
      : {
          manualValuation: {
            asOf: row.valuationAsOf!,
            currency: asset.currency,
            price: row.currentPrice,
            provenance: "user" as const,
            source: "manual" as const,
          },
        }),
    quantity: row.quantity,
    ...(row.firstPurchaseDate === null
      ? {
          recordedAt: now.toISOString(),
          recordedOn: formatLocalCalendarDate(now),
        }
      : {}),
  };
}

export function buildHoldingsCsvImportPlan({
  batchId,
  now = new Date(),
  resolutions,
  state,
}: {
  batchId: string;
  now?: Date;
  resolutions: HoldingsCsvResolution[];
  state: PortfolioStoreState;
}): HoldingsCsvPlan {
  if (resolutions.length === 0) return { errors: [] };

  const errors: HoldingsCsvPlanError[] = [];
  const items: OpeningPositionBatchCommandInput["items"] = [];
  const resolvedAssetIds = new Set<string>();
  let additions = 0;
  let updates = 0;

  for (const resolution of resolutions) {
    const rowNumber = resolution.row.rowNumber;
    if (resolution.status !== "ready" || !resolution.asset) {
      errors.push({ message: "Select a provider result or confirm a manual asset.", rowNumber });
      continue;
    }

    const candidate = normalizeAssetMetadata(resolution.asset);
    const asset = findCanonicalAsset(state.assets, candidate) ?? candidate;
    const currencyIssue = getV1AssetCurrencyIssue(asset);
    if (currencyIssue) {
      errors.push({ message: currencyIssue, rowNumber });
      continue;
    }
    if (resolution.row.currency !== asset.currency) {
      errors.push({
        message: `CSV currency ${resolution.row.currency} does not match ${asset.name} (${asset.currency}).`,
        rowNumber,
      });
      continue;
    }
    if (
      resolution.row.exchange &&
      normalizeIdentity(resolution.row.exchange) !==
        normalizeIdentity(asset.exchange)
    ) {
      errors.push({
        message: `CSV exchange ${resolution.row.exchange} does not match ${asset.name} (${asset.exchange ?? "unknown"}).`,
        rowNumber,
      });
      continue;
    }
    if (resolvedAssetIds.has(asset.id)) {
      errors.push({ message: "This CSV resolves to the same asset more than once.", rowNumber });
      continue;
    }
    resolvedAssetIds.add(asset.id);

    const positions = state.openingPositions.filter(
      (position) => position.assetId === asset.id,
    );
    const hasTransactions = state.trades.some((trade) => trade.assetId === asset.id);
    if (hasTransactions) {
      errors.push({
        message: "This holding has transaction history and cannot be replaced by aggregate CSV data.",
        rowNumber,
      });
      continue;
    }
    if (positions.length > 1) {
      errors.push({ message: "This holding has multiple opening records and requires manual review.", rowNumber });
      continue;
    }
    if (positions.length === 1 && !resolution.allowExistingUpdate) {
      errors.push({ message: "Confirm the explicit update for this existing holding.", rowNumber });
      continue;
    }

    const existingPosition = positions[0];
    const positionId = existingPosition?.id ?? `${batchId}:row-${rowNumber}`;
    items.push({
      asset,
      commandId: positionId,
      existingPosition: existingPosition ? "replace" : "add",
      openingPosition: importedPosition(resolution, asset, positionId, now),
      ...(resolution.row.currentPrice === undefined && resolution.quote
        ? { quote: { ...resolution.quote, assetId: asset.id } }
        : {}),
    });
    if (existingPosition) updates += 1;
    else additions += 1;
  }

  if (errors.length > 0 || items.length !== resolutions.length) {
    return { errors };
  }

  const assets = [...state.assets];
  let openingPositions = [...state.openingPositions];
  const quoteCache = { ...state.quoteCache };
  for (const item of items) {
    if (!assets.some((asset) => asset.id === item.asset.id)) assets.push(item.asset);
    if (item.existingPosition === "replace") {
      openingPositions = openingPositions.map((position) =>
        position.id === item.openingPosition.id ? item.openingPosition : position,
      );
    } else {
      openingPositions.push(item.openingPosition);
    }
    if (item.quote) quoteCache[item.asset.id] = item.quote;
  }

  const asOf = formatLocalCalendarDate(now);
  const linkedLegacyPpfAssetIds = getLinkedLegacyPpfAssetIds(
    state.ppfAccounts,
    asOf,
  );
  const holdings = calculateHoldings({
    assets,
    openingPositions,
    quoteCache,
    trades: state.trades,
  }).filter((holding) => !linkedLegacyPpfAssetIds.has(holding.asset.id));
  const cashBalance = calculateCashBalance(state.cashEntries, now);
  const ppfSummary = calculatePpfPortfolioSummary({
    accounts: state.ppfAccounts,
    asOf,
    entries: state.ppfLedgerEntries,
  });
  const totals = calculatePortfolioRollupTotals(
    calculateConsolidatedHoldingRows(holdings),
    cashBalance,
    holdings,
    ppfSummary,
  );

  return {
    command: { commandId: batchId, items },
    errors: [],
    summary: {
      additions,
      pendingValuations: totals.valuationCoverage.pendingHoldings,
      resultingCurrentValue: totals.totalCurrentValue,
      resultingInvested: totals.totalInvested,
      updates,
    },
  };
}
