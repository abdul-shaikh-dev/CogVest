import { useRef, useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import { normalizeIsin } from "@/src/domain/assets";
import {
  transactionCsvMaxBytes,
  transactionCsvMaxRows,
  type TransactionCsvError,
  type UnsupportedTransactionCsvEvent,
} from "@/src/domain/transactionCsv";
import type { TransactionImportSourceId } from "@/src/domain/transactionImportSources";
import type { AssetLookupSearchResult } from "@/src/services/assetLookup";
import { searchAssetLookupResults as searchAssetLookupResultsService } from "@/src/services/assetLookup";
import {
  lookupAmfiSchemeClassifications as lookupAmfiSchemeClassificationsService,
  type AmfiSchemeClassification,
  type AmfiSchemeLookupResult,
} from "@/src/services/mutualFunds/amfiSchemeCatalog";
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
import {
  getCutoverHoldings,
  getImportCoverage,
  parseTransactionImportFiles,
  type PickedTransactionCsv,
  type SelectedTransactionImportFile,
} from "./transactionImportAnalysis";
import {
  groupResolutions,
  identityKey,
  resolveTransactionRows,
} from "./transactionImportResolution";
import type { CasSchemeReview } from "@/src/domain/camsKfinCasNormalizer";

export { transactionCsvMaxBytes };
export type { PickedTransactionCsv, SelectedTransactionImportFile };

export const transactionImportMaxFiles = 10;

export type PickedCasStatement = CasPdfSourceFile;

export type UseTransactionImportOptions = {
  lookupAmfiSchemeClassifications?: (input: {
    isins: string[];
  }) => Promise<AmfiSchemeLookupResult>;
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

export function useTransactionImport({
  lookupAmfiSchemeClassifications = lookupAmfiSchemeClassificationsService,
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
  const [casClassificationNotice, setCasClassificationNotice] = useState<string>();
  const [casReview, setCasReview] = useState<CasStatementImportReview>();
  const [casReviewErrors, setCasReviewErrors] = useState<string[]>([]);
  const [casSource, setCasSource] = useState<PickedCasStatement>();
  const [sourceId, setSourceIdState] =
    useState<TransactionImportSourceId>("zerodhaTradebookEqV1");
  const [externalActivityConfirmed, setExternalActivityConfirmed] =
    useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hasSavedInvestmentHistory =
    snapshot.openingPositions.length > 0 || snapshot.trades.length > 0;
  const [mode, setMode] = useState<TransactionImportMode>(() =>
    hasSavedInvestmentHistory ? "supplemental" : "fullHistory",
  );
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
    setCasClassificationNotice(undefined);
    setSharedCutover("");
    setCutoverByOpeningPositionId({});
  }

  async function resolveRows(
    rows: TransactionCsvResolution["row"][],
    analysisId: number,
    casSchemes: CasSchemeReview[] = [],
    amfiClassifications: Record<string, AmfiSchemeClassification> = {},
  ) {
    const resolved = await resolveTransactionRows({
      amfiClassifications,
      casSchemes,
      existingAssets: snapshot.assets,
      isCurrent: () => analysisId === analysisIdRef.current,
      lookupCache: lookupCacheRef.current,
      rows,
      searchAssetLookupResults,
      selectedAssets: selectedAssetsRef.current,
    });
    if (analysisId === analysisIdRef.current) {
      setResolutions(resolved);
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
      const parsedFiles = parseTransactionImportFiles(
        nextFiles,
        nextSourceId,
        (fileId, summary) =>
          setFileSummaries((current) => ({ ...current, [fileId]: summary })),
      );
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
      const savedIsins = new Set(
        store.getState().assets
          .map((asset) => normalizeIsin(asset.isin))
          .filter((isin): isin is string => Boolean(isin)),
      );
      const newIsins = [...new Set(
        normalization.schemes
          .map((scheme) => normalizeIsin(scheme.isin))
          .filter((isin): isin is string => Boolean(isin && !savedIsins.has(isin))),
      )];
      const amfiLookup = normalization.rows.length > 0 && newIsins.length > 0
        ? await lookupAmfiSchemeClassifications({
          isins: newIsins,
        })
        : { classifications: {} };
      if (analysisId !== analysisIdRef.current) return;
      setCasClassificationNotice(amfiLookup.failure);
      await resolveRows(
        normalization.rows,
        analysisId,
        normalization.schemes,
        amfiLookup.classifications,
      );
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
    setMode(hasSavedInvestmentHistory ? "supplemental" : "fullHistory");
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
  const importCoverage = getImportCoverage(resolutions, casReview);
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
    casOpeningEvidence: sourceId === "camsKfinCasPdfV1" && casReview
      ? { coverageFrom: casReview.normalization.coverage?.from, schemes: casReview.normalization.schemes }
      : undefined,
    cutoverByOpeningPositionId,
    mode,
    now: currentDate,
    resolutions,
    sharedCutover: sharedCutover || undefined,
    sourceCoverageConfirmed: externalActivityConfirmed,
    state: snapshot,
    unsupportedCount,
  });
  const cutoverHoldings = getCutoverHoldings(resolutions, snapshot);
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
    casClassificationNotice,
    casReview,
    casReviewErrors,
    casSource,
    cutoverHoldings,
    cutoverByOpeningPositionId,
    externalActivityConfirmed,
    files,
    fileSummaries,
    groups,
    hasSavedInvestmentHistory,
    importCoverage,
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
