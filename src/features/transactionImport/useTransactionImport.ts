import { useRef, useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import { normalizeIsin } from "@/src/domain/assets";
import {
  transactionCsvMaxBytes,
  transactionCsvMaxRows,
  type TransactionCsvError,
  type UnsupportedTransactionCsvEvent,
} from "@/src/domain/transactionCsv";
import {
  parseTransactionImportFile,
  type TransactionImportSourceId,
} from "@/src/domain/transactionImportSources";
import type { AssetLookupSearchResult } from "@/src/services/assetLookup";
import { searchAssetLookupResults as searchAssetLookupResultsService } from "@/src/services/assetLookup";
import {
  readCasStatementForImport,
  type CasPdfSourceFile,
  type CasStatementImportReview,
} from "@/src/services/import-export";
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
import { compatibleTransactionCandidate, conflictingHistoricalRows, exactTradebookSuggestion, transactionAssetKey } from "./transactionImportMatching";

export { transactionCsvMaxBytes };

export const transactionImportMaxFiles = 10;

export type PickedTransactionCsv = {
  name: string;
  size: number;
  text: string;
};

export type SelectedTransactionImportFile = PickedTransactionCsv & {
  id: string;
};

export type PickedCasStatement = CasPdfSourceFile;

export type UseTransactionImportOptions = {
  now?: () => Date;
  onImported: (result: TransactionImportCommandResult) => void;
  pickCasStatement?: () => Promise<PickedCasStatement | undefined>;
  pickCsvFile: () => Promise<PickedTransactionCsv | undefined>;
  readCasStatement?: (input: {
    password?: string;
    source: PickedCasStatement;
  }) => Promise<CasStatementImportReview>;
  searchAssetLookupResults?: (input: {
    query: string;
  }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

type ResolutionGroup = {
  identityConflict?: boolean;
  candidates: Asset[];
  key: string;
  rowNumbers: number[];
  selectedAsset?: Asset;
  suggestedAsset?: Asset;
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
  return transactionAssetKey(resolution.row);
}

function titleForResolution(resolution: TransactionCsvResolution) {
  const { identity } = resolution.row;
  return identity.kind === "isin"
    ? `${resolution.row.symbol ? `${resolution.row.symbol} • ` : ""}ISIN ${identity.value}`
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

function groupResolutions(resolutions: TransactionCsvResolution[], existingAssets: Asset[]) {
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
    group.suggestedAsset = exactTradebookSuggestion(
      resolutions.filter((resolution) => identityKey(resolution) === group.key).map((resolution) => resolution.row),
      group.candidates,
    );
  }
  const result = [...groups.values()];
  const candidates = resolutions.map((resolution) => ({
    row: resolution.row,
    asset: resolution.asset ?? groups.get(identityKey(resolution))?.suggestedAsset,
  }));
  const conflicts = conflictingHistoricalRows(candidates, existingAssets);
  for (const index of conflicts) {
    const group = groups.get(identityKey(resolutions[index]))!;
    group.identityConflict = true;
    group.suggestedAsset = undefined;
  }
  return result;
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
  pickCasStatement,
  pickCsvFile,
  readCasStatement = readCasStatementForImport,
  searchAssetLookupResults = searchAssetLookupResultsService,
  store = getPortfolioStore(),
}: UseTransactionImportOptions) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const batchIdRef = useRef(createId("transactions-csv"));
  const restoreEpochRef = useRef(store.getState().restoreEpoch);
  const analysisIdRef = useRef(0);
  const selectedAssetsRef = useRef(new Map<string, Asset>());
  const lookupCacheRef = useRef(new Map<string, Asset[]>());
  const [files, setFiles] = useState<SelectedTransactionImportFile[]>([]);
  const [fileSummaries, setFileSummaries] = useState<Record<string, string>>({});
  const [casPassword, setCasPassword] = useState("");
  const [casReview, setCasReview] = useState<CasStatementImportReview>();
  const [casReviewErrors, setCasReviewErrors] = useState<string[]>([]);
  const [casSource, setCasSource] = useState<PickedCasStatement>();
  const [sourceId, setSourceIdState] =
    useState<TransactionImportSourceId>("cogvestCsvV1");
  const [externalActivityConfirmed, setExternalActivityConfirmed] =
    useState(false);
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

  function clearAnalysis() {
    setParseErrors([]);
    setResolutions([]);
    setUnsupportedCount(0);
    setUnsupportedEvents([]);
    setCasReview(undefined);
    setCasReviewErrors([]);
    setSharedCutover("");
    setCutoverByOpeningPositionId({});
  }

  async function resolveRows(
    rows: TransactionCsvResolution["row"][],
    analysisId: number,
  ) {
    const byKey = new Map<string, TransactionCsvResolution[]>();
    for (const row of rows) {
      const seed: TransactionCsvResolution = { row, status: "unresolved" };
      const key = identityKey(seed);
      byKey.set(key, [...(byKey.get(key) ?? []), seed]);
    }

    const resolvedGroups = await mapWithConcurrency(
      [...byKey.values()],
      4,
      async (seeds) => {
        const first = seeds[0];
        const cacheKey = JSON.stringify([identityKey(first), ...new Set(seeds.map((seed) => `${seed.row.exchange}:${seed.row.symbol}:${seed.row.currency}`))].sort());
        const cachedCandidates = lookupCacheRef.current.get(cacheKey)?.filter((asset) => seeds.every((seed) => compatibleTransactionCandidate(asset, seed.row)));
        const existing = findExistingAsset(first.row, snapshot.assets);
        if (existing) {
          return seeds.map((seed) => ({
            ...seed,
            asset: existing,
            status: "ready" as const,
          }));
        }
        const selected = selectedAssetsRef.current.get(identityKey(first));
        if (selected && seeds.every((seed) => compatibleTransactionCandidate(selected, seed.row))) {
          return seeds.map((seed) => ({ ...seed, asset: selected, candidates: cachedCandidates, status: "ready" as const }));
        }
        if (cachedCandidates?.length) return seeds.map((seed) => ({ ...seed, candidates: cachedCandidates, status: "selectionRequired" as const }));
        try {
          let lookup = await searchAssetLookupResults({
            query: lookupQuery(first.row),
          });
          if (first.row.source?.format === "zerodha-tradebook" &&
              !exactTradebookSuggestion(seeds.map((seed) => seed.row), lookup.results)) {
            const symbols = [...new Set(seeds.map((seed) => seed.row.symbol).filter((symbol): symbol is string => Boolean(symbol)))];
            for (const symbol of symbols) {
              if (analysisId !== analysisIdRef.current) return seeds;
              const bySymbol = await searchAssetLookupResults({ query: symbol });
              lookup = { failures: [...lookup.failures, ...bySymbol.failures], results: [...lookup.results, ...bySymbol.results] };
            }
          }
          const candidates = [...new Map(lookup.results.map(assetFromLookupResult)
            .filter((asset) => seeds.every((seed) => compatibleTransactionCandidate(asset, seed.row)))
            .map((asset) => [asset.id, asset])).values()];
          if (candidates.length > 0 && analysisId === analysisIdRef.current) lookupCacheRef.current.set(cacheKey, candidates);
          const status =
            candidates.length > 0
              ? ("selectionRequired" as const)
              : ("unresolved" as const);
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
    if (analysisId === analysisIdRef.current) {
      setResolutions(resolvedGroups.flat());
    }
  }

  async function analyzeFiles(
    nextFiles: SelectedTransactionImportFile[],
    nextSourceId: TransactionImportSourceId,
  ) {
    const analysisId = ++analysisIdRef.current;
    setScreenError(undefined);
    clearAnalysis();
    setFileSummaries({});
    batchIdRef.current = createId("transactions-csv");
    if (nextFiles.length === 0) {
      setIsResolving(false);
      return;
    }

    setIsResolving(true);
    try {
      const parsedFiles = nextFiles.map((file, fileIndex) => {
        if (
          file.size > transactionCsvMaxBytes ||
          file.text.length > transactionCsvMaxBytes
        ) {
          return {
            errors: [
              {
                code: "fileLimit" as const,
                message: `${file.name}: CSV files may be at most 1 MB.`,
              },
            ],
            rows: [],
            unsupportedEvents: [],
          };
        }
        const parsed = parseTransactionImportFile({
          fileIndex,
          fileName: file.name,
          sourceId: nextSourceId,
          text: file.text,
        });
        const dates = parsed.rows.map((row) => row.tradeDate.slice(0, 10)).sort();
        if (dates.length > 0) setFileSummaries((current) => ({ ...current,
          [file.id]: `${dates[0]} to ${dates[dates.length - 1]} • ${parsed.rows.length} transactions`,
        }));
        return {
          errors: parsed.errors.map((error) => ({
            ...error,
            message: `${file.name}: ${error.message}`,
          })),
          rows: parsed.rows,
          unsupportedEvents: parsed.unsupportedEvents.map((event) => ({
            ...event,
            transactionType: `${file.name} • ${event.transactionType}`,
          })),
        };
      });
      const errors = parsedFiles.flatMap((parsed) => parsed.errors);
      const unsupported = parsedFiles.flatMap(
        (parsed) => parsed.unsupportedEvents,
      );
      if (analysisId !== analysisIdRef.current) return;
      setParseErrors(
        errors.filter((error) => error.classification !== "unsupported"),
      );
      setUnsupportedCount(unsupported.length);
      setUnsupportedEvents(unsupported);
      if (errors.some((error) => error.classification !== "unsupported")) {
        return;
      }

      await resolveRows(
        parsedFiles.flatMap((parsed) => parsed.rows),
        analysisId,
      );
    } catch {
      if (analysisId !== analysisIdRef.current) return;
      clearAnalysis();
      setScreenError(
        "These files could not be read. Check the selected source and try again.",
      );
    } finally {
      if (analysisId === analysisIdRef.current) setIsResolving(false);
    }
  }

  async function analyzeCasStatement(
    source: PickedCasStatement,
    nextPassword = casPassword,
  ) {
    if (store.getState().restoreEpoch !== restoreEpochRef.current) return;
    const analysisId = ++analysisIdRef.current;
    setScreenError(undefined);
    clearAnalysis();
    batchIdRef.current = createId("transactions-cas");
    setIsResolving(true);
    try {
      const review = await readCasStatement({
        password: nextPassword || undefined,
        source,
      });
      if (store.getState().restoreEpoch !== restoreEpochRef.current) return;
      if (analysisId !== analysisIdRef.current) return;
      setCasReview(review);
      setCasPassword("");
      const normalization = review.normalization;
      setCasReviewErrors([
        ...normalization.parserErrors.map((error) => error.message),
        ...normalization.errors.map((error) => error.message),
      ]);
      setUnsupportedCount(normalization.unsupportedEvents.length);
      setUnsupportedEvents(normalization.unsupportedEvents);
      await resolveRows(normalization.rows, analysisId);
    } catch (error) {
      if (analysisId !== analysisIdRef.current) return;
      setScreenError(
        error instanceof Error
          ? error.message
          : "This statement could not be read safely.",
      );
    } finally {
      if (analysisId === analysisIdRef.current) setIsResolving(false);
    }
  }

  async function replaceFiles(nextFiles: SelectedTransactionImportFile[]) {
    setExternalActivityConfirmed(false);
    setFiles(nextFiles);
    await analyzeFiles(nextFiles, sourceId);
  }

  async function selectFile() {
    setScreenError(undefined);
    try {
      if (sourceId === "camsKfinCasPdfV1") {
        if (!pickCasStatement) {
          setScreenError("Statement selection is unavailable in this app build.");
          return;
        }
        const statement = await pickCasStatement();
        if (store.getState().restoreEpoch !== restoreEpochRef.current) return;
        if (!statement) return;
        setCasSource(statement);
        await analyzeCasStatement(statement);
        return;
      }
      const file = await pickCsvFile();
      if (store.getState().restoreEpoch !== restoreEpochRef.current) return;
      if (!file) return;
      if (
        sourceId === "zerodhaTradebookEqV1" &&
        files.length >= transactionImportMaxFiles
      ) {
        setScreenError(
          `Use at most ${transactionImportMaxFiles} Tradebook files in one batch.`,
        );
        return;
      }
      const selected = { ...file, id: createId("transaction-file") };
      await replaceFiles(
        sourceId === "cogvestCsvV1" ? [selected] : [...files, selected],
      );
    } catch {
      setScreenError(
        sourceId === "camsKfinCasPdfV1"
          ? "This statement could not be selected. Choose another PDF and try again."
          : "This CSV could not be read. Choose another file and try again.",
      );
    }
  }

  async function removeFile(fileId: string) {
    await replaceFiles(files.filter((file) => file.id !== fileId));
  }

  async function moveFile(fileId: string, direction: -1 | 1) {
    const index = files.findIndex((file) => file.id === fileId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target], next[index]];
    await replaceFiles(next);
  }

  function setSourceId(nextSourceId: TransactionImportSourceId) {
    if (nextSourceId === sourceId) return;
    analysisIdRef.current += 1;
    setSourceIdState(nextSourceId);
    selectedAssetsRef.current.clear();
    lookupCacheRef.current.clear();
    setExternalActivityConfirmed(false);
    setFiles([]);
    setCasPassword("");
    setCasSource(undefined);
    clearAnalysis();
    setScreenError(undefined);
    setIsResolving(false);
  }

  function selectCandidate(key: string, asset: Asset) {
    selectedAssetsRef.current.set(key, asset);
    setResolutions((current) =>
      current.map((resolution) =>
        identityKey(resolution) === key
          ? { ...resolution, asset, status: "ready" }
          : resolution,
      ),
    );
  }

  const groups = groupResolutions(resolutions, snapshot.assets);
  function acceptSuggestedMatches() {
    const accepted = new Map<string, Asset>();
    for (const group of groups) {
      if (!group.identityConflict && !group.selectedAsset && group.suggestedAsset) {
        accepted.set(group.key, group.suggestedAsset);
        selectedAssetsRef.current.set(group.key, group.suggestedAsset);
      }
    }
    setResolutions((current) => current.map((resolution) => {
      const asset = accepted.get(identityKey(resolution));
      return asset ? { ...resolution, asset, status: "ready" } : resolution;
    }));
  }

  const currentDate = now();
  const plan = buildTransactionImportPlan({
    batchId: batchIdRef.current,
    cutoverByOpeningPositionId,
    mode,
    now: currentDate,
    resolutions,
    sharedCutover: sharedCutover || undefined,
    sourceCoverageConfirmed: externalActivityConfirmed,
    state: snapshot,
    unsupportedCount,
  });
  const cutoverHoldings = [
    ...new Map(
      resolutions
        .filter(
          (resolution) => resolution.status === "ready" && resolution.asset,
        )
        .flatMap((resolution) =>
          snapshot.openingPositions
            .filter(
              (position) => position.assetId === resolution.asset!.id,
            )
            .map(
              (position) =>
                [position.id, { asset: resolution.asset!, position }] as const,
            ),
        ),
    ).values(),
  ];
  const needsSharedCutover = cutoverHoldings.some(
    ({ position }) => !position.measuredAsOf,
  );

  function setCutover(openingPositionId: string, value: string) {
    setCutoverByOpeningPositionId((current) => ({
      ...current,
      [openingPositionId]: value,
    }));
  }

  function confirmImport() {
    if (store.getState().restoreEpoch !== restoreEpochRef.current) {
      setScreenError("The portfolio was restored. Reopen import to review this file again.");
      return;
    }
    if (!plan.command || isSaving || isResolving || parseErrors.length > 0 || casReviewErrors.length > 0) return;
    setIsSaving(true);
    setScreenError(undefined);
    try {
      onImported(store.getState().recordTransactionImport(plan.command));
    } catch {
      setScreenError(
        "Nothing was imported. Your portfolio and Cash Ledger stayed unchanged; review the conflicts and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function retryCasStatement() {
    if (!casSource) return;
    await analyzeCasStatement(casSource);
  }

  return {
    confirmImport,
    acceptSuggestedMatches,
    casPassword,
    casReview,
    casReviewErrors,
    casSource,
    cutoverHoldings,
    cutoverByOpeningPositionId,
    externalActivityConfirmed,
    files,
    fileSummaries,
    groups,
    isResolving,
    isSaving,
    maxFiles: transactionImportMaxFiles,
    maxRows: transactionCsvMaxRows,
    mode,
    moveFile,
    needsSharedCutover,
    parseErrors,
    plan,
    removeFile,
    retryCasStatement,
    screenError,
    selectCandidate,
    selectFile,
    setCutover,
    setCasPassword,
    setExternalActivityConfirmed,
    setMode,
    setSharedCutover,
    setSourceId,
    sharedCutover,
    snapshot,
    sourceId,
    unsupportedCount,
    unsupportedEvents,
    today: currentDate,
  };
}
