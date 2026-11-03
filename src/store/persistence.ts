import { emptyEpfState, validateEpfState } from "@/src/domain/epf/persistence";
import { validateEpfLegacyLinks } from "@/src/domain/epf/legacyLinks";
import {
  migrateInvestingCashEntry,
  migrateInvestingSnapshot,
} from "@/src/domain/investingCashMigration";
import { validateFuturesCashLinks } from "@/src/domain/futuresCashFunding";
import { validateDistributionGraph } from "@/src/domain/distributions";
import { validatePpfCashLinks } from "@/src/domain/ppfCashLinks";
import { normalizeAssetMetadata } from "@/src/domain/assets";
import { refreshFuturesCashSnapshotHistory } from "@/src/domain/calculations";
import type { JsonStorage, JsonValue } from "@/src/services/storage";
import type {
  Asset,
  CashEntry,
  CashEntryPurpose,
  HistoricalQuoteCache,
  OpeningPosition,
  Preferences,
  QuoteCache,
} from "@/src/types";

import {
  parsePersistedHistoricalQuoteCache,
  parsePersistedPortfolio,
  parsePersistedQuoteCache,
  type PersistedPortfolioSnapshot,
} from "./persistedPortfolioSchema";
import {
  assetGraphJournalStorageKey,
  historicalQuoteCacheStorageKey,
  portfolioSchemaVersion,
  portfolioStorageKey,
  type PortfolioStoreState,
  quoteCacheStorageKey,
  type RawPortfolioSnapshot,
  type StorageRecoveryIncident,
  storageRecoveryKeyPrefix,
  type StorageRecoveryReason,
} from "./storeTypes";
import { validateSplitInventory } from "./tradeRules";

export function createDefaultPreferences(): Preferences {
  return {
    appearance: "system",
    defaultChartRange: "1M",
    displayMode: "standard",
    hasCompletedOnboarding: false,
    maskWealthValues: false,
  };
}

export function createEmptyPortfolioSnapshot(): RawPortfolioSnapshot {
  return {
    epf: emptyEpfState(),
    assets: [],
    cashEntries: [],
    distributionCoverage: [],
    distributions: [],
    futuresAccounts: [],
    measurementBasis: null,
    monthlySnapshots: [],
    openingPositions: [],
    ppfAccounts: [],
    ppfLedgerEntries: [],
    preferences: createDefaultPreferences(),
    schemaVersion: portfolioSchemaVersion,
    trades: [],
  };
}

export type StoredCashEntry = Omit<CashEntry, "purpose"> & {
  purpose?: CashEntryPurpose;
};

export type StoredOpeningPosition = OpeningPosition & {
  currentPrice?: number;
};

export type StoredPortfolioSnapshot = Partial<
  Omit<
    RawPortfolioSnapshot,
    "cashEntries" | "openingPositions" | "schemaVersion"
  >
> & {
  cashEntries?: StoredCashEntry[];
  openingPositions?: StoredOpeningPosition[];
  schemaVersion?: number;
};

export const normalizeCashEntry = migrateInvestingCashEntry;
export const normalizeMonthlySnapshot = migrateInvestingSnapshot;

export function migrateOpeningPosition(
  position: StoredOpeningPosition,
  assets: Asset[],
): OpeningPosition {
  const { currentPrice, ...current } = position;

  if (current.manualValuation || currentPrice === undefined) {
    return current;
  }

  const asset = assets.find((item) => item.id === position.assetId);

  return {
    ...current,
    manualValuation: {
      asOf: null,
      currency: asset?.currency ?? "INR",
      price: currentPrice,
      provenance: "legacy",
      source: "manual",
    },
  };
}

export type PersistedReadResult<T> = {
  data: T;
  incident?: StorageRecoveryIncident;
};

