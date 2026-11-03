import { demergerCatalog, projectDemergers } from "@/src/domain/demergers";
import {
  assertCatalogSplits,
  splitCanonicalIsin,
  withVerifiedStockSplits,
} from "@/src/domain/stockSplitCatalog";
import { normalizeAssetMetadata } from "@/src/domain/assets";
import { normalizeTrade } from "@/src/domain/financialRecords";
import {
  formatLocalCalendarDate,
  getCalendarDatePart,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import { isTransactionAfterOpeningCutover } from "@/src/domain/openingPositions";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";
import { hasAmbiguousSameDayTransactionOrder } from "@/src/domain/transactionSemantics";
import {
  matchesOpeningPosition,
  reconcileTransactions,
} from "@/src/domain/transactionReconciliation";
import type { Asset } from "@/src/types";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistAssetGraphTransition, selectRawSnapshot } from "./persistence";
import {
  assetRecordMonth,
  hasDuplicateAssetIdentity,
  openingPositionMonth,
  rebuildPortfolioSnapshots,
} from "./recordValidation";
import {
  isValidImportProvenance,
  isValidTradeRecord,
  tradeMonth,
  transactionImportIdentity,
  validateSplitInventory,
  wouldOversellAsset,
} from "./tradeRules";

type TransactionImportActions = Pick<PortfolioStoreState, "recordTransactionImport">;

