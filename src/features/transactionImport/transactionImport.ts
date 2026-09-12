import {
  findCanonicalAsset,
  normalizeAssetMetadata,
  normalizeIsin,
} from "@/src/domain/assets";
import { getCalendarDatePart, isFutureCalendarDate, parseCalendarDate } from "@/src/domain/dates";
import { normalizeTrade } from "@/src/domain/financialRecords";
import { decimal } from "@/src/domain/precision";
import {
  matchesOpeningPosition,
  reconcileTransactions,
  type TransactionReconciliation,
} from "@/src/domain/transactionReconciliation";
import type { TransactionCsvCandidate } from "@/src/domain/transactionCsv";
import { hasAmbiguousSameDayTransactionOrder } from "@/src/domain/transactionSemantics";
import type {
  PortfolioStoreState,
  TransactionImportCommandInput,
} from "@/src/store";
import type { Asset, OpeningPosition, Trade } from "@/src/types";
import { conflictingHistoricalRows, hasValidSplitSourceDate } from "./transactionImportMatching";
import { splitCanonicalIsin, withVerifiedStockSplits } from "@/src/domain/stockSplitCatalog";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { projectDemergers, proposeDemergers } from "@/src/domain/demergers";
import type { DemergerAdjustment } from "@/src/domain/demergerEvents";

export const transactionImportSourceFormat = "cogvest-transactions";
export const transactionImportSourceVersion = "1";

export type TransactionImportMode = "fullHistory" | "supplemental";

export type TransactionCsvResolution = {
  asset?: Asset;
  candidates?: Asset[];
  row: TransactionCsvCandidate;
  status: "ready" | "selectionRequired" | "unresolved";
};

export type TransactionImportPlanError = {
  assetId?: string;
  code:
    | "ambiguousAsset"
    | "ambiguousSameDayOrder"
    | "conflictingIdentity"
    | "currencyMismatch"
    | "duplicateAssetIdentity"
    | "futureDate"
    | "historicalIdentityConflict"
    | "incompleteCasHistory"
    | "invalidCutover"
    | "missingCutover"
    | "missingSourceCoverage"
    | "multipleBaselines"
    | "preCutoverTransaction"
    | "reconciliationMismatch"
    | "unsupportedSourceEvents"
    | "unresolvedAsset"
    | "unresolvedTransfer"
    | "wouldOversell";
  message: string;
  rowNumber?: number;
};

export type TransactionImportHoldingPreview = {
  asset: Asset;
  baseline?: OpeningPosition;
  cutover?: string;
  importedTransactions: number;
  mode: TransactionImportMode;
  reconciliation: TransactionReconciliation;
  replacementExact: boolean;
};

export type TransactionImportPlan = {
  demergers?: DemergerAdjustment[];
  command?: TransactionImportCommandInput;
  conflicts: number;
  duplicates: number;
  errors: TransactionImportPlanError[];
  holdings: TransactionImportHoldingPreview[];
  summary: {
    additions: number;
    parsedRows: number;
    unplannedRows: number;
    affectedHoldings: number;
    unsupported: number;
  };
};

export type CasOpeningEvidence = {
  coverageFrom?: string;
  schemes: Array<{
    folioLabel: string;
    isin: string;
    openingUnits: string;
  }>;
};

type BuildTransactionImportPlanInput = {
  batchId: string;
  casOpeningEvidence?: CasOpeningEvidence;
  cutoverByOpeningPositionId?: Record<string, string>;
  mode: TransactionImportMode;
  now?: Date;
  resolutions: TransactionCsvResolution[];
  sharedCutover?: string;
  sourceCoverageConfirmed?: boolean;
  state: PortfolioStoreState;
  unsupportedCount?: number;
};

