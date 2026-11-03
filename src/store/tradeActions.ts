import { projectDemergers } from "@/src/domain/demergers";
import {
  findCanonicalAsset,
  hasCanonicalAssetConflict,
  normalizeAssetMetadata,
} from "@/src/domain/assets";
import { normalizeTrade } from "@/src/domain/financialRecords";
import { getCalendarDatePart } from "@/src/domain/dates";
import { decimal } from "@/src/domain/precision";
import { isManualTrade } from "@/src/domain/transactionSemantics";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolioTransition } from "./persistence";
import { cashBalance, rebuildPortfolioSnapshots } from "./recordValidation";
import {
  availableUnitsBeforeTrade,
  deriveTrade,
  hasNonnegativeCashTimeline,
  isConsistentTradeCashLink,
  isValidTradeRecord,
  linkedCashEntriesForTrade,
  linkedCashEntry,
  prepareTradeDeletion,
  tradeMonth,
  validateLinkedTrade,
  wouldOversellAsset,
} from "./tradeRules";

type TradeActions = Pick<PortfolioStoreState,
  | "addTrade"
  | "correctTrade"
  | "deleteTrade"
  | "deleteTrades"
  | "removeTrade"
  | "previewTradeDeletion"
  | "updateTrade"
  | "recordFundedBuy"
  | "recordSaleWithProceeds"
  | "setTradeFundingSource">;