export function quarantineRawValue(
  storage: JsonStorage,
  sourceKey: string,
  displayName: string,
  rawValue: string,
  reason: StorageRecoveryReason,
  now: () => Date,
): StorageRecoveryIncident {
  const recoveryKey = `${storageRecoveryKeyPrefix}:${sourceKey}`;
  const metadataKey = `${recoveryKey}:metadata`;
  const detectedAt = now().toISOString();
  let preserved = false;

  try {
    storage.setRawItem(recoveryKey, rawValue);
    storage.setItem(metadataKey, {
      detectedAt,
      reason,
      sourceKey,
    });
    preserved = true;
  } catch {
    // Recovery remains blocking when the storage device cannot preserve a copy.
  }

  return {
    detectedAt,
    displayName,
    metadataKey,
    preserved,
    reason,
    recoveryKey,
    sourceKey,
  };
}

export function migratePortfolioSnapshot(
  parsedSnapshot: PersistedPortfolioSnapshot,
): RawPortfolioSnapshot {
  const stored = parsedSnapshot as StoredPortfolioSnapshot &
    PersistedPortfolioSnapshot;
  const assets = (stored.assets ?? []).map(normalizeAssetMetadata);
  validateSplitInventory({ assets, openingPositions: stored.openingPositions ?? [], trades: stored.trades ?? [] });
  validateFuturesCashLinks((stored.cashEntries ?? []).map(normalizeCashEntry), stored.futuresAccounts ?? []);

  return {
    assets,
    epf: stored.epf ?? emptyEpfState(),
    cashEntries: (stored.cashEntries ?? []).map(normalizeCashEntry),
    // V17 adds payouts; older portfolios start with none and no coverage (D12).
    distributionCoverage: stored.distributionCoverage ?? [],
    distributions: stored.distributions ?? [],
    futuresAccounts: stored.futuresAccounts ?? [],
    // V18 adds the measurement basis; older portfolios start without one (D12).
    measurementBasis: stored.measurementBasis ?? null,
    monthlySnapshots: (stored.monthlySnapshots ?? []).map(
      normalizeMonthlySnapshot,
    ),
    openingPositions: (stored.openingPositions ?? []).map((position) =>
      migrateOpeningPosition(position, assets),
    ),
    ppfAccounts: stored.ppfAccounts ?? [],
    ppfLedgerEntries: stored.ppfLedgerEntries ?? [],
    preferences: {
      ...createDefaultPreferences(),
      ...stored.preferences,
      appearance: stored.preferences?.appearance ?? "dark",
    },
    schemaVersion: portfolioSchemaVersion,
    // Migration preserves stored financial values exactly; normalization applies
    // only at write boundaries for new or corrected records.
    trades: stored.trades ?? [],
  };
}

export function readPortfolioSnapshot(
  storage: JsonStorage,
  now: () => Date,
  migrate: (stored: PersistedPortfolioSnapshot) => RawPortfolioSnapshot,
): PersistedReadResult<RawPortfolioSnapshot> {
  const rawValue = storage.getRawItem(portfolioStorageKey);

  if (rawValue === null) {
    return { data: createEmptyPortfolioSnapshot() };
  }

  const parsed = parsePersistedPortfolio(rawValue);

  if (!parsed.success) {
    return {
      data: createEmptyPortfolioSnapshot(),
      incident: quarantineRawValue(
        storage,
        portfolioStorageKey,
        "Portfolio records",
        rawValue,
        parsed.reason,
        now,
      ),
    };
  }

  try {
    const migrated = migrate(parsed.data);
    const monthlySnapshots = refreshFuturesCashSnapshotHistory(migrated);
    const data = { ...migrated, monthlySnapshots };
    if (parsed.data.schemaVersion !== portfolioSchemaVersion || monthlySnapshots !== migrated.monthlySnapshots) {
      // One atomic record replacement; a failed write retains the original for recovery.
      storage.setItem(portfolioStorageKey, data as JsonValue);
    }
    return { data };
  } catch {
    return {
      data: createEmptyPortfolioSnapshot(),
      incident: quarantineRawValue(
        storage,
        portfolioStorageKey,
        "Portfolio records",
        rawValue,
        "migration-failed",
        now,
      ),
    };
  }

}

