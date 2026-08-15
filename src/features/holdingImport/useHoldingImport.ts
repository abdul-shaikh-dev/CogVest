import { useRef, useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  holdingsCsvMaxRows,
  parseHoldingsCsv,
  type HoldingsCsvError,
} from "@/src/domain/holdingsCsv";
import {
  searchAssetLookupResults as searchAssetLookupResultsService,
  type AssetLookupResult,
  type AssetLookupSearchResult,
} from "@/src/services/assetLookup";
import {
  resolveQuote as resolveQuoteService,
  type QuoteResult,
  type ResolveQuoteInput,
} from "@/src/services/quotes";
import {
  getPortfolioStore,
  type OpeningPositionCommandResult,
  type PortfolioStoreState,
} from "@/src/store";
import { createId } from "@/src/utils";

import {
  assetFromLookupResult,
  buildHoldingsCsvImportPlan,
  buildManualAssetFromCsvRow,
  classifyCsvLookupResults,
  lookupQueryForCsvRow,
  type HoldingsCsvResolution,
} from "./holdingImport";

export const holdingsCsvMaxBytes = 1_000_000;

export type PickedHoldingsCsv = {
  name: string;
  size: number;
  text: string;
};

type UseHoldingImportOptions = {
  now?: () => Date;
  onImported: (result: {
    items: OpeningPositionCommandResult[];
    pendingValuations: number;
  }) => void;
  pickCsvFile: () => Promise<PickedHoldingsCsv | undefined>;
  resolveQuote?: (input: ResolveQuoteInput) => Promise<QuoteResult>;
  searchAssetLookupResults?: (input: {
    query: string;
  }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

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

export function useHoldingImport({
  now = () => new Date(),
  onImported,
  pickCsvFile,
  resolveQuote = resolveQuoteService,
  searchAssetLookupResults = searchAssetLookupResultsService,
  store = getPortfolioStore(),
}: UseHoldingImportOptions) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const batchIdRef = useRef(createId("holdings-csv"));
  const selectionGenerationRef = useRef(0);
  const [fileName, setFileName] = useState<string>();
  const [parseErrors, setParseErrors] = useState<HoldingsCsvError[]>([]);
  const [resolutions, setResolutions] = useState<HoldingsCsvResolution[]>([]);
  const [screenError, setScreenError] = useState<string>();
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function addQuote(resolution: HoldingsCsvResolution) {
    if (
      resolution.status !== "ready" ||
      !resolution.asset ||
      resolution.row.currentPrice !== undefined
    ) {
      return resolution;
    }

    const result = await resolveQuote({
      asset: resolution.asset,
      cachedQuote: snapshot.quoteCache[resolution.asset.id],
    });
    if (result.ok) return { ...resolution, quote: result.quote };
    if (result.fallbackQuote) {
      return {
        ...resolution,
        quote: result.fallbackQuote,
        quoteFailure: result.error,
      };
    }
    return { ...resolution, quoteFailure: result.error };
  }

  async function selectFile() {
    const generation = selectionGenerationRef.current + 1;
    selectionGenerationRef.current = generation;
    setScreenError(undefined);
    setIsResolving(true);
    try {
      const file = await pickCsvFile();
      if (generation !== selectionGenerationRef.current) return;
      if (!file) return;
      setFileName(file.name);
      setParseErrors([]);
      setResolutions([]);
      batchIdRef.current = createId("holdings-csv");
      if (file.size > holdingsCsvMaxBytes || file.text.length > holdingsCsvMaxBytes) {
        setParseErrors([
          {
            code: "rowLimit",
            message: "CSV file is too large. Use at most 500 holdings and a 1 MB file.",
          },
        ]);
        setResolutions([]);
        return;
      }

      const parsed = parseHoldingsCsv(file.text, now());
      setParseErrors(parsed.errors);
      if (parsed.errors.length > 0) {
        setResolutions([]);
        return;
      }

      const next = await mapWithConcurrency(parsed.rows, 4, async (row) => {
        let lookup: AssetLookupSearchResult;
        try {
          lookup = await searchAssetLookupResults({
            query: lookupQueryForCsvRow(row),
          });
        } catch {
          lookup = {
            failures: [
              "Asset lookup is unavailable. Confirm the CSV details to continue manually.",
            ],
            results: [],
          };
        }
        return addQuote(
          classifyCsvLookupResults({
            assets: snapshot.assets,
            failures: lookup.failures,
            results: lookup.results,
            row,
          }),
        );
      });
      if (generation !== selectionGenerationRef.current) return;
      setResolutions(next);
    } catch {
      if (generation !== selectionGenerationRef.current) return;
      setFileName(undefined);
      setParseErrors([]);
      setResolutions([]);
      setScreenError("This CSV could not be read. Choose the template again.");
    } finally {
      if (generation === selectionGenerationRef.current) {
        setIsResolving(false);
      }
    }
  }

  async function selectCandidate(rowNumber: number, result: AssetLookupResult) {
    setIsResolving(true);
    try {
      const current = resolutions.find(
        (resolution) => resolution.row.rowNumber === rowNumber,
      );
      if (!current) return;
      const next = await addQuote({
        ...current,
        asset: assetFromLookupResult(result),
        status: "ready",
      });
      setResolutions((items) =>
        items.map((item) => (item.row.rowNumber === rowNumber ? next : item)),
      );
    } finally {
      setIsResolving(false);
    }
  }

  function useManualAsset(rowNumber: number) {
    setResolutions((items) =>
      items.map((item) => {
        if (item.row.rowNumber !== rowNumber) return item;
        const asset = buildManualAssetFromCsvRow(item.row);
        return asset
          ? { ...item, asset, status: "ready" }
          : {
              ...item,
              lookupFailure:
                "Manual rows need asset_class and, for stocks or ETFs, exchange in the CSV.",
            };
      }),
    );
  }

  function allowExistingUpdate(rowNumber: number) {
    setResolutions((items) =>
      items.map((item) =>
        item.row.rowNumber === rowNumber
          ? { ...item, allowExistingUpdate: true }
          : item,
      ),
    );
  }

  const plan = buildHoldingsCsvImportPlan({
    batchId: batchIdRef.current,
    now: now(),
    resolutions,
    state: snapshot,
  });

  async function confirmImport() {
    if (!plan.command || !plan.summary || isSaving) return;
    setIsSaving(true);
    setScreenError(undefined);
    try {
      const result = store
        .getState()
        .recordOpeningPositionBatch(plan.command);
      onImported({
        items: result.items,
        pendingValuations: plan.summary.pendingValuations,
      });
    } catch {
      setScreenError(
        "Nothing was imported. The portfolio stayed unchanged; review the rows and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return {
    allowExistingUpdate,
    confirmImport,
    fileName,
    isResolving,
    isSaving,
    maxRows: holdingsCsvMaxRows,
    parseErrors,
    plan,
    resolutions,
    screenError,
    selectCandidate,
    selectFile,
    snapshot,
    useManualAsset,
  };
}
