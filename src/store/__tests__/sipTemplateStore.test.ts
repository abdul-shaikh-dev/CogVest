import { createHash } from "node:crypto";

import { createPortfolioBackup, parsePortfolioBackup, validateBackupPayload } from "@/src/domain/portfolioBackup";
import { createMemoryJsonStorage, type JsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey, type SipTemplateInput } from "@/src/store";
import type { Asset, BuyTrade, CashEntry } from "@/src/types";

const now = () => new Date("2026-11-24T06:00:00Z");
const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
const fund: Asset = {
  assetClass: "stock", currency: "INR", id: "fund", instrumentType: "mutualFund", isin: "INF000000001",
  name: "Synthetic Index Fund", symbol: "INF000000001", ticker: "INF000000001",
};
const opening: CashEntry = { amount: 6000, date: "2026-01-01", id: "opening", label: "Opening", purpose: "capitalContribution", type: "addition" };
const sip: SipTemplateInput = { amountInr: 5000, assetId: "fund", dayOfMonth: 5, funding: "cash", id: "sip-1", startMonth: "2026-10" };

function buy(overrides: Partial<BuyTrade> = {}): BuyTrade {
  return { assetId: "fund", date: "2026-10-05", id: "sip-trade-oct", pricePerUnit: 100, quantity: 50, totalValue: 5000, type: "buy", ...overrides };
}

function harness(storage: JsonStorage = createMemoryJsonStorage()) {
  const store = createPortfolioStore({ storage, now });
  store.getState().addAsset(fund);
  store.getState().addCashEntry(opening);
  return { storage, store };
}