export function readQuoteCache(
  storage: JsonStorage,
  now: () => Date,
): PersistedReadResult<QuoteCache> {
  const rawValue = storage.getRawItem(quoteCacheStorageKey);

  if (rawValue === null) {
    return { data: {} };
  }

  const parsed = parsePersistedQuoteCache(rawValue);

  return parsed.success
    ? { data: parsed.data }
    : {
        data: {},
        incident: quarantineRawValue(
          storage,
          quoteCacheStorageKey,
          "Current quote cache",
          rawValue,
          parsed.reason,
          now,
        ),
      };
}

export function readHistoricalQuoteCache(
  storage: JsonStorage,
  now: () => Date,
): PersistedReadResult<HistoricalQuoteCache> {
  const rawValue = storage.getRawItem(historicalQuoteCacheStorageKey);

  if (rawValue === null) {
    return { data: {} };
  }

  const parsed = parsePersistedHistoricalQuoteCache(rawValue);

  return parsed.success
    ? { data: parsed.data }
    : {
        data: {},
        incident: quarantineRawValue(
          storage,
          historicalQuoteCacheStorageKey,
          "Historical quote cache",
          rawValue,
          parsed.reason,
          now,
        ),
      };
}

export function selectRawSnapshot(
  state: PortfolioStoreState,
): RawPortfolioSnapshot {
  return {
    epf: state.epf,
    assets: state.assets,
    cashEntries: state.cashEntries,
    distributionCoverage: state.distributionCoverage,
    distributions: state.distributions,
    futuresAccounts: state.futuresAccounts,
    measurementBasis: state.measurementBasis,
    monthlySnapshots: state.monthlySnapshots,
    openingPositions: state.openingPositions,
    ppfAccounts: state.ppfAccounts,
    ppfLedgerEntries: state.ppfLedgerEntries,
    preferences: state.preferences,
    schemaVersion: portfolioSchemaVersion,
    trades: state.trades,
  };
}

export function persistPortfolio(
  storage: JsonStorage,
  state: PortfolioStoreState,
) {
  validateSplitInventory(state);
  validateDistributionGraph(state);
  validatePpfCashLinks(state.ppfLedgerEntries, state.cashEntries);
  storage.setItem(portfolioStorageKey, selectRawSnapshot(state) as JsonValue);
}

export function persistPortfolioTransition(
  storage: JsonStorage,
  state: PortfolioStoreState,
  transition: Partial<RawPortfolioSnapshot>,
) {
  validateSplitInventory({ ...state, ...transition });
  validateEpfState(transition.epf ?? state.epf, transition.cashEntries ?? state.cashEntries);
  validateEpfLegacyLinks((transition.epf ?? state.epf).accounts, transition.assets ?? state.assets);
  validateFuturesCashLinks(transition.cashEntries ?? state.cashEntries, transition.futuresAccounts ?? state.futuresAccounts);
  validateDistributionGraph({ ...selectRawSnapshot(state), ...transition });
  validatePpfCashLinks(transition.ppfLedgerEntries ?? state.ppfLedgerEntries, transition.cashEntries ?? state.cashEntries);
  storage.setItem(portfolioStorageKey, {
    ...selectRawSnapshot(state),
    ...transition,
    schemaVersion: portfolioSchemaVersion,
  } as JsonValue);
}


export function withoutAssetQuotes<T extends QuoteCache | HistoricalQuoteCache>(
  cache: T,
  assetId: string,
): T {
  return Object.fromEntries(
    Object.entries(cache).filter(([, quote]) => quote.assetId !== assetId),
  ) as T;
}

export function restoreRawStorageValue(
  storage: JsonStorage,
  key: string,
  rawValue: string | null,
) {
  if (rawValue === null) storage.removeItem(key);
  else storage.setRawItem(key, rawValue);
}

export type AssetGraphJournal = {
  historical: string | null;
  portfolio: string | null;
  quotes: string | null;
};

export type AssetGraphJournalParseResult =
  | { journal: AssetGraphJournal }
  | { reason: "invalid-json" | "invalid-shape" };

