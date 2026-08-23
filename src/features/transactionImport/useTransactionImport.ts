import { useRef, useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import { normalizeIsin } from "@/src/domain/assets";
import {
  parseTransactionCsv,
  transactionCsvMaxBytes,
  transactionCsvMaxRows,
  type TransactionCsvError,
  type UnsupportedTransactionCsvEvent,
} from "@/src/domain/transactionCsv";
import type { AssetLookupSearchResult } from "@/src/services/assetLookup";
import { searchAssetLookupResults as searchAssetLookupResultsService } from "@/src/services/assetLookup";
import {
  getPortfolioStore,
  type PortfolioStoreState,
  type TransactionImportCommandResult,
} from "@/src/store";
import type { Asset } from "@/src/types";
import { createId } from "@/src/utils";

import {
  buildTransactionImportPlan,
  type TransactionCsvResolution,
  type TransactionImportMode,
} from "./transactionImport";

export { transactionCsvMaxBytes };

export type PickedTransactionCsv = {
  name: string;
  size: number;
  text: string;
};

type UseTransactionImportOptions = {
  now?: () => Date;
  onImported: (result: TransactionImportCommandResult) => void;
  pickCsvFile: () => Promise<PickedTransactionCsv | undefined>;
  searchAssetLookupResults?: (input: {
    query: string;
  }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

type ResolutionGroup = {
  candidates: Asset[];
  key: string;
  rowNumbers: number[];
  selectedAsset?: Asset;
  title: string;
};

function normalized(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

function assetFromLookupResult(result: {
  assetClass: Asset["assetClass"];
  currency: Asset["currency"];
  exchange?: Asset["exchange"];
  id: string;
  instrumentType: NonNullable<Asset["instrumentType"]>;
  name: string;
  quoteSourceId: string;
  sectorType: NonNullable<Asset["sectorType"]>;
  symbol: string;
  ticker: string;
}): Asset {
  return {
    assetClass: result.assetClass,
    currency: result.currency,
    ...(result.exchange ? { exchange: result.exchange } : {}),
    id: result.id,
    instrumentType: result.instrumentType,
    name: result.name,
    quoteSourceId: result.quoteSourceId,
    sectorType: result.sectorType,
    symbol: result.symbol,
    ticker: result.ticker,
  };
}

function identityKey(resolution: TransactionCsvResolution) {
  const { identity } = resolution.row;
  return identity.kind === "isin"
    ? `isin:${normalized(identity.value)}`
    : `symbol:${normalized(identity.exchange)}:${normalized(identity.symbol)}`;
}

function titleForResolution(resolution: TransactionCsvResolution) {
  const { identity } = resolution.row;
  return identity.kind === "isin"
    ? `ISIN ${identity.value}`
    : `${identity.symbol} • ${identity.exchange}`;
}

function findExistingAsset(
  row: TransactionCsvResolution["row"],
  assets: Asset[],
) {
  if (row.identity.kind === "isin") {
    const isin = normalizeIsin(row.identity.value);
    return assets.find((asset) => normalizeIsin(asset.isin) === isin);
  }

  const { exchange, symbol } = row.identity;

  return assets.find(
    (asset) =>
      normalized(asset.exchange) === normalized(exchange) &&
      (normalized(asset.symbol) === normalized(symbol) ||
        normalized(asset.ticker) === normalized(symbol)),
  );
}

function lookupQuery(row: TransactionCsvResolution["row"]) {
  return row.identity.kind === "isin"
    ? row.isin ?? row.identity.value
    : row.symbol ?? row.identity.symbol;
}

function groupResolutions(resolutions: TransactionCsvResolution[]) {
  const groups = new Map<string, ResolutionGroup>();
  for (const resolution of resolutions) {
    const key = identityKey(resolution);
    const existing = groups.get(key);
    if (existing) {
      existing.rowNumbers.push(resolution.row.rowNumber);
      continue;
    }
    groups.set(key, {
      candidates: resolution.candidates ?? [],
      key,
      rowNumbers: [resolution.row.rowNumber],
      title: titleForResolution(resolution),
    });
  }
  for (const group of groups.values()) {
    const selected = resolutions.find(
      (resolution) =>
        identityKey(resolution) === group.key &&
        resolution.status === "ready" &&
        resolution.asset,
    );
    if (selected?.asset) group.selectedAsset = selected.asset;
  }
  return [...groups.values()];
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<R>,
) {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, runWorker),
  );
  return results;
}

export function useTransactionImport({
  now = () => new Date(),
  onImported,
  pickCsvFile,
  searchAssetLookupResults = searchAssetLookupResultsService,
  store = getPortfolioStore(),
}: UseTransactionImportOptions) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const batchIdRef = useRef(createId("transactions-csv"));
  const [fileName, setFileName] = useState<string>();
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<TransactionImportMode>("supplemental");
  const [parseErrors, setParseErrors] = useState<TransactionCsvError[]>([]);
  const [resolutions, setResolutions] = useState<TransactionCsvResolution[]>([]);
  const [screenError, setScreenError] = useState<string>();
  const [sharedCutover, setSharedCutover] = useState("");
  const [cutoverByOpeningPositionId, setCutoverByOpeningPositionId] = useState<
    Record<string, string>
  >({});
  const [unsupportedCount, setUnsupportedCount] = useState(0);
  const [unsupportedEvents, setUnsupportedEvents] = useState<
    UnsupportedTransactionCsvEvent[]
  >([]);

  async function selectFile() {
    setScreenError(undefined);
    setIsResolving(true);
    try {
      const file = await pickCsvFile();
      if (!file) return;
      setFileName(file.name);
      setParseErrors([]);
      setResolutions([]);
      setUnsupportedCount(0);
      setUnsupportedEvents([]);
      setSharedCutover("");
      setCutoverByOpeningPositionId({});
      batchIdRef.current = createId("transactions-csv");
      if (file.size > transactionCsvMaxBytes || file.text.length > transactionCsvMaxBytes) {
        setParseErrors([{ code: "rowLimit", message: "CSV file is too large. Use at most 500 rows and a 1 MB file." }]);
        return;
      }

      const parsed = parseTransactionCsv(file.text);
      setParseErrors(parsed.errors.filter((error) => error.classification !== "unsupported"));
      setUnsupportedCount(parsed.unsupportedEvents.length);
      setUnsupportedEvents(parsed.unsupportedEvents);
      if (parsed.errors.some((error) => error.classification !== "unsupported")) return;

      const byKey = new Map<string, TransactionCsvResolution[]>();
      for (const row of parsed.rows) {
        const seed: TransactionCsvResolution = { row, status: "unresolved" };
        const key = identityKey(seed);
        byKey.set(key, [...(byKey.get(key) ?? []), seed]);
      }

      const resolvedGroups = await mapWithConcurrency(
        [...byKey.values()],
        4,
        async (seeds) => {
        const first = seeds[0];
        const existing = findExistingAsset(first.row, snapshot.assets);
        if (existing) {
          return seeds.map((seed) => ({
            ...seed,
            asset: existing,
            status: "ready" as const,
          }));
        }
        try {
          const lookup = await searchAssetLookupResults({ query: lookupQuery(first.row) });
          const candidates = lookup.results.map(assetFromLookupResult);
          const status = candidates.length > 0 ? "selectionRequired" as const : "unresolved" as const;
          return seeds.map((seed) => ({
            ...seed,
            candidates,
            status,
          }));
        } catch {
          return seeds.map((seed) => ({
            ...seed,
            status: "unresolved" as const,
          }));
        }
        },
      );
      setResolutions(resolvedGroups.flat());
    } catch {
      setFileName(undefined);
      setParseErrors([]);
      setResolutions([]);
      setScreenError("This CSV could not be read. Choose the versioned template and try again.");
    } finally {
      setIsResolving(false);
    }
  }

  function selectCandidate(key: string, asset: Asset) {
    setResolutions((current) =>
      current.map((resolution) =>
        identityKey(resolution) === key
          ? { ...resolution, asset, status: "ready" }
          : resolution,
      ),
    );
  }

  const currentDate = now();
  const plan = buildTransactionImportPlan({
    batchId: batchIdRef.current,
    cutoverByOpeningPositionId,
    mode,
    now: currentDate,
    resolutions,
    sharedCutover: sharedCutover || undefined,
    state: snapshot,
    unsupportedCount,
  });
  const cutoverHoldings = [...new Map(
    resolutions
      .filter((resolution) => resolution.status === "ready" && resolution.asset)
      .flatMap((resolution) =>
        snapshot.openingPositions
          .filter(
            (position) =>
              position.assetId === resolution.asset!.id,
          )
          .map((position) => [position.id, { asset: resolution.asset!, position }] as const),
      ),
  ).values()];
  const needsSharedCutover = cutoverHoldings.some(
    ({ position }) => !position.measuredAsOf,
  );

  function setCutover(openingPositionId: string, value: string) {
    setCutoverByOpeningPositionId((current) => ({ ...current, [openingPositionId]: value }));
  }

  function confirmImport() {
    if (!plan.command || isSaving) return;
    setIsSaving(true);
    setScreenError(undefined);
    try {
      onImported(store.getState().recordTransactionImport(plan.command));
    } catch {
      setScreenError("Nothing was imported. Your portfolio and Cash Ledger stayed unchanged; review the conflicts and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return {
    confirmImport,
    cutoverHoldings,
    cutoverByOpeningPositionId,
    fileName,
    groups: groupResolutions(resolutions),
    isResolving,
    isSaving,
    maxRows: transactionCsvMaxRows,
    mode,
    needsSharedCutover,
    parseErrors,
    plan,
    screenError,
    selectCandidate,
    selectFile,
    setCutover,
    setMode,
    setSharedCutover,
    sharedCutover,
    snapshot,
    unsupportedCount,
    unsupportedEvents,
    today: currentDate,
  };
}
