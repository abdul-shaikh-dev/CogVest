import {
  parseZerodhaTradebook,
  zerodhaTradebookHeaders,
  zerodhaTradebookSourceFormat,
  zerodhaTradebookSourceVersion,
} from "@/src/domain/zerodhaTradebook";
import { transactionCsvMaxRows } from "@/src/domain/transactionCsv";

const header = zerodhaTradebookHeaders.join(",");

function row(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    auction: "false",
    exchange: "NSE",
    isin: "INE000000001",
    order_execution_time: "2026-08-01T09:15:30",
    order_id: "order-1",
    price: "1450.25",
    quantity: "10",
    segment: "EQ",
    series: "EQ",
    symbol: "SYNTHETIC",
    trade_date: "2026-08-01",
    trade_id: "trade-1",
    trade_type: "buy",
    ...overrides,
  };
  return zerodhaTradebookHeaders.map((name) => values[name]).join(",");
}

describe("Zerodha Equity Tradebook parser", () => {
  it("normalizes supported buy and sell rows with provenance", () => {
    const result = parseZerodhaTradebook(
      `${header}\n${row()}\n${row({
        exchange: "BSE",
        order_execution_time: "2026-08-02T13:30:00",
        order_id: "order-2",
        trade_date: "2026-08-02",
        trade_id: "trade-2",
        trade_type: "sell",
      })}`,
      { fileIndex: 2, fileName: "synthetic-zerodha.csv" },
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        currency: "INR",
        externalId: "trade-1",
        tradeDate: "2026-08-01T09:15:30",
        transactionType: "buy",
        unitPrice: 1450.25,
      }),
      expect.objectContaining({
        exchange: "BSE",
        externalId: "trade-2",
        tradeDate: "2026-08-02T13:30:00",
        transactionType: "sell",
      }),
    ]);
    expect(result.rows[0]?.source).toEqual({
      exchange: "NSE",
      executedAt: "2026-08-01T09:15:30",
      fileIndex: 2,
      fileName: "synthetic-zerodha.csv",
      format: zerodhaTradebookSourceFormat,
      orderId: "order-1",
      segment: "EQ",
      symbol: "SYNTHETIC",
      version: zerodhaTradebookSourceVersion,
    });
  });

  it("keeps partial fills and duplicate trade IDs as rows for the planner", () => {
    const result = parseZerodhaTradebook(
      `${header}\n${row({ quantity: "4", trade_id: "fill-1" })}\n${row({
        order_execution_time: "2026-08-01T09:15:31",
        quantity: "6",
        trade_id: "fill-2",
      })}\n${row({
        order_execution_time: "2026-08-01T09:15:32",
        trade_id: "fill-1",
      })}`,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((candidate) => candidate.source?.orderId)).toEqual([
      "order-1",
      "order-1",
      "order-1",
    ]);
    expect(result.rows.map((candidate) => candidate.externalId)).toEqual([
      "fill-1",
      "fill-2",
      "fill-1",
    ]);
    expect(result.rows.map((candidate) => candidate.tradeDate)).toEqual([
      "2026-08-01T09:15:30",
      "2026-08-01T09:15:31",
      "2026-08-01T09:15:32",
    ]);
  });

  it("supports a BOM and CRLF source file", () => {
    const result = parseZerodhaTradebook(`\uFEFF${header}\r\n${row()}\r\n`);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });

  it("rejects an execution timestamp on a different calendar date", () => {
    const result = parseZerodhaTradebook(
      `${header}\n${row({ order_execution_time: "2026-08-02T00:01:00" })}`,
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "invalidDate",
        column: "order_execution_time",
        rowNumber: 2,
      }),
    );
  });

  it.each([
    ["changed header", header.replace("symbol", "ticker"), "invalidHeader"],
    [
      "malformed row",
      `${header}\n${row({ price: "1,450" })}`,
      "invalidRow",
    ],
    [
      "malformed supported field",
      `${header}\n${row({ price: "not-a-decimal" })}`,
      "invalidNumber",
    ],
  ])("fails closed for %s", (_label, input, code) => {
    const result = parseZerodhaTradebook(input);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it.each([
    ["segment", { segment: "FO" }],
    ["series", { series: "SM" }],
    ["exchange-series mismatch", { series: "B", exchange: "NSE" }],
    ["rights entitlement", { series: "BE", symbol: "SYNTHETIC-RE" }],
    ["exchange", { exchange: "MCX" }],
    ["auction", { auction: "true" }],
    ["trade type", { trade_type: "transfer" }],
  ])("classifies unsupported %s rows without coercion", (_label, overrides) => {
    const result = parseZerodhaTradebook(`${header}\n${row(overrides)}`);

    expect(result.rows).toEqual([]);
    expect(result.unsupportedEvents).toEqual([
      expect.objectContaining({ rowNumber: 2 }),
    ]);
    expect(result.errors).toEqual([
      expect.objectContaining({
        classification: "unsupported",
        code: "unsupportedSourceField",
        rowNumber: 2,
      }),
    ]);
  });

  it("enforces per-file row and UTF-8 byte limits", () => {
    const rows = Array.from(
      { length: transactionCsvMaxRows + 1 },
      (_, index) => row({ trade_id: `trade-${index}` }),
    );

    expect(parseZerodhaTradebook([header, ...rows].join("\n")).errors).toEqual([
      expect.objectContaining({ code: "rowLimit" }),
    ]);
    expect(parseZerodhaTradebook("é".repeat(500_001)).errors).toEqual([
      expect.objectContaining({ code: "fileLimit" }),
    ]);
  });

  it.each([["NSE", "BE"], ["BSE", "B"]])("accepts %s %s equity executions and retains their classification", (exchange, series) => {
    const result = parseZerodhaTradebook(`${header}\n${row({ exchange, series })}`);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].description).toBe(`Zerodha ${exchange} series ${series}`);
    expect(result.rows[0].transactionType).toBe("buy");
  });
});