export function parseAssetGraphJournal(
  rawValue: string,
): AssetGraphJournalParseResult {
  let value: JsonValue;

  try {
    value = JSON.parse(rawValue) as JsonValue;
  } catch {
    return { reason: "invalid-json" as const };
  }

  if (!value || Array.isArray(value) || typeof value !== "object") {
    return { reason: "invalid-shape" as const };
  }

  const candidate = value as Record<string, JsonValue>;
  const validRaw = (raw: JsonValue | undefined) =>
    raw === null || typeof raw === "string";

  return validRaw(candidate.historical) &&
    validRaw(candidate.portfolio) &&
    validRaw(candidate.quotes)
    ? { journal: candidate as AssetGraphJournal }
    : { reason: "invalid-shape" as const };
}

export function restoreAssetGraphJournal(
  storage: JsonStorage,
  journal: AssetGraphJournal,
) {
  restoreRawStorageValue(storage, quoteCacheStorageKey, journal.quotes);
  restoreRawStorageValue(
    storage,
    historicalQuoteCacheStorageKey,
    journal.historical,
  );
  restoreRawStorageValue(storage, portfolioStorageKey, journal.portfolio);
}

export function recoverPendingAssetGraphTransition(
  storage: JsonStorage,
  now: () => Date,
): StorageRecoveryIncident | undefined {
  const rawValue = storage.getRawItem(assetGraphJournalStorageKey);
  if (rawValue === null) return undefined;

  const parsed = parseAssetGraphJournal(rawValue);
  if ("reason" in parsed) {
    return {
      ...quarantineRawValue(
        storage,
        assetGraphJournalStorageKey,
        "Interrupted asset change",
        rawValue,
        parsed.reason,
        now,
      ),
      preserved: false,
    };
  }

  try {
    restoreAssetGraphJournal(storage, parsed.journal);
    storage.removeItem(assetGraphJournalStorageKey);
    return undefined;
  } catch {
    return {
      ...quarantineRawValue(
        storage,
        assetGraphJournalStorageKey,
        "Interrupted asset change",
        rawValue,
        "migration-failed",
        now,
      ),
      preserved: false,
    };
  }
}

export function persistAssetGraphTransition({
  historicalQuoteCache,
  portfolio,
  quoteCache,
  storage,
}: {
  historicalQuoteCache: HistoricalQuoteCache;
  portfolio: RawPortfolioSnapshot;
  quoteCache: QuoteCache;
  storage: JsonStorage;
}) {
  validateSplitInventory(portfolio);
  // Payout and PPF Cash links must stay valid; fail before any write rather than store a graph that would be quarantined.
  validateDistributionGraph(portfolio);
  validatePpfCashLinks(portfolio.ppfLedgerEntries, portfolio.cashEntries);
  const previous = {
    historical: storage.getRawItem(historicalQuoteCacheStorageKey),
    portfolio: storage.getRawItem(portfolioStorageKey),
    quotes: storage.getRawItem(quoteCacheStorageKey),
  };

  storage.setItem(assetGraphJournalStorageKey, previous as JsonValue);

  try {
    persistQuoteCache(storage, quoteCache);
    persistHistoricalQuoteCache(storage, historicalQuoteCache);
    storage.setItem(portfolioStorageKey, portfolio as JsonValue);
    storage.removeItem(assetGraphJournalStorageKey);
  } catch (error) {
    try {
      restoreAssetGraphJournal(storage, previous);
      storage.removeItem(assetGraphJournalStorageKey);
    } catch {
      // The journal remains durable and is replayed before the next read.
    }
    throw error;
  }
}


export function persistQuoteCache(storage: JsonStorage, quoteCache: QuoteCache) {
  storage.setItem(quoteCacheStorageKey, quoteCache as JsonValue);
}

export function persistHistoricalQuoteCache(
  storage: JsonStorage,
  historicalQuoteCache: HistoricalQuoteCache,
) {
  storage.setItem(
    historicalQuoteCacheStorageKey,
    historicalQuoteCache as JsonValue,
  );
}