function normalizeScope(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

function externalIdentity(
  sourceFormat: string,
  account: string | undefined,
  externalId: string,
) {
  return [sourceFormat, normalizeScope(account), normalizeScope(externalId)].join(
    "|",
  );
}

function fingerprintIdentity(
  sourceFormat: string,
  account: string | undefined,
  fingerprint: string,
) {
  return [sourceFormat, normalizeScope(account), fingerprint].join("|");
}

function resolvedTransactionFingerprint(
  transaction: Trade,
  currency: string,
) {
  return JSON.stringify([
    transaction.type,
    transaction.date,
    transaction.assetId,
    currency,
    transaction.quantity,
    transaction.type === "buy" || transaction.type === "sell"
      ? transaction.pricePerUnit
      : null,
    transaction.type === "transferIn"
      ? transaction.acquisitionCostPerUnit ?? null
      : null,
  ]);
}

function materialTransactionKey(transaction: Trade) {
  const provenance = transaction.importProvenance;
  return JSON.stringify({
    acquisitionCostPerUnit:
      transaction.type === "transferIn"
        ? transaction.acquisitionCostPerUnit ?? null
        : null,
    assetId: transaction.assetId,
    date: transaction.date,
    importProvenance: provenance
      ? {
          account: provenance.account ?? null,
          externalId: provenance.externalId ?? null,
          fees: provenance.fees ?? null,
          originalDescription: provenance.originalDescription ?? null,
          settlementDate: provenance.settlementDate ?? null,
          sourceExchange: provenance.sourceExchange ?? null,
          sourceExecutedAt: provenance.sourceExecutedAt ?? null,
          sourceOrderId: provenance.sourceOrderId ?? null,
          sourceSegment: provenance.sourceSegment ?? null,
          sourceSymbol: provenance.sourceSymbol ?? null,
          taxes: provenance.taxes ?? null,
        }
      : null,
    notes: transaction.notes ?? null,
    pricePerUnit:
      transaction.type === "buy" || transaction.type === "sell"
        ? transaction.pricePerUnit
        : null,
    quantity: transaction.quantity,
    type: transaction.type,
  });
}

function selectedAssetMatchesRow(asset: Asset, row: TransactionCsvCandidate) {
  if (row.identity.kind === "isin") {
    const rowIsin = normalizeIsin(row.identity.value);
    const assetIsin = normalizeIsin(asset.isin);
    return assetIsin === undefined || splitCanonicalIsin(assetIsin) === splitCanonicalIsin(rowIsin);
  }

  return (
    normalizeScope(asset.exchange) === normalizeScope(row.identity.exchange) &&
    (normalizeScope(asset.symbol) === normalizeScope(row.identity.symbol) ||
      normalizeScope(asset.ticker) === normalizeScope(row.identity.symbol))
  );
}

function assetForResolution(
  resolution: TransactionCsvResolution,
  state: PortfolioStoreState,
) {
  if (resolution.status !== "ready" || !resolution.asset) return undefined;

  const withCsvIdentity =
    resolution.row.identity.kind === "isin" && !resolution.asset.isin
      ? { ...resolution.asset, isin: resolution.row.identity.value }
      : resolution.asset;
  const normalized = withVerifiedStockSplits(normalizeAssetMetadata(withCsvIdentity));
  const canonical = findCanonicalAsset(state.assets, normalized);
  return withVerifiedStockSplits(canonical && normalized.isin && !canonical.isin
    ? { ...canonical, isin: normalized.isin }
    : (canonical ?? normalized));
}

function transactionFromRow(
  row: TransactionCsvCandidate,
  assetId: string,
  batchId: string,
): Trade {
  const importProvenance = {
    ...(row.identity.kind === "isin" ? { sourceIsin: normalizeIsin(row.identity.value) } : {}),
    ...(row.account ? { account: row.account } : {}),
    ...(row.externalId ? { externalId: row.externalId } : {}),
    ...(row.fees === undefined ? {} : { fees: row.fees }),
    importBatchId: batchId,
    ...(row.description ? { originalDescription: row.description } : {}),
    originalRowNumber: row.rowNumber,
    ...(row.settlementDate ? { settlementDate: row.settlementDate } : {}),
    ...(row.source?.exchange ? { sourceExchange: row.source.exchange } : {}),
    ...(row.source?.executedAt ? { sourceExecutedAt: row.source.executedAt } : {}),
    ...(row.source?.fileIndex === undefined
      ? {}
      : { sourceFileIndex: row.source.fileIndex }),
    ...(row.source?.fileName ? { sourceFileName: row.source.fileName } : {}),
    sourceFormat: row.source?.format ?? transactionImportSourceFormat,
    ...(row.source?.orderId ? { sourceOrderId: row.source.orderId } : {}),
    ...(row.source?.segment ? { sourceSegment: row.source.segment } : {}),
    ...(row.source?.symbol ? { sourceSymbol: row.source.symbol } : {}),
    sourceVersion: row.source?.version ?? transactionImportSourceVersion,
    ...(row.taxes === undefined ? {} : { taxes: row.taxes }),
  };
  const base = {
    assetId,
    date: row.tradeDate,
    id:
      row.source?.fileIndex === undefined
        ? `${batchId}:row-${row.rowNumber}`
        : `${batchId}:file-${row.source.fileIndex}:row-${row.rowNumber}`,
    importProvenance,
    ...(row.notes ? { notes: row.notes } : {}),
    quantity: row.quantity,
  };

  let transaction: Trade;
  if (row.transactionType === "buy" || row.transactionType === "sell") {
    transaction = normalizeTrade({
      ...base,
      pricePerUnit: row.unitPrice!,
      totalValue: row.quantity * row.unitPrice!,
      type: row.transactionType,
    });
  } else if (row.transactionType === "transferIn") {
    transaction = normalizeTrade({
      ...base,
      ...(row.acquisitionCost === undefined
        ? {}
        : { acquisitionCostPerUnit: row.acquisitionCost }),
      type: "transferIn",
    });
  } else {
    transaction = normalizeTrade({ ...base, type: "transferOut" });
  }

  return {
    ...transaction,
    importProvenance: {
      ...transaction.importProvenance!,
      fingerprint: resolvedTransactionFingerprint(transaction, row.currency),
    },
  };
}

function resolveCutover({
  cutoverByOpeningPositionId,
  openingPosition,
  sharedCutover,
}: Pick<
  BuildTransactionImportPlanInput,
  "cutoverByOpeningPositionId" | "sharedCutover"
> & { openingPosition: OpeningPosition }) {
  return (
    cutoverByOpeningPositionId?.[openingPosition.id] ??
    openingPosition.measuredAsOf ??
    sharedCutover
  );
}

function transactionCalendarDate(transaction: Trade) {
  return getCalendarDatePart(transaction.date) ?? transaction.date;
}

function previousCalendarDate(value: string) {
  const parsed = parseCalendarDate(value);
  if (!parsed) return undefined;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day - 1));
  return date.toISOString().slice(0, 10);
}

