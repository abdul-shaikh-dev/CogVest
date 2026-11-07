import { planDistributionChange } from "@/src/domain/distributions";
import {
  measurementBasisProblems,
  measurementEvidenceDigest,
} from "@/src/domain/wholePortfolioXirr";
import {
  formatLocalCalendarDate,
  getCalendarDatePart,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import { decimal } from "@/src/domain/precision";
import type { MeasurementBasis } from "@/src/types";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolioTransition } from "./persistence";
import { hasNonnegativeCashTimeline } from "./tradeRules";

type ReturnActions = Pick<PortfolioStoreState,
  | "saveDistribution"
  | "deleteDistribution"
  | "setDistributionCoverage"
  | "confirmDistributionCoverage"
  | "setMeasurementBasis">;

export function createReturnActions({ get, now, set, storage }: StoreContext): ReturnActions {
  return {
    saveDistribution: (input) => {
      const state = get();
      const plan = planDistributionChange({ ...state, id: input.id, input,
        recordedAt: now().toISOString(), today: formatLocalCalendarDate(now()) });
      if (plan.status === "rejected") return plan;
      if (!hasNonnegativeCashTimeline(plan.cashEntries)) return { reason: "insufficientCash", status: "rejected" };
      const transition = { distributions: plan.distributions, cashEntries: plan.cashEntries };
      persistPortfolioTransition(storage, state, transition);
      set(transition);
      return { distribution: plan.distribution, status: "applied" };
    },
    deleteDistribution: (distributionId) => {
      const state = get();
      const plan = planDistributionChange({ ...state, id: distributionId, input: null,
        recordedAt: now().toISOString(), today: formatLocalCalendarDate(now()) });
      if (plan.status === "rejected") return plan;
      // Removing payout Cash must not leave later Cash spending unfunded.
      if (!hasNonnegativeCashTimeline(plan.cashEntries)) return { reason: "insufficientCash", status: "rejected" };
      const transition = { distributions: plan.distributions, cashEntries: plan.cashEntries };
      persistPortfolioTransition(storage, state, transition);
      set(transition);
      return { status: "applied" };
    },
    setDistributionCoverage: (assetId, from) => {
      const state = get();
      if (!state.assets.some((asset) => asset.id === assetId)) return { reason: "notFound", status: "rejected" };
      if (from !== null && (getCalendarDatePart(from) !== from || isFutureCalendarDate(from, now()))) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      const others = state.distributionCoverage.filter((item) => item.assetId !== assetId);
      const distributionCoverage = from === null ? others
        : [...others, { assetId, confirmedAt: now().toISOString(), from }];
      persistPortfolioTransition(storage, state, { distributionCoverage });
      set({ distributionCoverage });
      return { status: "applied" };
    },
    confirmDistributionCoverage: (entries) => {
      const state = get();
      const assetIds = new Set(entries.map((entry) => entry.assetId));
      if (!entries.length || assetIds.size !== entries.length) return { reason: "invalidEntry", status: "rejected" };
      if (entries.some((entry) => !state.assets.some((asset) => asset.id === entry.assetId))) {
        return { reason: "notFound", status: "rejected" };
      }
      if (entries.some((entry) => getCalendarDatePart(entry.from) !== entry.from || isFutureCalendarDate(entry.from, now()))) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      const confirmedAt = now().toISOString();
      const distributionCoverage = [
        ...state.distributionCoverage.filter((item) => !assetIds.has(item.assetId)),
        ...entries.map((entry) => ({ assetId: entry.assetId, confirmedAt, from: entry.from })),
      ];
      persistPortfolioTransition(storage, state, { distributionCoverage });
      set({ distributionCoverage });
      return { status: "applied" };
    },
    setMeasurementBasis: (input) => {
      const state = get();
      if (input === null) {
        persistPortfolioTransition(storage, state, { measurementBasis: null });
        set({ measurementBasis: null });
        return { basis: null, status: "applied" };
      }
      const problems = measurementBasisProblems(input, formatLocalCalendarDate(now()));
      if (problems.length) return { problems, reason: "invalidEntry", status: "rejected" };
      const openingBreakdown = input.openingBreakdown.map((line) => ({ label: line.label.trim(), valueInr: line.valueInr }));
      const opening = input.kind === "openingValue";
      const measurementBasis: MeasurementBasis = {
        confirmedAt: now().toISOString(),
        evidenceDigest: opening ? measurementEvidenceDigest(state, input.startDate) : null,
        kind: input.kind,
        openingBreakdown,
        openingValueInr: opening
          ? openingBreakdown.reduce((sum, line) => sum.plus(line.valueInr), decimal(0)).toNumber() : null,
        startDate: input.startDate,
      };
      persistPortfolioTransition(storage, state, { measurementBasis });
      set({ measurementBasis });
      return { basis: measurementBasis, status: "applied" };
    },
  };
}
