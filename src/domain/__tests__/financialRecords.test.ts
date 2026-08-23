import {
  normalizeCashEntry,
  normalizeMonthlySnapshot,
  normalizeOpeningPosition,
  normalizeQuote,
  normalizeTrade,
} from "@/src/domain/financialRecords";
import type {
  CashEntry,
  MonthlySnapshot,
  OpeningPosition,
  Quote,
  Trade,
} from "@/src/types";

describe("financial record normalization", () => {
  it("normalizes a trade and derives its total with decimal arithmetic", () => {
    const trade: Trade = {
      assetId: "btc",
      date: "2026-07-26",
      fees: 0.105,
      id: "trade-1",
      pricePerUnit: 0.123456785,
      quantity: 3,
      totalValue: 999,
      type: "buy",
    };

    expect(normalizeTrade(trade)).toMatchObject({
      fees: 0.11,
      pricePerUnit: 0.12345679,
      quantity: 3,
      totalValue: 0.48,
    });
  });

  it("normalizes transfer quantities without inventing prices or totals", () => {
    const costedTransfer: Trade = {
      acquisitionCostPerUnit: 0.123456785,
      assetId: "btc",
      date: "2026-07-26",
      id: "transfer-in-1",
      quantity: 3.123456785,
      type: "transferIn",
    };
    const transferOut: Trade = {
      assetId: "btc",
      date: "2026-07-27",
      id: "transfer-out-1",
      quantity: 1.123456785,
      type: "transferOut",
    };

    expect(normalizeTrade(costedTransfer)).toEqual({
      ...costedTransfer,
      acquisitionCostPerUnit: 0.12345679,
      quantity: 3.12345679,
    });
    expect(normalizeTrade(transferOut)).toEqual({
      ...transferOut,
      quantity: 1.12345679,
    });
  });

  it("normalizes new records without changing their identity metadata", () => {
    const cashEntry: CashEntry = {
      amount: 10.005,
      date: "2026-07-26",
      id: "cash-1",
      label: "Contribution",
      purpose: "capitalContribution",
      type: "addition",
    };
    const position: OpeningPosition = {
      assetId: "btc",
      averageCostPrice: 0.123456785,
      currentPrice: 0.765432105,
      date: "2026-07-26",
      id: "opening-1",
      quantity: 0.123456785,
    };
    const quote: Quote = {
      assetId: "btc",
      asOf: "2026-07-26T00:00:00.000Z",
      currency: "INR",
      dayChangeAbs: 1.005,
      dayChangePct: 1.235,
      price: 0.000000125,
      source: "coingecko",
    };

    expect(normalizeCashEntry(cashEntry).amount).toBe(10.01);
    expect(normalizeOpeningPosition(position)).toMatchObject({
      averageCostPrice: 0.12345679,
      currentPrice: 0.76543211,
      quantity: 0.12345679,
    });
    expect(normalizeQuote(quote)).toMatchObject({
      dayChangeAbs: 1.005,
      dayChangePct: 1.24,
      price: 0.00000013,
    });
  });

  it("normalizes persisted monthly money and historical price evidence", () => {
    const snapshot: MonthlySnapshot = {
      cashValue: 10.005,
      cryptoValue: 20.005,
      debtValue: 30.005,
      equityValue: 40.005,
      generated: {
        generatedAt: "2026-07-26T00:00:00.000Z",
        priceBasis: "historical-close",
        priceEvidence: [
          {
            assetId: "btc",
            basis: "historical-close",
            price: 0.000000125,
          },
        ],
        source: "auto",
        warnings: [],
      },
      id: "snapshot-2026-07",
      investedValue: 90.005,
      month: "2026-07",
      monthlyInvestment: 5.005,
      portfolioValue: 100.005,
    };

    expect(normalizeMonthlySnapshot(snapshot)).toMatchObject({
      cashValue: 10.01,
      cryptoValue: 20.01,
      debtValue: 30.01,
      equityValue: 40.01,
      generated: {
        priceEvidence: [{ price: 0.00000013 }],
      },
      investedValue: 90.01,
      monthlyInvestment: 5.01,
      portfolioValue: 100.01,
    });
  });
});