function validateCasOpeningEvidence({
  assetsById,
  casOpeningEvidence,
  cutoverByOpeningPositionId,
  errors,
  mode,
  resolutions,
  sharedCutover,
  state,
}: Pick<
  BuildTransactionImportPlanInput,
  | "casOpeningEvidence"
  | "cutoverByOpeningPositionId"
  | "mode"
  | "resolutions"
  | "sharedCutover"
  | "state"
> & {
  assetsById: Map<string, Asset>;
  errors: TransactionImportPlanError[];
}) {
  const incomingCasIsins = new Set<string>();
  for (const resolution of resolutions) {
    if (resolution.row.source?.format !== "cams-kfin-cas") continue;
    const rowIsin = resolution.row.identity.kind === "isin"
      ? normalizeIsin(resolution.row.identity.value)
      : normalizeIsin(resolution.row.isin);
    const canonicalIsin = splitCanonicalIsin(rowIsin);
    if (!canonicalIsin) {
      errors.push({
        code: "incompleteCasHistory",
        message: "A CAS transaction has no verifiable scheme identity. Use a detailed CAS beginning with the first investment.",
        rowNumber: resolution.row.rowNumber,
      });
      continue;
    }
    incomingCasIsins.add(canonicalIsin);
  }

  if (!casOpeningEvidence) {
    if (incomingCasIsins.size > 0) {
      errors.push({
        code: "incompleteCasHistory",
        message: "CAS opening-balance evidence is missing. Read the detailed CAS again before importing any transactions.",
      });
    }
    return;
  }

  const openingsByIsin = new Map<string, ReturnType<typeof decimal>>();
  try {
    for (const scheme of casOpeningEvidence.schemes) {
      const isin = splitCanonicalIsin(normalizeIsin(scheme.isin));
      if (!isin) throw new Error("invalid ISIN");
      const opening = decimal(scheme.openingUnits);
      if (opening.isNegative()) throw new Error("negative opening units");
      openingsByIsin.set(isin, (openingsByIsin.get(isin) ?? decimal(0)).plus(opening));
    }
  } catch {
    errors.push({
      code: "incompleteCasHistory",
      message: "The CAS opening quantities cannot be verified. Use a detailed CAS beginning with the first investment.",
    });
    return;
  }

  const missingEvidence = [...incomingCasIsins].some((isin) => !openingsByIsin.has(isin));
  if (missingEvidence) {
    errors.push({
      code: "incompleteCasHistory",
      message: "CAS opening-balance evidence does not cover every incoming scheme. Read the detailed CAS again before importing any transactions.",
    });
  }

  const nonzeroOpenings = [...openingsByIsin].filter(([, units]) => !units.isZero());
  if (nonzeroOpenings.length === 0) return;
  if (mode === "fullHistory") {
    errors.push({
      code: "incompleteCasHistory",
      message: "This CAS starts with an existing opening balance, so it is not complete investment history. Use a detailed CAS beginning with the first investment, or add later activity against a matching saved opening balance.",
    });
    return;
  }

  const requiredCutover = casOpeningEvidence.coverageFrom
    ? previousCalendarDate(casOpeningEvidence.coverageFrom)
    : undefined;
  if (!requiredCutover) {
    errors.push({
      code: "incompleteCasHistory",
      message: "The CAS statement start date is missing or invalid, so its opening units cannot be matched safely. Use a detailed CAS beginning with the first investment.",
    });
    return;
  }

  for (const [isin, openingUnits] of nonzeroOpenings) {
    const mappedAssets = [...assetsById.values()].filter((asset) => {
      const assetIsin = normalizeIsin(asset.isin);
      return assetIsin !== undefined && splitCanonicalIsin(assetIsin) === isin;
    });
    const uniqueAssets = [...new Map(mappedAssets.map((asset) => [asset.id, asset])).values()];
    if (uniqueAssets.length !== 1) {
      errors.push({
        code: "incompleteCasHistory",
        message: "A nonzero CAS opening balance could not be mapped to one resolved holding. Resolve that scheme, or use a detailed CAS beginning with the first investment.",
      });
      continue;
    }

    const asset = uniqueAssets[0];
    const baselines = state.openingPositions.filter((position) => position.assetId === asset.id);
    if (baselines.length !== 1) {
      errors.push({
        assetId: asset.id,
        code: "incompleteCasHistory",
        message: "This CAS starts with existing units, but the resolved holding does not have exactly one saved opening balance. Add or correct the opening balance, or use a detailed CAS beginning with the first investment.",
      });
      continue;
    }

    const baseline = baselines[0];
    if (!decimal(baseline.quantity).equals(openingUnits)) {
      errors.push({
        assetId: asset.id,
        code: "incompleteCasHistory",
        message: `The CAS opening quantity does not exactly match the saved opening balance for ${asset.name}. Correct the opening balance, or use a detailed CAS beginning with the first investment.`,
      });
      continue;
    }

    const cutover = resolveCutover({ cutoverByOpeningPositionId, openingPosition: baseline, sharedCutover });
    if (cutover !== requiredCutover) {
      errors.push({
        assetId: asset.id,
        code: "incompleteCasHistory",
        message: `Set the Add later activity date for ${asset.name} to ${requiredCutover}, the calendar day before this CAS begins, or use a detailed CAS beginning with the first investment.`,
      });
    }
  }
}

