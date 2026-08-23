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

export const transactionImportMaxFiles = 10;

export type PickedTransactionCsv = {
  name: string;
  size: number;
  text: string;
};

export type SelectedTransactionImportFile = PickedTransactionCsv & {
  id: string;
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
  const analysisIdRef = useRef(0);
  const [files, setFiles] = useState<SelectedTransactionImportFile[]>([]);
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
    setSharedCutover("");
    setCutoverByOpeningPositionId({});
  }

  async function analyzeFiles(
    nextFiles: SelectedTransactionImportFile[],
    nextSourceId: TransactionImportSourceId,
  ) {
    const analysisId = ++analysisIdRef.current;
    setScreenError(undefined);
    clearAnalysis();
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

      const byKey = new Map<string, TransactionCsvResolution[]>();
      for (const row of parsedFiles.flatMap((parsed) => parsed.rows)) {
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
            const lookup = await searchAssetLookupResults({
              query: lookupQuery(first.row),
            });
            const candidates = lookup.results.map(assetFromLookupResult);
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

  async function replaceFiles(nextFiles: SelectedTransactionImportFile[]) {
    setExternalActivityConfirmed(false);
    setFiles(nextFiles);
    await analyzeFiles(nextFiles, sourceId);
  }

  async function selectFile() {
    setScreenError(undefined);
    try {
      const file = await pickCsvFile();
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
        "This CSV could not be read. Choose another file and try again.",
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
    setExternalActivityConfirmed(false);
    setFiles([]);
    clearAnalysis();
    setScreenError(undefined);
    setIsResolving(false);
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
    if (!plan.command || isSaving) return;
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

  return {
    confirmImport,
    cutoverHoldings,
    cutoverByOpeningPositionId,
    externalActivityConfirmed,
    files,
    groups: groupResolutions(resolutions),
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
    screenError,
    selectCandidate,
    selectFile,
    setCutover,
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
