import { addTradeFlowsToSavedPerformanceBases, calculateMonthlyPerformance } from "@/src/domain/calculations";
import { createMemoryJsonStorage, type JsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { Asset, BuyTrade, MonthlyPerformanceBasis, MonthlySnapshot } from "@/src/types";

// Schema 19 adds trades without a Cash entry to monthly bases saved earlier (#647).
const now = () => new Date("2026-04-10T06:00:00Z");
const stock: Asset = { assetClass: "stock", currency: "INR", exchange: "NSE", id: "stock", name: "Synthetic", symbol: "SYN", ticker: "SYN.NS" };
const importedBuy: BuyTrade = { assetId: "stock", date: "2026-02-10", id: "buy", pricePerUnit: 100, quantity: 100, totalValue: 10000, type: "buy" };
const savedBefore647 = (netExternalFlow = 0, weightedExternalFlow = 0): MonthlyPerformanceBasis =>
  ({ netExternalFlow, status: "complete", warnings: [], weightedExternalFlow });

function snapshot(month: string, value: number, performanceBasis: MonthlyPerformanceBasis): MonthlySnapshot {
  return { cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: value, id: `snapshot-${month}`, investedValue: value,
    month, monthlyInvestment: 0, performanceBasis, portfolioValue: value };
}

/** January ₹5,000; ₹10,000 of buys imported in February; February ₹15,000. */
function savedV18Portfolio(febBasis = savedBefore647(), storage: JsonStorage = createMemoryJsonStorage()) {
  const store = createPortfolioStore({ storage, now });
  store.getState().addAsset(stock);
  store.getState().addTrade(importedBuy);
  store.getState().addMonthlySnapshot(snapshot("2026-01", 5000, savedBefore647()));
  store.getState().addMonthlySnapshot(snapshot("2026-02", 15000, febBasis));
  // V20 adds savings goals (#767); a V18 record has none.
  const { savingsGoals: _goals, sipTemplates: _sips, ...saved } = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
  storage.setRawItem(portfolioStorageKey, JSON.stringify({ ...saved, schemaVersion: 18 }));
  return { backup: store.getState().captureBackup().payload, saved: { ...saved, schemaVersion: 18 }, storage };
}

const february = (store: ReturnType<typeof createPortfolioStore>) =>
  store.getState().monthlySnapshots.find((item) => item.month === "2026-02")!;

describe("schema 19 saved-basis migration (#647)", () => {
  it("adds the imported buy to February's saved basis, so market change is zero", () => {
    const { storage } = savedV18Portfolio();

    const store = createPortfolioStore({ storage, now });

    expect(store.getState().storageRecovery).toBeUndefined();
    expect(store.getState().schemaVersion).toBe(21);
    // Bought on 10 February: weight 19/28 of the month.
    expect(february(store).performanceBasis).toEqual(savedBefore647(10000, 6785.71));
    const [january] = store.getState().monthlySnapshots;
    expect(calculateMonthlyPerformance(january, february(store))).toMatchObject({ marketMovement: 0, status: "available" });
    expect(JSON.parse(storage.getRawItem(portfolioStorageKey)!).schemaVersion).toBe(21);
  });

  it("runs once: a second launch neither changes nor rewrites the portfolio", () => {
    const { storage } = savedV18Portfolio();
    const migrated = createPortfolioStore({ storage, now }).getState().captureBackup().payload;
    const write = jest.spyOn(storage, "setItem");

    const reopened = createPortfolioStore({ storage, now });

    expect(reopened.getState().captureBackup().payload).toEqual(migrated);
    expect(write.mock.calls.filter(([key]) => key === portfolioStorageKey)).toHaveLength(0);
  });

  it("keeps what a saved basis already counted, even when its records were later deleted", () => {
    // ₹45,000 came from a Cash contribution that no longer exists.
    const { storage } = savedV18Portfolio(savedBefore647(45000, 22500));

    const store = createPortfolioStore({ storage, now });

    expect(february(store).performanceBasis).toEqual(savedBefore647(55000, 29285.71));
  });

  it("changes nothing else in the portfolio", () => {
    const { saved, storage } = savedV18Portfolio();

    const migrated = JSON.parse(JSON.stringify(createPortfolioStore({ storage, now }).getState().captureBackup().payload.portfolio));

    // V20 adds an empty savings-goal list (#767).
    const { monthlySnapshots: migratedSnapshots, savingsGoals, sipTemplates, schemaVersion: _v19, ...rest } = migrated;
    expect(savingsGoals).toEqual([]);
    expect(sipTemplates).toEqual([]);
    const { monthlySnapshots: savedSnapshots, schemaVersion: _v18, ...savedRest } = saved;
    expect(rest).toEqual(savedRest);
    expect(migratedSnapshots.map(({ performanceBasis: _b, ...item }: MonthlySnapshot) => item))
      .toEqual(savedSnapshots.map(({ performanceBasis: _b, ...item }: MonthlySnapshot) => item));
  });

  it("does not count a Cash-funded buy twice", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    store.getState().addAsset(stock);
    store.getState().addCashEntry({ amount: 10000, date: "2026-02-01", id: "deposit", label: "Deposit",
      purpose: "capitalContribution", type: "addition" });
    store.getState().addTrade(importedBuy);
    store.getState().addCashEntry({ amount: 10000, date: "2026-02-10", id: "pay", label: "Buy", linkedTradeId: "buy",
      purpose: "purchaseFunding", type: "withdrawal" });
    store.getState().addMonthlySnapshot(snapshot("2026-02", 10000, savedBefore647(10000, 10000)));
    const { savingsGoals: _goals, sipTemplates: _sips, ...saved } = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
    storage.setRawItem(portfolioStorageKey, JSON.stringify({ ...saved, schemaVersion: 18 }));

    expect(february(createPortfolioStore({ storage, now })).performanceBasis).toEqual(savedBefore647(10000, 10000));
  });

  it("leaves a saved unavailable basis unchanged", () => {
    const unavailable: MonthlyPerformanceBasis = { reason: "ambiguous-cash-flow", status: "unavailable", warnings: ["Saved"] };
    const { storage } = savedV18Portfolio(unavailable);

    expect(february(createPortfolioStore({ storage, now })).performanceBasis).toEqual(unavailable);
  });

  it("migrates a restored V18 backup once, and a restored V19 backup not again", () => {
    const { backup } = savedV18Portfolio();
    const target = createPortfolioStore({ storage: createMemoryJsonStorage(), now });

    const { savingsGoals: _goals, sipTemplates: _sips, ...v18Portfolio } = backup.portfolio;
    target.getState().replaceFromBackup({ ...backup, portfolio: { ...v18Portfolio, schemaVersion: 18 } as never },
      target.getState().getBackupRevision());
    expect(february(target).performanceBasis).toEqual(savedBefore647(10000, 6785.71));

    const v19 = target.getState().captureBackup().payload;
    target.getState().replaceFromBackup(v19, target.getState().getBackupRevision());
    expect(february(target).performanceBasis).toEqual(savedBefore647(10000, 6785.71));
  });
});

describe("addTradeFlowsToSavedPerformanceBases", () => {
  const records = { assets: [stock], cashEntries: [], distributions: [], openingPositions: [], ppfAccounts: [], ppfLedgerEntries: [] };

  it("marks a month with a transfer unavailable", () => {
    const [migrated] = addTradeFlowsToSavedPerformanceBases({ ...records,
      monthlySnapshots: [snapshot("2026-02", 15000, savedBefore647())],
      trades: [{ assetId: "stock", date: "2026-02-10", id: "transfer", quantity: 5, type: "transferIn" }] });

    expect(migrated.performanceBasis).toMatchObject({ reason: "ambiguous-cash-flow", status: "unavailable" });
  });

  it("leaves a month unchanged when its records no longer give a complete basis without trades", () => {
    const monthlySnapshots = [snapshot("2026-02", 15000, savedBefore647(5000, 2500))];

    expect(addTradeFlowsToSavedPerformanceBases({ ...records, monthlySnapshots, trades: [importedBuy],
      cashEntries: [{ amount: 100, date: "2026-02-03", id: "old", label: "Old", purpose: "legacyUncategorized", type: "addition" }] }))
      .toBe(monthlySnapshots);
  });
});