export function createTradeActions({ get, now, set, storage }: StoreContext): TradeActions {
  return {
    addTrade: (trade) => {
      const state = get();

      if (state.trades.some((currentTrade) => currentTrade.id === trade.id)) {
        return;
      }

      const normalizedTrade = normalizeTrade(trade);
      if (!isValidTradeRecord(normalizedTrade, now())) {
        throw new Error("Trade contains invalid financial values.");
      }
      const trades = [...state.trades, normalizedTrade];

      persistPortfolioTransition(storage, state, { trades });
      set({ trades });
    },
    correctTrade: (input) => {
      const state = get();
      const existingTrade = state.trades.find((item) => item.id === input.id);

      if (!existingTrade) return { reason: "notFound", status: "rejected" };
      if (!isManualTrade(existingTrade)) {
        return { reason: "typeMismatch", status: "rejected" };
      }
      if (existingTrade.assetId !== input.assetId) {
        return { reason: "assetMismatch", status: "rejected" };
      }
      if (existingTrade.type !== input.type) {
        return { reason: "typeMismatch", status: "rejected" };
      }
      if (
        !Number.isFinite(input.quantity) ||
        !Number.isFinite(input.pricePerUnit) ||
        (input.fees !== undefined && !Number.isFinite(input.fees))
      ) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      const currentDate = now();
      // A correction keeps an external-funding marking unless it sets one itself.
      const trade = deriveTrade(input.fundingSource === undefined && existingTrade.fundingSource
        ? { ...input, fundingSource: existingTrade.fundingSource } : input);
      if (!isValidTradeRecord(trade, currentDate)) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      // A reinvested payout must not end up dated after the buy it funded.
      if (state.distributions.some((item) => item.linkedTradeId === trade.id &&
        (getCalendarDatePart(trade.date) ?? "") < item.paidOn)) {
        return { reason: "linkedPayout", status: "rejected" };
      }

      const linkedEntries = linkedCashEntriesForTrade(state, trade.id);
      if (
        linkedEntries.length > 1 ||
        (linkedEntries[0] &&
          !isConsistentTradeCashLink(existingTrade, linkedEntries[0]))
      ) {
        return { reason: "inconsistentLink", status: "rejected" };
      }

      const trades = state.trades.map((item) =>
        item.id === trade.id ? trade : item,
      );
      if (wouldOversellAsset(trade.assetId, state.openingPositions, trades, state.assets.find((asset) => asset.id === trade.assetId)?.stockSplits, projectDemergers({ ...state, trades }).filter((event) => event.assetId === trade.assetId))) {
        return { reason: "oversold", status: "rejected" };
      }

      const linkedEntry = linkedEntries[0];
      const correctedCashEntry = linkedEntry
        ? {
            ...linkedEntry,
            amount: trade.totalValue,
            date: trade.date,
            notes: trade.notes,
          }
        : undefined;
      const cashEntries = correctedCashEntry
        ? state.cashEntries.map((entry) =>
            entry.id === correctedCashEntry.id ? correctedCashEntry : entry,
          )
        : state.cashEntries;
      if (correctedCashEntry && !hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const earliestAffectedMonth = [
        tradeMonth(existingTrade),
        tradeMonth(trade),
        linkedEntry ? getCalendarDatePart(linkedEntry.date)?.slice(0, 7) : null,
      ]
        .filter((month): month is string => Boolean(month))
        .sort()[0];

      if (!earliestAffectedMonth) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const history = rebuildPortfolioSnapshots({
        cashEntries,
        earliestAffectedMonth,
        now: currentDate,
        state,
        trades,
      });
      persistPortfolioTransition(storage, state, {
        cashEntries,
        monthlySnapshots: history.monthlySnapshots,
        trades,
      });
      set({ cashEntries, monthlySnapshots: history.monthlySnapshots, trades });

      return {
        cashEntry: correctedCashEntry,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
        trade,
      };
    },
    deleteTrade: (tradeId) => {
      const state = get();
      const trade = state.trades.find((item) => item.id === tradeId);
      if (!trade) return { reason: "notFound", status: "rejected" };
      const linkedEntry = linkedCashEntriesForTrade(state, tradeId)[0];
      const result = get().deleteTrades([tradeId]);
      if (result.status === "rejected") return { reason: result.reason, status: "rejected" };
      return { ...result, cashEntry: linkedEntry, trade };
    },
    deleteTrades: (tradeIds) => {
      const state = get();
      const prepared = prepareTradeDeletion(state, tradeIds, now());
      if (prepared.status === "rejected") return prepared;

      const history = rebuildPortfolioSnapshots({
        assets: prepared.assets,
        cashEntries: prepared.cashEntries,
        earliestAffectedMonth: prepared.impact.earliestAffectedMonth,
        now: now(),
        state,
        trades: prepared.trades,
      });
      persistPortfolioTransition(storage, state, {
        assets: prepared.assets,
        cashEntries: prepared.cashEntries,
        monthlySnapshots: history.monthlySnapshots,
        trades: prepared.trades,
      });
      set({
        assets: prepared.assets,
        cashEntries: prepared.cashEntries,
        monthlySnapshots: history.monthlySnapshots,
        trades: prepared.trades,
      });

      return {
        impact: prepared.impact,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
    },
    removeTrade: (tradeId) => {
      get().deleteTrade(tradeId);
    },
    previewTradeDeletion: (tradeIds) => {
      const prepared = prepareTradeDeletion(get(), tradeIds, now());
      return prepared.status === "rejected"
        ? prepared
        : { impact: prepared.impact, status: "ready" };
    },
    updateTrade: (trade) => {
      if (!isManualTrade(trade)) return;
      const { totalValue: _totalValue, ...input } = trade;
      get().correctTrade(input);
    },
    recordFundedBuy: (input) => {
      const state = get();
      const currentDate = now();
      let commandInput = input;

      if (input.asset) {
        const normalizedCandidate = normalizeAssetMetadata(input.asset);
        const canonicalMatch = findCanonicalAsset(
          state.assets,
          normalizedCandidate,
        );
        const candidateWithCanonicalId = canonicalMatch
          ? { ...normalizedCandidate, id: canonicalMatch.id }
          : normalizedCandidate;

        if (
          hasCanonicalAssetConflict(state.assets, candidateWithCanonicalId)
        ) {
          return { isValid: false, reason: "invalidTrade" };
        }

        const asset = canonicalMatch ?? normalizedCandidate;
        commandInput = {
          ...input,
          asset,
          trade: {
            ...input.trade,
            assetId: asset.id,
          },
        };
      }

      const invalidResult = validateLinkedTrade(
        state,
        commandInput,
        commandInput.trade,
        "buy",
        currentDate,
      );

      if (invalidResult) {
        return invalidResult;
      }

      commandInput = {
        ...commandInput,
        trade: normalizeTrade(commandInput.trade),
      };
      const normalizedInvalidResult = validateLinkedTrade(
        state,
        commandInput,
        commandInput.trade,
        "buy",
        currentDate,
      );
      if (normalizedInvalidResult) {
        return normalizedInvalidResult;
      }

      const availableCash = cashBalance(state.cashEntries);

      if (
        decimal(commandInput.trade.totalValue)
          .minus(availableCash)
          .greaterThan(0)
      ) {
        return {
          availableCash,
          isValid: false,
          reason: "insufficientCash",
          requiredCash: commandInput.trade.totalValue,
        };
      }

      const cashEntry = linkedCashEntry(commandInput, "purchaseFunding");
      const assets =
        commandInput.asset &&
        !state.assets.some(
          (currentAsset) => currentAsset.id === commandInput.asset?.id,
        )
          ? [...state.assets, commandInput.asset]
          : state.assets;
      const cashEntries = [...state.cashEntries, cashEntry];
      const trades = [...state.trades, commandInput.trade];

      if (!hasNonnegativeCashTimeline(cashEntries)) {
        return { isValid: false, reason: "insufficientCash", requiredCash: commandInput.trade.totalValue };
      }

      persistPortfolioTransition(storage, state, { assets, cashEntries, trades });
      set({ assets, cashEntries, trades });

      return { cashEntry, isValid: true, trade: commandInput.trade };
    },
    recordSaleWithProceeds: (input) => {
      const state = get();
      const currentDate = now();
      const invalidResult = validateLinkedTrade(
        state,
        input,
        input.trade,
        "sell",
        currentDate,
      );

      if (invalidResult) {
        return invalidResult;
      }

      const normalizedInput = {
        ...input,
        trade: normalizeTrade(input.trade),
      };
      const normalizedInvalidResult = validateLinkedTrade(
        state,
        normalizedInput,
        normalizedInput.trade,
        "sell",
        currentDate,
      );
      if (normalizedInvalidResult) {
        return normalizedInvalidResult;
      }

      const trades = [...state.trades, normalizedInput.trade];
      if (wouldOversellAsset(
        normalizedInput.trade.assetId,
        state.openingPositions,
        trades,
        state.assets.find((asset) => asset.id === normalizedInput.trade.assetId)?.stockSplits,
        projectDemergers({ ...state, trades }).filter((event) => event.assetId === normalizedInput.trade.assetId),
      )) {
        return {
          availableUnits: availableUnitsBeforeTrade(
            normalizedInput.trade.assetId,
            state.openingPositions,
            trades,
            normalizedInput.trade.id,
            state.assets.find((asset) => asset.id === normalizedInput.trade.assetId)?.stockSplits,
            projectDemergers({ ...state, trades }).filter((event) => event.assetId === normalizedInput.trade.assetId),
          ),
          isValid: false,
          reason: "insufficientUnits",
          requiredUnits: normalizedInput.trade.quantity,
        };
      }

      const cashEntry = linkedCashEntry(normalizedInput, "saleProceeds");
      const cashEntries = [...state.cashEntries, cashEntry];

      persistPortfolioTransition(storage, state, { cashEntries, trades });
      set({ cashEntries, trades });

      return { cashEntry, isValid: true, trade: normalizedInput.trade };
    },
    setTradeFundingSource: (tradeIds, source) => {
      const state = get();
      const selected = new Set(tradeIds);
      if (!selected.size) return { reason: "invalidEntry", status: "rejected" };
      const trades = state.trades.filter((trade) => selected.has(trade.id));
      if (trades.length !== selected.size) return { reason: "notFound", status: "rejected" };
      if (trades.some((trade) => trade.type !== "buy" && trade.type !== "sell")) return { reason: "invalidEntry", status: "rejected" };
      // A trade with a Cash leg, or bought with a reinvested payout, already says where its money moved.
      if (state.cashEntries.some((cash) => cash.linkedTradeId && selected.has(cash.linkedTradeId)) ||
        state.distributions.some((item) => item.linkedTradeId && selected.has(item.linkedTradeId))) {
        return { reason: "linkedCash", status: "rejected" };
      }
      const nextTrades = state.trades.map((trade) => {
        if (!selected.has(trade.id) || (trade.type !== "buy" && trade.type !== "sell")) return trade;
        const { fundingSource: _previous, ...rest } = trade;
        return source === null ? rest : { ...rest, fundingSource: source };
      });
      persistPortfolioTransition(storage, state, { trades: nextTrades });
      set({ trades: nextTrades });
      return { status: "applied" };
    },
  };
}