describe("SIP template store (#766)", () => {
  it("saves a template that survives restart and changes no other record", () => {
    const { storage, store } = harness();
    const before = store.getState().captureBackup().payload.portfolio;

    expect(store.getState().saveSipTemplate(sip)).toMatchObject({ status: "applied", template: { handledMonths: [], paused: false } });

    expect({ ...store.getState().captureBackup().payload.portfolio, sipTemplates: [] }).toEqual(before);
    expect(createPortfolioStore({ storage, now }).getState().sipTemplates).toEqual(store.getState().sipTemplates);
  });

  it("rejects an unknown holding and invalid fields without saving", () => {
    const { store } = harness();
    expect(store.getState().saveSipTemplate({ ...sip, assetId: "missing" })).toEqual({ reason: "unknownHolding", status: "rejected" });
    expect(store.getState().saveSipTemplate({ ...sip, amountInr: 0 })).toMatchObject({ reason: "invalidEntry", status: "rejected" });
    expect(store.getState().sipTemplates).toEqual([]);
  });

  it("confirms an instalment as one funded purchase and marks the month in the same save", () => {
    const { storage, store } = harness();
    store.getState().saveSipTemplate(sip);

    const result = store.getState().confirmSipInstalment({ cashLabel: "SIP purchase", month: "2026-10", templateId: "sip-1", trade: buy() });

    expect(result).toMatchObject({ depositEntry: null, status: "applied", trade: buy() });
    const state = createPortfolioStore({ storage, now }).getState();
    expect(state.trades).toEqual([buy()]);
    expect(state.cashEntries).toEqual([opening, expect.objectContaining({ amount: 5000, linkedTradeId: "sip-trade-oct", purpose: "purchaseFunding" })]);
    expect(state.sipTemplates[0].handledMonths).toEqual([{ month: "2026-10", status: "confirmed", tradeId: "sip-trade-oct" }]);
    expect(store.getState().confirmSipInstalment({ cashLabel: "Again", month: "2026-10", templateId: "sip-1", trade: buy({ id: "x" }) }))
      .toEqual({ reason: "notDue", status: "rejected" });
  });

  it("refuses a purchase Cash cannot pay for, saving nothing", () => {
    const { store } = harness();
    store.getState().saveSipTemplate(sip);
    store.getState().confirmSipInstalment({ cashLabel: "SIP purchase", month: "2026-10", templateId: "sip-1", trade: buy() });

    const result = store.getState().confirmSipInstalment({
      cashLabel: "SIP purchase", month: "2026-11", templateId: "sip-1", trade: buy({ date: "2026-11-05", id: "sip-trade-nov" }),
    });

    expect(result).toMatchObject({ purchase: { reason: "insufficientCash" }, reason: "purchase", status: "rejected" });
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().sipTemplates[0].handledMonths).toHaveLength(1);
  });

  it("adds a matching Cash deposit for a deposit-funded SIP, so Cash is unchanged", () => {
    const { store } = harness();
    store.getState().saveSipTemplate({ ...sip, funding: "deposit" });
    store.getState().confirmSipInstalment({ cashLabel: "SIP purchase", month: "2026-10", templateId: "sip-1", trade: buy() });

    const result = store.getState().confirmSipInstalment({
      cashLabel: "SIP purchase", month: "2026-11", templateId: "sip-1", trade: buy({ date: "2026-11-06", id: "sip-trade-nov", totalValue: 5000 }),
    });

    expect(result).toMatchObject({ depositEntry: { amount: 5000, date: "2026-11-06", purpose: "capitalContribution", type: "addition" }, status: "applied" });
    const balance = store.getState().cashEntries.reduce((sum, entry) => sum + (entry.type === "addition" ? entry.amount : -entry.amount), 0);
    expect(balance).toBe(6000);
  });

  it("rejects a trade for another holding, and a month not yet due", () => {
    const { store } = harness();
    store.getState().saveSipTemplate(sip);
    expect(store.getState().confirmSipInstalment({ cashLabel: "x", month: "2026-10", templateId: "sip-1", trade: buy({ assetId: "other" }) }))
      .toEqual({ reason: "wrongHolding", status: "rejected" });
    expect(store.getState().skipSipInstalment("sip-1", "2026-12")).toEqual({ reason: "notDue", status: "rejected" });
  });

  it("skips a month without recording anything, and pausing stops instalments", () => {
    const { store } = harness();
    store.getState().saveSipTemplate(sip);
    const before = store.getState().captureBackup().payload.portfolio;

    expect(store.getState().skipSipInstalment("sip-1", "2026-10")).toEqual({ status: "applied" });
    expect(store.getState().setSipTemplatePaused("sip-1", true)).toEqual({ status: "applied" });

    const after = store.getState().captureBackup().payload.portfolio;
    expect({ ...after, sipTemplates: before.sipTemplates }).toEqual(before);
    expect(after.sipTemplates[0]).toMatchObject({ handledMonths: [{ month: "2026-10", status: "skipped" }], paused: true });
    expect(store.getState().skipSipInstalment("sip-1", "2026-11")).toEqual({ reason: "notDue", status: "rejected" });
  });

  it("offers a month again after its purchase is deleted, and deleting the holding deletes its SIPs", () => {
    const { store } = harness();
    store.getState().saveSipTemplate(sip);
    store.getState().confirmSipInstalment({ cashLabel: "SIP purchase", month: "2026-10", templateId: "sip-1", trade: buy() });
    store.getState().deleteTrade("sip-trade-oct");

    expect(store.getState().confirmSipInstalment({ cashLabel: "SIP purchase", month: "2026-10", templateId: "sip-1", trade: buy({ id: "again" }) }))
      .toMatchObject({ status: "applied" });
    expect(store.getState().sipTemplates[0].handledMonths).toEqual([{ month: "2026-10", status: "confirmed", tradeId: "again" }]);

    expect(store.getState().deleteAsset("fund")).toMatchObject({ status: "applied" });
    expect(store.getState().sipTemplates).toEqual([]);
  });

  it("keeps memory unchanged when the save fails", () => {
    const storage = createMemoryJsonStorage();
    const { store } = harness(storage);
    store.getState().saveSipTemplate(sip);
    const failing: JsonStorage = { ...storage, setItem: () => { throw new Error("simulated SIP save failure"); } };
    const failingStore = createPortfolioStore({ storage: failing, now });

    expect(() => failingStore.getState().confirmSipInstalment({ cashLabel: "SIP", month: "2026-10", templateId: "sip-1", trade: buy() }))
      .toThrow("simulated SIP save failure");
    expect(failingStore.getState().trades).toEqual([]);
    expect(failingStore.getState().sipTemplates[0].handledMonths).toEqual([]);
    expect(storage.getItem(portfolioStorageKey)).toMatchObject({ trades: [] });
  });

  it("round-trips templates through backup and rejects one naming a missing holding", async () => {
    const { store } = harness();
    store.getState().saveSipTemplate(sip);
    const payload = store.getState().captureBackup().payload;
    const text = await createPortfolioBackup(payload, { appVersion: "1", createdAt: "2026-11-24T06:00:00.000Z" }, digest);
    expect((await parsePortfolioBackup(text, digest)).payload.portfolio.sipTemplates).toEqual(payload.portfolio.sipTemplates);

    const tampered = structuredClone(payload);
    tampered.portfolio.sipTemplates[0].assetId = "missing";
    expect(() => validateBackupPayload(tampered)).toThrow("portfolio records are invalid");
  });
});
