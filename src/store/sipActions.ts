import { formatLocalCalendarDate } from "@/src/domain/dates";
import { dueSipInstalments, maxSipTemplates, sipTemplateProblems } from "@/src/domain/sipTemplates";
import type { CashEntry, SipHandledMonth, SipTemplate } from "@/src/types";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState } from "./storeTypes";
import { persistPortfolioTransition } from "./persistence";
import { planFundedBuy } from "./tradeActions";

type SipActions = Pick<PortfolioStoreState,
  | "confirmSipInstalment"
  | "deleteSipTemplate"
  | "saveSipTemplate"
  | "setSipTemplatePaused"
  | "skipSipInstalment">;

function isDue(state: PortfolioStoreState, templateId: string, month: string, today: string) {
  const tradeIds = new Set(state.trades.map((trade) => trade.id));
  return dueSipInstalments(state.sipTemplates.filter((item) => item.id === templateId), today, tradeIds)
    .some((item) => item.month === month);
}

/** The month's entry replaces any earlier one, such as a confirmation whose purchase was deleted. */
function withHandledMonth(template: SipTemplate, entry: SipHandledMonth, timestamp: string): SipTemplate {
  return {
    ...template,
    handledMonths: [...template.handledMonths.filter((item) => item.month !== entry.month), entry]
      .sort((left, right) => left.month.localeCompare(right.month)),
    updatedAt: timestamp,
  };
}

/**
 * SIP templates (#766). A template only reminds: nothing is bought until the
 * user confirms an instalment, which records one purchase like Record Purchase.
 */
export function createSipActions({ get, now, set, storage }: StoreContext): SipActions {
  return {
    saveSipTemplate: (input) => {
      const state = get();
      const existing = state.sipTemplates.find((item) => item.id === input.id);
      if (!existing && state.sipTemplates.length >= maxSipTemplates) return { reason: "limit", status: "rejected" };
      if (!state.assets.some((asset) => asset.id === input.assetId)) return { reason: "unknownHolding", status: "rejected" };
      const timestamp = now().toISOString();
      const template: SipTemplate = {
        amountInr: input.amountInr,
        assetId: input.assetId,
        createdAt: existing?.createdAt ?? timestamp,
        dayOfMonth: input.dayOfMonth,
        funding: input.funding,
        handledMonths: existing?.handledMonths ?? [],
        id: input.id,
        paused: existing?.paused ?? false,
        startMonth: input.startMonth,
        updatedAt: timestamp,
      };
      const problems = sipTemplateProblems(template);
      if (Object.keys(problems).length > 0) return { problems, reason: "invalidEntry", status: "rejected" };
      const sipTemplates = existing
        ? state.sipTemplates.map((item) => (item.id === template.id ? template : item))
        : [...state.sipTemplates, template];
      persistPortfolioTransition(storage, state, { sipTemplates });
      set({ sipTemplates });
      return { status: "applied", template };
    },
    deleteSipTemplate: (templateId) => {
      const state = get();
      if (!state.sipTemplates.some((item) => item.id === templateId)) return { reason: "notFound", status: "rejected" };
      const sipTemplates = state.sipTemplates.filter((item) => item.id !== templateId);
      persistPortfolioTransition(storage, state, { sipTemplates });
      set({ sipTemplates });
      return { status: "applied" };
    },
    setSipTemplatePaused: (templateId, paused) => {
      const state = get();
      if (!state.sipTemplates.some((item) => item.id === templateId)) return { reason: "notFound", status: "rejected" };
      const timestamp = now().toISOString();
      const sipTemplates = state.sipTemplates.map((item) =>
        item.id === templateId ? { ...item, paused, updatedAt: timestamp } : item);
      persistPortfolioTransition(storage, state, { sipTemplates });
      set({ sipTemplates });
      return { status: "applied" };
    },
    skipSipInstalment: (templateId, month) => {
      const state = get();
      const currentDate = now();
      if (!state.sipTemplates.some((item) => item.id === templateId)) return { reason: "notFound", status: "rejected" };
      if (!isDue(state, templateId, month, formatLocalCalendarDate(currentDate))) return { reason: "notDue", status: "rejected" };
      const timestamp = currentDate.toISOString();
      const sipTemplates = state.sipTemplates.map((item) =>
        item.id === templateId ? withHandledMonth(item, { month, status: "skipped" }, timestamp) : item);
      persistPortfolioTransition(storage, state, { sipTemplates });
      set({ sipTemplates });
      return { status: "applied" };
    },
    confirmSipInstalment: (input) => {
      const state = get();
      const currentDate = now();
      const template = state.sipTemplates.find((item) => item.id === input.templateId);
      if (!template) return { reason: "notFound", status: "rejected" };
      if (!isDue(state, template.id, input.month, formatLocalCalendarDate(currentDate))) {
        return { reason: "notDue", status: "rejected" };
      }
      if (input.trade.assetId !== template.assetId) return { reason: "wrongHolding", status: "rejected" };

      // A "deposit" SIP adds the money to Cash on the purchase date, then pays from it.
      const depositEntry: CashEntry | null = template.funding === "deposit"
        ? {
            amount: input.trade.totalValue,
            date: input.trade.date,
            id: `cash-sip-${input.trade.id}`,
            label: "SIP deposit",
            purpose: "capitalContribution",
            type: "addition",
          }
        : null;
      if (depositEntry && state.cashEntries.some((entry) => entry.id === depositEntry.id)) {
        return { purchase: { isValid: false, reason: "duplicateTrade" }, reason: "purchase", status: "rejected" };
      }
      const funded = depositEntry ? { ...state, cashEntries: [...state.cashEntries, depositEntry] } : state;
      const plan = planFundedBuy(
        funded,
        { cashLabel: input.cashLabel, cashNotes: input.cashNotes, trade: input.trade },
        currentDate,
      );
      if (!plan.isValid) return { purchase: plan, reason: "purchase", status: "rejected" };

      const sipTemplates = state.sipTemplates.map((item) => item.id === template.id
        ? withHandledMonth(item, { month: input.month, status: "confirmed", tradeId: plan.trade.id }, currentDate.toISOString())
        : item);
      const transition = { ...plan.transition, sipTemplates };
      persistPortfolioTransition(storage, state, transition);
      set(transition);
      return { cashEntry: plan.cashEntry, depositEntry, status: "applied", trade: plan.trade };
    },
  };
}
