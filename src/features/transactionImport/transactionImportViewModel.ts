import { demergerCatalog } from "@/src/domain/demergers";
import { formatCurrency } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";
import type { TransactionImportSourceId } from "@/src/domain/transactionImportSources";
import { casPdfMaxBytes, casPdfMaxPages } from "@/src/services/import-export";
import type { Asset } from "@/src/types";

import type { TransactionImportMode, TransactionImportPlan } from "./transactionImport";
import type { ResolutionGroup } from "./transactionImportResolution";
import type { TransactionImportController } from "./useTransactionImport";

type PlanError = TransactionImportPlan["errors"][number];
type PlanHolding = TransactionImportPlan["holdings"][number];
type PlanDemerger = NonNullable<TransactionImportPlan["demergers"]>[number];
type StockSplit = NonNullable<PlanHolding["asset"]["stockSplits"]>[number];

/** Demerger entitlements that touch a holding in this import. */
export function getImportDemergers(plan: TransactionImportPlan) {
  return plan.demergers?.filter((event) =>
    event.kind === "entitlement" && plan.holdings.some((holding) =>
      holding.asset.id === event.sourceAssetId || holding.asset.id === event.assetId,
    ),
  ) ?? [];
}

export type ImportMatchGroups = ReturnType<typeof getMatchGroups>;

export function getMatchGroups(groups: ResolutionGroup[]) {
  const identityConflicts = groups.filter((group) => group.identityConflict);
  const unresolved = groups.filter((group) => !group.selectedAsset && !group.identityConflict);
  const suggested = unresolved.filter((group) => group.suggestedAsset);
  const matched = groups.filter((group) => group.selectedAsset && !group.identityConflict);

  return { identityConflicts, matched, suggested, unresolved };
}

/**
 * Plan errors shown in the dry run, with repeats counted once. Asset match
 * errors are left out; the match card already lists those holdings.
 */
export function groupPlanErrors(errors: PlanError[]) {
  return [...errors.reduce((groups, error) => {
    if (error.code === "unresolvedAsset" || error.code === "ambiguousAsset") return groups;
    const key = `${error.code}:${error.assetId ?? ""}:${error.message}`;
    const prior = groups.get(key);
    groups.set(key, { error, count: (prior?.count ?? 0) + 1 });
    return groups;
  }, new Map<string, { error: PlanError; count: number }>()).values()];
}

export function planErrorText(
  { count, error }: { count: number; error: PlanError },
  holdings: PlanHolding[],
  savedAssets: Asset[],
) {
  const asset = holdings.find((holding) => holding.asset.id === error.assetId)?.asset ??
    savedAssets.find((item) => item.id === error.assetId);

  return `${asset ? `${asset.name}: ` : ""}${error.message}${count > 1 ? ` (${count} transactions)` : ""}`;
}

export function hasSelectedImportInput(
  controller: Pick<TransactionImportController, "casSource" | "files">,
) {
  return controller.files.length > 0 || Boolean(controller.casSource);
}

/** A file or statement was read cleanly and has something to review. */
export function hasVerifiedImportInput(controller: TransactionImportController) {
  return hasSelectedImportInput(controller) &&
    !controller.isResolving &&
    !controller.screenError &&
    controller.parseErrors.length === 0 &&
    (controller.plan.summary.parsedRows > 0 || controller.unsupportedEvents.length > 0 || Boolean(controller.casReview));
}

/** The dry run appears once every holding is matched and nothing is pending. */
export function shouldShowDryRun(
  controller: TransactionImportController,
  { identityConflicts, unresolved }: ImportMatchGroups,
) {
  return identityConflicts.length === 0 &&
    unresolved.length === 0 &&
    !controller.isResolving &&
    Boolean(controller.groups.length > 0 || controller.unsupportedEvents.length > 0 || controller.casReview);
}

export function canConfirmImport(controller: TransactionImportController) {
  return !(
    !controller.plan.command ||
    controller.isSaving ||
    controller.isResolving ||
    controller.parseErrors.length > 0 ||
    controller.casReviewErrors.length > 0
  );
}

export function confirmImportTitle(controller: TransactionImportController) {
  if (controller.isSaving) return "Importing...";

  return controller.plan.command?.transactions.length === 0
    ? "Apply share adjustments"
    : "Confirm transaction import";
}

export function selectFileAction(
  sourceId: TransactionImportSourceId,
  hasSelectedInput: boolean,
) {
  const isCas = sourceId === "camsKfinCasPdfV1";
  const isTradebook = sourceId === "zerodhaTradebookEqV1";

  return {
    testID: isCas ? "select-cas-statement" : "select-transaction-csv",
    title: hasSelectedInput
      ? isCas ? "Choose another statement" : isTradebook ? "Add another Tradebook" : "Choose another CSV"
      : isCas ? "Choose CAS PDF" : isTradebook ? "Choose Tradebook CSV" : "Choose CSV",
  };
}

export function sourceLimitText(sourceId: TransactionImportSourceId, maxRows: number) {
  return sourceId === "camsKfinCasPdfV1"
    ? `Detailed CAS PDF: up to ${casPdfMaxPages} pages, ${casPdfMaxBytes / (1024 * 1024)} MB.`
    : `Per CSV: up to ${maxRows} rows, 1 MB.`;
}