export function createTransactionImportActions(context: StoreContext): TransactionImportActions {
  const { get, now, set, storage } = context;
  return {
    recordTransactionImport: (input) => {
      const state = get();
      const currentDate = now();
      if (!input.commandId.trim()) {
        throw new Error("Transaction import command is empty.");
      }
      if (input.mode !== "fullHistory" && input.mode !== "supplemental") {
        throw new Error("Transaction import mode is invalid.");
      }
      if (!input.transactions.length && input.assets.some((asset) => asset.demerger)) {
        if (input.cutovers.length || input.replaceOpeningPositionIds.length) throw new Error("A demerger-only correction cannot replace opening balances.");
        let assets = [...state.assets];
        const seen = new Set<string>();
        for (const proposed of input.assets) {
          if (seen.has(proposed.id)) throw new Error("Duplicate demerger holding proposal.");
          seen.add(proposed.id);
          const existing = assets.find((asset) => asset.id === proposed.id);
          if (existing) {
            if (!existing.isin || existing.isin !== proposed.isin || existing.currency !== proposed.currency || existing.assetClass !== proposed.assetClass ||
                (existing.demerger && JSON.stringify(existing.demerger) !== JSON.stringify(proposed.demerger))) throw new Error("The demerger holding identity changed after preview.");
            assertCatalogSplits(proposed);
            const updated = { ...existing, ...(proposed.stockSplits ? { stockSplits: proposed.stockSplits } : {}), ...(proposed.demerger ? { demerger: proposed.demerger } : {}) };
            assets = assets.map((asset) => asset.id === existing.id ? updated : asset);
          } else {
            const parent = input.assets.find((asset) => asset.demerger?.childAssetId === proposed.id);
            const event = demergerCatalog.find((item) => item.id === parent?.demerger?.eventId);
            if (!event || proposed.isin !== event.childIsin || proposed.quoteSourceId !== `${event.childSymbol}.NS` || hasDuplicateAssetIdentity(assets, proposed)) throw new Error("The new demerger successor is not a verified listing.");
            assets.push(proposed);
          }
        }
        validateSplitInventory({ ...state, assets });
        const adjustments = projectDemergers({ ...state, assets });
        for (const assetId of new Set(adjustments.map((event) => event.assetId))) {
          const openings = state.openingPositions.filter((item) => item.assetId === assetId);
          if (openings.length > 1 || !reconcileTransactions({ openingPosition: openings[0], openingMeasuredAsOf: openings[0]?.measuredAsOf,
            transactions: state.trades.filter((trade) => trade.assetId === assetId && isTransactionAfterOpeningCutover(trade.date, openings)),
            stockSplits: assets.find((asset) => asset.id === assetId)?.stockSplits,
            demergerAdjustments: adjustments.filter((event) => event.assetId === assetId) }).isExact) throw new Error("Demerged holdings no longer reconcile.");
        }
        if (JSON.stringify(assets) === JSON.stringify(state.assets)) return { added: 0, removedOpeningPositions: 0, updatedCutovers: 0, status: "alreadyApplied" as const };
        const monthlySnapshots = rebuildPortfolioSnapshots({ assets, earliestAffectedMonth: adjustments.map((event) => event.date.slice(0, 7)).sort()[0], now: currentDate, state }).monthlySnapshots;
        persistAssetGraphTransition({ historicalQuoteCache: state.historicalQuoteCache, portfolio: { ...selectRawSnapshot(state), assets, monthlySnapshots }, quoteCache: state.quoteCache, storage });
        set({ assets, monthlySnapshots });
        return { added: 0, removedOpeningPositions: 0, updatedCutovers: 0, status: "applied" as const };
      }
      // Event-only commands preserve executions, balances, and unrelated metadata.
      if (input.transactions.length === 0) {
        if (!input.assets.length || input.cutovers.length || input.replaceOpeningPositionIds.length) {
          throw new Error("Event-only imports require existing holdings and cannot change opening balances.");
        }
        const seen = new Set<string>();
        const updates = new Map<string, Asset>();
        const affectedMonths: string[] = [];
        for (const proposed of input.assets) {
          const existing = state.assets.find((asset) => asset.id === proposed.id);
          if (!existing || seen.has(proposed.id) || !proposed.stockSplits?.length ||
              !existing.isin || splitCanonicalIsin(existing.isin) !== proposed.isin ||
              existing.currency !== proposed.currency || existing.assetClass !== proposed.assetClass) {
            throw new Error("Event-only import holding identity is stale or invalid.");
          }
          seen.add(proposed.id);
          assertCatalogSplits(proposed);
          assertCatalogSplits(existing);
          const verified = withVerifiedStockSplits(existing);
          if (verified.stockSplits?.length !== proposed.stockSplits.length ||
              verified.stockSplits.some((event) => !proposed.stockSplits!.some((item) => item.id === event.id))) {
            throw new Error("Event-only import differs from the verified event chain.");
          }
          const updated = { ...existing, isin: verified.isin, stockSplits: verified.stockSplits };
          const openings = state.openingPositions.filter((position) => position.assetId === existing.id);
          if (openings.length > 1) throw new Error("Event-only import has multiple opening balances.");
          const baseline = openings[0];
          const reconciliation = reconcileTransactions({
            openingPosition: baseline,
            openingMeasuredAsOf: baseline?.measuredAsOf,
            stockSplits: updated.stockSplits,
            through: formatLocalCalendarDate(currentDate),
            transactions: state.trades.filter((trade) => trade.assetId === existing.id &&
              isTransactionAfterOpeningCutover(trade.date, openings)),
          });
          if (!reconciliation.isExact) throw new Error(reconciliation.adjustmentError ?? "Event-only import inventory no longer reconciles.");
          const addedEvents = verified.stockSplits!.filter((event) => !existing.stockSplits?.some((prior) => prior.id === event.id));
          if (addedEvents.length) {
            updates.set(existing.id, updated);
            const firstRecord = assetRecordMonth(state, existing.id);
            if (firstRecord) affectedMonths.push(firstRecord);
            affectedMonths.push(...addedEvents.map((event) => event.effectiveDate.slice(0, 7)));
          }
        }
        const assets = state.assets.map((asset) => updates.get(asset.id) ?? asset);
        validateSplitInventory({ ...state, assets });
        if (!updates.size) return { added: 0, removedOpeningPositions: 0, status: "alreadyApplied" as const, updatedCutovers: 0 };
        const monthlySnapshots = rebuildPortfolioSnapshots({
          assets, earliestAffectedMonth: affectedMonths.sort()[0], now: currentDate, state,
        }).monthlySnapshots;
        persistAssetGraphTransition({
          historicalQuoteCache: state.historicalQuoteCache,
          portfolio: { ...selectRawSnapshot(state), assets, monthlySnapshots },
          quoteCache: state.quoteCache, storage,
        });
        set({ assets, monthlySnapshots });
        return { added: 0, removedOpeningPositions: 0, status: "applied" as const, updatedCutovers: 0 };
      }
      const includesZerodha = input.transactions.some(
        (transaction) =>
          transaction.importProvenance?.sourceFormat === "zerodha-tradebook",
      );
      if (
        input.mode === "fullHistory" &&
        includesZerodha &&
        (input.sourceCoverage?.sourceFormat !== "zerodha-tradebook" ||
          input.sourceCoverage.externalActivity !== "noneConfirmed")
      ) {
        throw new Error(
          "Zerodha full-history import requires external-activity coverage confirmation.",
        );
      }

      const existingBatch = state.trades.filter(
        (trade) =>
          trade.importProvenance?.importBatchId === input.commandId,
      );
      if (existingBatch.length > 0) {
        const expectedById = new Map(
          input.transactions.map((trade) => [trade.id, normalizeTrade(trade)]),
        );
        if (
          existingBatch.length === input.transactions.length &&
          existingBatch.every((trade) => {
            const expected = expectedById.get(trade.id);
            return (
              expected !== undefined &&
              transactionImportIdentity(trade) ===
                transactionImportIdentity(expected)
            );
          })
        ) {
          return {
            added: 0,
            removedOpeningPositions: 0,
            status: "alreadyApplied" as const,
            updatedCutovers: 0,
          };
        }
        throw new Error("A partial transaction import batch already exists.");
      }

      const inputIds = new Set<string>();
      const normalizedTransactions = input.transactions.map((transaction) => {
        if (inputIds.has(transaction.id)) {
          throw new Error("Transaction import contains duplicate record IDs.");
        }
        inputIds.add(transaction.id);
        const normalized = normalizeTrade(transaction);
        const provenance = normalized.importProvenance;
        if (
          !provenance ||
          !isValidImportProvenance(provenance, input.commandId) ||
          !isValidTradeRecord(normalized, currentDate) ||
          (normalized.type === "transferIn" &&
            normalized.acquisitionCostPerUnit === undefined)
        ) {
          throw new Error("Transaction import contains an invalid record.");
        }
        return normalized;
      });
      if (
        normalizedTransactions.some((transaction) =>
          state.trades.some((existing) => existing.id === transaction.id),
        )
      ) {
        throw new Error("Transaction import record ID already exists.");
      }

      const identityKeys = new Map<string, string>();
      for (const transaction of [...state.trades, ...normalizedTransactions]) {
        const provenance = transaction.importProvenance;
        if (!provenance) continue;
        const keys = provenance.externalId
          ? [
              [
                  "external",
                  provenance.sourceFormat,
                  provenance.account?.trim().toUpperCase() ?? "",
                  provenance.externalId.trim().toUpperCase(),
              ].join("|"),
            ]
          : provenance.fingerprint
            ? [
                [
                    "fingerprint",
                    provenance.sourceFormat,
                    provenance.account?.trim().toUpperCase() ?? "",
                    provenance.fingerprint,
                ].join("|"),
              ]
            : [];
        for (const key of keys) {
          const priorId = identityKeys.get(key);
          if (priorId && priorId !== transaction.id) {
            throw new Error("Transaction import identity conflicts with existing data.");
          }
          identityKeys.set(key, transaction.id);
        }
      }

      let assets = [...state.assets];
      for (const rawAsset of input.assets) {
        const candidate = withVerifiedStockSplits(normalizeAssetMetadata(rawAsset));
        const existingById = assets.find((asset) => asset.id === candidate.id);
        if (candidate.demerger && existingById && (!existingById.isin || existingById.isin !== candidate.isin ||
            (existingById.demerger && JSON.stringify(existingById.demerger) !== JSON.stringify(candidate.demerger)))) throw new Error("The demerger identity changed after preview.");
        if (candidate.stockSplits?.length && !normalizedTransactions.some((trade) => trade.assetId === candidate.id)) {
          if (!existingById?.isin || !rawAsset.stockSplits?.length ||
              splitCanonicalIsin(existingById.isin) !== candidate.isin ||
              existingById.currency !== candidate.currency || existingById.assetClass !== candidate.assetClass) {
            throw new Error("Event-only import holding identity is stale or invalid.");
          }
          assertCatalogSplits(existingById);
          const openings = state.openingPositions.filter((position) => position.assetId === candidate.id);
          if (openings.length > 1 || openings.some((position) =>
            input.cutovers.some((cutover) => cutover.openingPositionId === position.id) ||
            input.replaceOpeningPositionIds.includes(position.id))) {
            throw new Error("Event-only imports cannot change opening balances.");
          }
          const baseline = openings[0];
          const reconciliation = reconcileTransactions({
            openingPosition: baseline,
            openingMeasuredAsOf: baseline?.measuredAsOf,
            stockSplits: candidate.stockSplits,
            through: formatLocalCalendarDate(currentDate),
            transactions: state.trades.filter((trade) => trade.assetId === candidate.id &&
              isTransactionAfterOpeningCutover(trade.date, openings)),
          });
          if (!reconciliation.isExact) throw new Error(reconciliation.adjustmentError ?? "Event-only import inventory no longer reconciles.");
        }
        if (existingById) {
          if (
            candidate.isin &&
            existingById.isin &&
            splitCanonicalIsin(candidate.isin) !== splitCanonicalIsin(existingById.isin)
          ) {
            throw new Error("Transaction import asset identity conflicts with existing data.");
          }
          if (candidate.isin && !existingById.isin) {
            assets = assets.map((asset) =>
              asset.id === candidate.id ? { ...asset, isin: candidate.isin } : asset,
            );
          }
          if (candidate.stockSplits?.length) {
            assertCatalogSplits(existingById);
            assets = assets.map((asset) => asset.id === candidate.id
              ? { ...asset, isin: candidate.isin, stockSplits: candidate.stockSplits } : asset);
          }
          if (candidate.demerger) assets = assets.map((asset) => asset.id === candidate.id ? { ...asset, demerger: candidate.demerger } : asset);
          continue;
        }
        if (
          getV1AssetCurrencyIssue(candidate) ||
          hasDuplicateAssetIdentity(assets, candidate)
        ) {
          throw new Error("Transaction import asset identity is invalid.");
        }
        assets.push(candidate);
      }
      if (
        normalizedTransactions.some(
          (transaction) => !assets.some((asset) => asset.id === transaction.assetId),
        )
      ) {
        throw new Error("Transaction import references an unknown asset.");
      }

      const cutoverIds = new Set<string>();
      let openingPositions = state.openingPositions.map((position) => {
        const update = input.cutovers.find(
          (cutover) => cutover.openingPositionId === position.id,
        );
        if (!update) return position;
        if (
          cutoverIds.has(update.openingPositionId) ||
          !getCalendarDatePart(update.measuredAsOf) ||
          isFutureCalendarDate(update.measuredAsOf, currentDate)
        ) {
          throw new Error("Transaction import cutover is invalid.");
        }
        cutoverIds.add(update.openingPositionId);
        return { ...position, measuredAsOf: update.measuredAsOf };
      });
      if (cutoverIds.size !== input.cutovers.length) {
        throw new Error("Transaction import cutover references an unknown holding.");
      }

      if (input.mode === "supplemental") {
        for (const transaction of normalizedTransactions) {
          const baselines = openingPositions.filter(
            (position) => position.assetId === transaction.assetId,
          );
          if (
            baselines.length > 0 &&
            !isTransactionAfterOpeningCutover(transaction.date, baselines)
          ) {
            throw new Error(
              "Supplemental transactions must be after the confirmed holdings cutoff.",
            );
          }
        }
      }

      const replacementIds = new Set(input.replaceOpeningPositionIds);
      if (replacementIds.size !== input.replaceOpeningPositionIds.length) {
        throw new Error("Transaction import contains duplicate replacements.");
      }
      if (input.mode === "supplemental" && replacementIds.size > 0) {
        throw new Error("Supplemental imports cannot replace opening positions.");
      }
      const affectedAssetIds = new Set(
        normalizedTransactions.map((transaction) => transaction.assetId),
      );
      for (const parent of assets) {
        const childId = parent.demerger?.childAssetId;
        if (childId && (affectedAssetIds.has(parent.id) || affectedAssetIds.has(childId))) {
          affectedAssetIds.add(parent.id);
          affectedAssetIds.add(childId);
        }
      }
      if (
        input.mode === "fullHistory" &&
        openingPositions.some(
          (position) =>
            affectedAssetIds.has(position.assetId) &&
            !replacementIds.has(position.id),
        )
      ) {
        throw new Error(
          "Full-history imports must exactly replace every affected opening position.",
        );
      }
      if (
        [...replacementIds].some((openingPositionId) => {
          const position = openingPositions.find(
            (item) => item.id === openingPositionId,
          );
          return !position || !affectedAssetIds.has(position.assetId);
        })
      ) {
        throw new Error(
          "Transaction import replacement does not match an affected holding.",
        );
      }
      if (hasAmbiguousSameDayTransactionOrder(state.trades, normalizedTransactions)) {
        throw new Error(
          "Transaction import has ambiguous same-day ordering with existing data.",
        );
      }
      const nextTrades = [...state.trades, ...normalizedTransactions];
      for (const openingPositionId of replacementIds) {
        const openingPosition = openingPositions.find(
          (position) => position.id === openingPositionId,
        );
        if (!openingPosition?.measuredAsOf) {
          throw new Error("Full-history replacement requires a confirmed cutover.");
        }
        const reconciliation = reconcileTransactions({
          demergerAdjustments: projectDemergers({ assets, openingPositions: openingPositions.filter((position) => !replacementIds.has(position.id)), trades: nextTrades }, openingPosition.measuredAsOf).filter((event) => event.assetId === openingPosition.assetId),
          stockSplits: assets.find((asset) => asset.id === openingPosition.assetId)?.stockSplits,
          through: openingPosition.measuredAsOf,
          transactions: nextTrades.filter(
            (trade) =>
              trade.assetId === openingPosition.assetId &&
              (getCalendarDatePart(trade.date) ?? trade.date) <=
                openingPosition.measuredAsOf!,
          ),
        });
        if (!matchesOpeningPosition(reconciliation, openingPosition)) {
          throw new Error("Full-history replacement no longer matches its baseline.");
        }
      }
      openingPositions = openingPositions.filter(
        (position) => !replacementIds.has(position.id),
      );

      if (
        [...affectedAssetIds].some((assetId) =>
          wouldOversellAsset(assetId, openingPositions, nextTrades, assets.find((asset) => asset.id === assetId)?.stockSplits, projectDemergers({ assets, openingPositions, trades: nextTrades }).filter((event) => event.assetId === assetId)),
        )
      ) {
        throw new Error("Transaction import would oversell a holding.");
      }

      const affectedMonths = [
        ...assets.filter((asset) => asset.demerger && !state.assets.find((item) => item.id === asset.id)?.demerger)
          .flatMap((asset) => [assetRecordMonth(state, asset.id), demergerCatalog.find((event) => event.id === asset.demerger!.eventId)?.exDate.slice(0, 7)]),
        ...assets.flatMap((asset) => {
          const previous = state.assets.find((item) => item.id === asset.id);
          const newlyAttached = asset.stockSplits?.filter((event) => !previous?.stockSplits?.some((prior) => prior.id === event.id)) ?? [];
          return newlyAttached.length ? [assetRecordMonth(state, asset.id), ...newlyAttached.map((event) => event.effectiveDate.slice(0, 7))] : [];
        }),
        ...normalizedTransactions.map(tradeMonth),
        ...state.openingPositions
          .filter((position) => replacementIds.has(position.id))
          .map(openingPositionMonth),
        ...input.cutovers.flatMap((cutover) => {
          const previous = state.openingPositions.find(
            (position) => position.id === cutover.openingPositionId,
          );
          return [
            previous ? openingPositionMonth(previous) : null,
            cutover.measuredAsOf.slice(0, 7),
          ];
        }),
      ].filter((month): month is string => Boolean(month));
      const earliestAffectedMonth = affectedMonths.sort()[0];
      const monthlySnapshots = earliestAffectedMonth
        ? rebuildPortfolioSnapshots({
            assets,
            earliestAffectedMonth,
            now: currentDate,
            openingPositions,
            state,
            trades: nextTrades,
          }).monthlySnapshots
        : state.monthlySnapshots;
      const portfolio = {
        ...selectRawSnapshot(state),
        assets,
        monthlySnapshots,
        openingPositions,
        trades: nextTrades,
      };
      persistAssetGraphTransition({
        historicalQuoteCache: state.historicalQuoteCache,
        portfolio,
        quoteCache: state.quoteCache,
        storage,
      });
      set({ assets, monthlySnapshots, openingPositions, trades: nextTrades });

      return {
        added: normalizedTransactions.length,
        removedOpeningPositions: replacementIds.size,
        status: "applied" as const,
        updatedCutovers: input.cutovers.length,
      };
    },
  };
}