export function buildTransactionImportPlan({
  batchId,
  casOpeningEvidence,
  cutoverByOpeningPositionId,
  mode,
  now = new Date(),
  resolutions,
  sharedCutover,
  sourceCoverageConfirmed = false,
  state,
  unsupportedCount = 0,
}: BuildTransactionImportPlanInput): TransactionImportPlan {
  const errors: TransactionImportPlanError[] = [];
  const holdings: TransactionImportHoldingPreview[] = [];
  const assetsById = new Map<string, Asset>();
  const rowsByAssetId = new Map<
    string,
    Array<{ row: TransactionCsvCandidate; transaction: Trade }>
  >();

  const historicalConflicts = conflictingHistoricalRows(resolutions, state.assets);
  for (const [index, resolution] of resolutions.entries()) {
    if (historicalConflicts.has(index)) {
      errors.push({
        assetId: resolution.asset?.id,
        code: "historicalIdentityConflict",
        message: "Different historical ISINs point to the same listing. Verify the corporate action before combining their quantities; keep the original source rows unchanged.",
        rowNumber: resolution.row.rowNumber,
      });
      continue;
    }
    const asset = assetForResolution(resolution, state);
    if (!asset) {
      errors.push({
        code:
          resolution.status === "selectionRequired"
            ? "ambiguousAsset"
            : "unresolvedAsset",
        message:
          resolution.status === "selectionRequired"
            ? "Select the matching asset before importing this row."
            : "This asset could not be resolved. Add or select the holding first.",
        rowNumber: resolution.row.rowNumber,
      });
      continue;
    }
    if (!selectedAssetMatchesRow(asset, resolution.row) || !hasValidSplitSourceDate(resolution.row)) {
      errors.push({
        assetId: asset.id,
        code: "conflictingIdentity",
        message: "The selected asset does not match the CSV identifier.",
        rowNumber: resolution.row.rowNumber,
      });
      continue;
    }
    if (asset.currency !== resolution.row.currency) {
      errors.push({
        assetId: asset.id,
        code: "currencyMismatch",
        message: `CSV currency ${resolution.row.currency} does not match ${asset.name} (${asset.currency}).`,
        rowNumber: resolution.row.rowNumber,
      });
      continue;
    }
    if (isFutureCalendarDate(resolution.row.tradeDate, now)) {
      errors.push({
        assetId: asset.id,
        code: "futureDate",
        message: "Future transaction dates cannot be imported.",
        rowNumber: resolution.row.rowNumber,
      });
      continue;
    }

    const priorAsset = assetsById.get(asset.id);
    if (
      priorAsset &&
      (priorAsset.currency !== asset.currency ||
        (resolution.row.identity.kind === "isin" &&
          normalizeIsin(priorAsset.isin) !== undefined &&
          splitCanonicalIsin(priorAsset.isin) !==
            splitCanonicalIsin(resolution.row.identity.value)))
    ) {
      errors.push({
        assetId: asset.id,
        code: "duplicateAssetIdentity",
        message: "Rows for the same asset resolve to conflicting metadata.",
        rowNumber: resolution.row.rowNumber,
      });
      continue;
    }
    assetsById.set(asset.id, asset);
    const item = {
      row: resolution.row,
      transaction: transactionFromRow(resolution.row, asset.id, batchId),
    };
    rowsByAssetId.set(asset.id, [...(rowsByAssetId.get(asset.id) ?? []), item]);
  }

  validateCasOpeningEvidence({
    assetsById,
    casOpeningEvidence,
    cutoverByOpeningPositionId,
    errors,
    mode,
    resolutions,
    sharedCutover,
    state,
  });

  const existingExternal = new Map<string, Trade>();
  const existingFingerprints = new Map<string, Trade>();
  for (const transaction of state.trades) {
    const provenance = transaction.importProvenance;
    if (!provenance) continue;
    if (provenance.externalId) {
      existingExternal.set(
        externalIdentity(
          provenance.sourceFormat,
          provenance.account,
          provenance.externalId,
        ),
        transaction,
      );
    }
    if (provenance.fingerprint) {
      existingFingerprints.set(
        fingerprintIdentity(
          provenance.sourceFormat,
          provenance.account,
          provenance.fingerprint,
        ),
        transaction,
      );
    }
  }

  const stagedExternal = new Map<string, Trade>();
  const stagedFingerprints = new Map<string, Trade>();
  const additions: Trade[] = [];
  let duplicates = 0;
  let conflicts = 0;

  for (const [assetId, items] of rowsByAssetId) {
    const kept: typeof items = [];
    for (const item of items) {
      const provenance = item.transaction.importProvenance!;
      const externalKey = provenance.externalId
        ? externalIdentity(
            provenance.sourceFormat,
            provenance.account,
            provenance.externalId,
          )
        : undefined;
      const fingerprintKey = fingerprintIdentity(
        provenance.sourceFormat,
        provenance.account,
        provenance.fingerprint!,
      );
      const externalMatch = externalKey
        ? existingExternal.get(externalKey) ?? stagedExternal.get(externalKey)
        : undefined;
      const existingFingerprintMatch = existingFingerprints.get(fingerprintKey);
      const stagedFingerprintMatch = stagedFingerprints.get(fingerprintKey);
      const fingerprintMatch =
        existingFingerprintMatch ?? stagedFingerprintMatch;
      const match = externalKey ? externalMatch : fingerprintMatch;

      if (match) {
        const exact = materialTransactionKey(match) === materialTransactionKey(item.transaction);
        if (
          stagedFingerprintMatch &&
          !externalMatch &&
          !provenance.externalId
        ) {
          conflicts += 1;
          errors.push({
            assetId,
            code: "conflictingIdentity",
            message:
              "Two rows are indistinguishable without an external ID. Add unique external_id values before importing.",
            rowNumber: item.row.rowNumber,
          });
          continue;
        }
        if (exact) {
          duplicates += 1;
          continue;
        }
        conflicts += 1;
        errors.push({
          assetId,
          code: "conflictingIdentity",
          message: externalMatch
            ? "This external transaction ID was already used for different data."
            : "This transaction fingerprint was already used for different data.",
          rowNumber: item.row.rowNumber,
        });
        continue;
      }

      if (externalKey) stagedExternal.set(externalKey, item.transaction);
      stagedFingerprints.set(fingerprintKey, item.transaction);
      kept.push(item);
      additions.push(item.transaction);
    }
    rowsByAssetId.set(assetId, kept);
  }

  const cutovers: TransactionImportCommandInput["cutovers"] = [];
  const replaceOpeningPositionIds: string[] = [];
  const eventOnlyAssets: Asset[] = [];
  let demergerAdjustments: DemergerAdjustment[] = [];
  const demergerAffected = new Set<string>();
  const demergerChanged = new Set<string>();
  try {
    const mergedAssets = [...state.assets.filter((asset) => !assetsById.has(asset.id)), ...assetsById.values()];
    const previewAssets = proposeDemergers({ ...state, assets: mergedAssets, trades: [...state.trades, ...additions] }, new Set(rowsByAssetId.keys()), formatLocalCalendarDate(now));
    for (const parent of previewAssets.filter((asset) => asset.demerger)) {
      const childId = parent.demerger!.childAssetId;
      if (!rowsByAssetId.has(parent.id) && !rowsByAssetId.has(childId)) continue;
      const savedLink = state.assets.find((asset) => asset.id === parent.id)?.demerger;
      if (savedLink?.eventId !== parent.demerger!.eventId || savedLink.childAssetId !== childId) {
        demergerChanged.add(parent.id); demergerChanged.add(childId);
      }
      for (const id of [parent.id, childId]) {
        demergerAffected.add(id);
        assetsById.set(id, previewAssets.find((asset) => asset.id === id)!);
        if (!rowsByAssetId.has(id)) rowsByAssetId.set(id, []);
      }
    }
    demergerAdjustments = projectDemergers({ assets: previewAssets, trades: [...state.trades, ...additions],
      openingPositions: mode === "fullHistory" ? state.openingPositions.filter((position) => !rowsByAssetId.has(position.assetId)) : state.openingPositions }, formatLocalCalendarDate(now));
  } catch (error) {
    errors.push({ code: "reconciliationMismatch", message: error instanceof Error ? error.message : "The demerger cannot be reconciled." });
  }

  for (const [assetId, items] of rowsByAssetId) {
    const asset = assetsById.get(assetId)!;
    const savedAsset = state.assets.find((candidate) => candidate.id === assetId);
    const eventOnly = items.length === 0 && savedAsset !== undefined &&
      asset.stockSplits?.some((event) => !savedAsset.stockSplits?.some((prior) => prior.id === event.id));
    if (items.length === 0 && !eventOnly && !demergerAffected.has(assetId)) continue;
    if (eventOnly) {
      if (!savedAsset?.isin || splitCanonicalIsin(savedAsset.isin) !== asset.isin) {
        errors.push({ assetId, code: "conflictingIdentity", message: "Verify the saved holding identity before attaching share adjustments." });
        continue;
      }
      eventOnlyAssets.push(asset);
    }
    if (demergerChanged.has(assetId) && !eventOnlyAssets.some((item) => item.id === assetId)) eventOnlyAssets.push(asset);
    const baselines = state.openingPositions.filter(
      (position) => position.assetId === assetId,
    );
    if (baselines.length > 1) {
      errors.push({
        assetId,
        code: "multipleBaselines",
        message: "This holding has multiple opening records and needs manual correction first.",
      });
      continue;
    }

    const baseline = baselines[0];
    const cutover = baseline
      ? eventOnly ? baseline.measuredAsOf : resolveCutover({ cutoverByOpeningPositionId, openingPosition: baseline, sharedCutover })
      : undefined;
    if (baseline && !cutover) {
      errors.push({
        assetId,
        code: "missingCutover",
        message: "Confirm when this holding baseline was measured before importing history.",
      });
      continue;
    }
    if (
      cutover &&
      (!getCalendarDatePart(cutover) || isFutureCalendarDate(cutover, now))
    ) {
      errors.push({
        assetId,
        code: "invalidCutover",
        message: "Holdings measured as of must be a valid date that is not in the future.",
      });
      continue;
    }

    const incoming = items.map((item) => item.transaction);
    const existing = state.trades.filter((trade) => trade.assetId === assetId);
    if (hasAmbiguousSameDayTransactionOrder(existing, incoming)) {
      errors.push({
        assetId,
        code: "ambiguousSameDayOrder",
        message:
          "Existing and imported acquisitions/disposals share a date, so their order cannot be verified. Correct the date or combine them in one ordered CSV.",
      });
      continue;
    }
    let reconciliation: TransactionReconciliation;
    let replacementExact = false;

    if ((mode === "supplemental" || eventOnly) && baseline) {
      const preCutover = items.filter(
        (item) => transactionCalendarDate(item.transaction) <= cutover!,
      );
      if (preCutover.length > 0) {
        for (const item of preCutover) {
          errors.push({
            assetId,
            code: "preCutoverTransaction",
            message: `Only transactions after the ${cutover} holdings baseline can be added in supplemental mode.`,
            rowNumber: item.row.rowNumber,
          });
        }
        continue;
      }
      reconciliation = reconcileTransactions({
        demergerAdjustments: demergerAdjustments.filter((event) => event.assetId === assetId),
        stockSplits: asset.stockSplits,
        through: formatLocalCalendarDate(now),
        openingMeasuredAsOf: cutover,
        openingPosition: baseline,
        transactions: [
          ...existing.filter(
            (trade) => transactionCalendarDate(trade) > cutover!,
          ),
          ...incoming,
        ],
      });
    } else if (mode === "fullHistory" && baseline) {
      const throughCutover = [...existing, ...incoming].filter(
        (trade) => transactionCalendarDate(trade) <= cutover!,
      );
      const baselineReconciliation = reconcileTransactions({
        demergerAdjustments: demergerAdjustments.filter((event) => event.assetId === assetId),
        stockSplits: asset.stockSplits,
        through: cutover,
        transactions: throughCutover,
      });
      replacementExact = matchesOpeningPosition(
        baselineReconciliation,
        baseline,
      );
      reconciliation = reconcileTransactions({
        demergerAdjustments: demergerAdjustments.filter((event) => event.assetId === assetId),
        stockSplits: asset.stockSplits,
        through: formatLocalCalendarDate(now),
        transactions: [...existing, ...incoming],
      });
      if (!replacementExact) {
        errors.push({
          assetId,
          code: "reconciliationMismatch",
          message: `Imported history resolves to ${baselineReconciliation.quantity} units at ${baselineReconciliation.averageCostPrice}, which does not exactly match the baseline of ${baseline.quantity} units at ${baseline.averageCostPrice}.`,
        });
      } else {
        replaceOpeningPositionIds.push(baseline.id);
      }
    } else {
      reconciliation = reconcileTransactions({
        demergerAdjustments: demergerAdjustments.filter((event) => event.assetId === assetId),
        stockSplits: asset.stockSplits,
        through: formatLocalCalendarDate(now),
        transactions: [...existing, ...incoming],
      });
    }

    if (reconciliation.unresolvedTransactionIds.length > 0) {
      errors.push({
        assetId,
        code: reconciliation.adjustmentError ? "reconciliationMismatch" : "unresolvedTransfer",
        message: reconciliation.adjustmentError ?? "A transfer in is missing acquisition cost, so average cost cannot be verified.",
      });
    }
    if (reconciliation.oversoldTransactionIds.length > 0) {
      errors.push({
        assetId,
        code: "wouldOversell",
        message: `Some sales of ${asset.name} have no earlier purchase balance in this batch. Add earlier annual files or the missing acquisition records; do not invent a purchase to make the balance fit.`,
      });
    }
    if (baseline && baseline.measuredAsOf !== cutover) {
      cutovers.push({ measuredAsOf: cutover!, openingPositionId: baseline.id });
    }
    holdings.push({
      asset,
      ...(baseline ? { baseline } : {}),
      ...(cutover ? { cutover } : {}),
      importedTransactions: incoming.length,
      mode,
      reconciliation,
      replacementExact,
    });
  }

  const includesZerodha = additions.some(
    (transaction) =>
      transaction.importProvenance?.sourceFormat === "zerodha-tradebook",
  );
  const includesCamsKfinCas = resolutions.some(
    (resolution) => resolution.row.source?.format === "cams-kfin-cas",
  );
  if (includesCamsKfinCas && unsupportedCount > 0) {
    errors.push({
      code: "unsupportedSourceEvents",
      message:
        "Resolve unsupported CAMS or KFintech statement events before importing this history.",
    });
  }
  if (mode === "fullHistory" && includesZerodha && !sourceCoverageConfirmed) {
    errors.push({
      code: "missingSourceCoverage",
      message:
        "Confirm that this account and date range had no Zerodha external trades before replacing opening balances.",
    });
  }
  if (mode === "fullHistory" && includesZerodha && unsupportedCount > 0) {
    errors.push({
      code: "unsupportedSourceEvents",
      message:
        "Resolve or exclude unsupported Zerodha events before replacing opening balances.",
    });
  }

  const summary = {
    additions: additions.length,
    parsedRows: resolutions.length,
    unplannedRows: resolutions.length - additions.length - duplicates - conflicts,
    affectedHoldings: holdings.length,
    unsupported: unsupportedCount,
  };
  if (eventOnlyAssets.length > 0 && unsupportedCount > 0) {
    errors.push({ code: "unsupportedSourceEvents", message: "Resolve unsupported source events before attaching share adjustments." });
  }
  if (errors.length > 0 || (additions.length === 0 && eventOnlyAssets.length === 0)) {
    return { conflicts, duplicates, errors, holdings, summary, demergers: demergerAdjustments };
  }

  return {
    demergers: demergerAdjustments,
    command: {
      assets: additions.length === 0 ? eventOnlyAssets : [...assetsById.values()],
      commandId: batchId,
      cutovers,
      mode,
      replaceOpeningPositionIds,
      ...(mode === "fullHistory" &&
      sourceCoverageConfirmed &&
      includesZerodha
        ? {
            sourceCoverage: {
              externalActivity: "noneConfirmed" as const,
              sourceFormat: "zerodha-tradebook",
            },
          }
        : {}),
      transactions: additions,
    },
    conflicts,
    duplicates,
    errors,
    holdings,
    summary,
  };
}