export function fileSizeLabel(size: number) {
  return `${Math.max(1, Math.ceil(size / 1024))} KB`;
}

/** Tradebook downloads can arrive without a .csv name. */
export function importFileName(name: string) {
  return /\.csv$/iu.test(name) ? name : "Tradebook CSV";
}

export function parseErrorText(error: { message: string; rowNumber?: number }) {
  return `${error.rowNumber ? `Row ${error.rowNumber}: ` : ""}${error.message}`;
}

export function casStatementSummaryText(schemeCount: number, readyTransactions: number) {
  return `${schemeCount} ${schemeCount === 1 ? "scheme" : "schemes"} • ${readyTransactions} ${readyTransactions === 1 ? "transaction" : "transactions"} ready. Folio numbers stay private.`;
}

export function getCasSchemes(controller: TransactionImportController) {
  return controller.casReview?.normalization.schemes ?? [];
}

export function getCasReadyTransactions(controller: TransactionImportController) {
  return getCasSchemes(controller).reduce((total, scheme) => total + scheme.importableTransactions, 0);
}

export function matchSummaryText(
  sourceId: TransactionImportSourceId,
  { matched, unresolved }: ImportMatchGroups,
) {
  return sourceId === "camsKfinCasPdfV1"
    ? `${matched.length} classified • ${unresolved.length} need classification. Each ISIN maps to one local holding.`
    : `${matched.length} matched • ${unresolved.length} to confirm. Each choice applies to every transaction for that holding.`;
}

export function matchedDisclosureTitle(sourceId: TransactionImportSourceId, matchedCount: number) {
  return sourceId === "camsKfinCasPdfV1"
    ? `Review ${matchedCount} identified ${matchedCount === 1 ? "fund" : "funds"}`
    : `View ${matchedCount} matched holdings`;
}

export function rowAccountingText(plan: TransactionImportPlan) {
  return `${plan.summary.parsedRows} parsed rows • ${plan.summary.additions} proposed additions • ${plan.duplicates} duplicates • ${plan.conflicts} conflicting transactions • ${plan.summary.unplannedRows} need resolution. Nothing is saved until the whole batch is valid.`;
}

/** Opening balances a full-history import would replace. */
export function getReplacementHoldings(mode: TransactionImportMode, holdings: PlanHolding[]) {
  return mode === "fullHistory" ? holdings.filter((holding) => holding.baseline) : [];
}

export function replacementConsequenceText(exactCount: number, totalCount: number) {
  return `${exactCount} of ${totalCount} opening ${totalCount === 1 ? "balance" : "balances"} will be replaced after confirmation.${totalCount > exactCount ? ` ${totalCount - exactCount} will stay unchanged unless the imported history reconciles exactly.` : ""}`;
}

export function stockSplitText(holding: PlanHolding, event: StockSplit) {
  return `${holding.asset.name}: ${event.newShares} ${event.kind === "bonus" ? "bonus share(s)" : "shares"} for ${event.oldShares} held on ${event.effectiveDate}. Earlier eligible units are adjusted; invested cost is unchanged.`;
}

/**
 * How a demerger entitlement splits cost between the retained holding and the
 * new one, at the event.
 */
export function demergerPreviewLines(
  event: Extract<PlanDemerger, { kind: "entitlement" }>,
  holdings: PlanHolding[],
) {
  const terms = demergerCatalog.find((item) => item.id === event.eventId)!;
  const parent = holdings.find((holding) => holding.asset.id === event.sourceAssetId)?.asset;
  const parentFraction = decimal(1).minus(terms.childFraction);
  const parentCost = decimal(event.cost).dividedBy(terms.childFraction).times(parentFraction);

  return [
    `${parent?.name ?? "Retained holding"}: ${event.quantity} shares retained at the event, ${parentFraction.times(100).toString()}% of cost (${formatCurrency(parentCost.toNumber(), "INR")}).`,
    `${terms.childName}: ${event.quantity} new shares, ${decimal(terms.childFraction).times(100).toString()}% of cost (${formatCurrency(Number(event.cost), "INR")}).`,
    `Ex-date ${event.date}; new holding listed ${terms.availableFrom}. Values above are at the event, before later activity.`,
  ];
}

export function holdingMatchDetail(group: ResolutionGroup, chosen: Asset) {
  return [
    chosen.ticker,
    chosen.exchange,
    group.identityConflict
      ? "Historical identity unresolved"
      : chosen.id.startsWith("cas:")
        ? "From statement"
        : group.selectedAsset
          ? "Matched"
          : "Suggested match",
  ].filter(Boolean).join(" • ");
}

export function holdingMatchCountText(group: ResolutionGroup, chosen: Asset | undefined) {
  const count = group.rowNumbers.length;

  return `${count} ${count === 1 ? "transaction" : "transactions"}${chosen ? ` • ${group.title}` : ""}`;
}

export function candidateTitle(group: ResolutionGroup, candidate: Asset) {
  return group.casClassificationRequired
    ? `Classify as ${candidate.assetClass === "stock" ? "Equity" : "Debt"}`
    : `${candidate.name} • ${candidate.ticker}`;
}

export function candidateTestID(group: ResolutionGroup, candidate: Asset) {
  return `transaction-import-asset-${group.key}-candidate-${candidate.id}${group.casClassificationRequired ? `-${candidate.assetClass}` : ""}`;
}
