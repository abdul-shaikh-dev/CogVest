import {
  getTransactionCsvFingerprint,
  parseTransactionCsv,
  transactionCsvHeaders,
  transactionCsvMaxRows,
} from "@/src/domain/transactionCsv";

const header = transactionCsvHeaders.join(",");

describe("transaction CSV parser", () => {
  it("parses BOM, CRLF, quoted commas and escaped quotes", () => {
    const result = parseTransactionCsv(
      `\uFEFF${header}\r\n1,buy,2026-08-01,,NSE,"ABC, Growth",INR,1.25,100.50,,,,,,,"Buy, ""quoted""",Note\r\n`,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        description: 'Buy, "quoted"',
        quantity: 1.25,
        symbol: "ABC, GROWTH",
        unitPrice: 100.5,
      }),
    );
  });

  it("requires ISIN or a complete exchange and symbol identity", () => {
    const missingIdentity = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,,,ABC,INR,1,100,,,,,,,,`,
    );
    const isinIdentity = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,INE000000001,,,INR,1,100,,,,,,,,`,
    );

    expect(missingIdentity.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalidRow" })]),
    );
    expect(isinIdentity.errors).toEqual([]);
    expect(isinIdentity.rows[0].identity).toEqual({
      kind: "isin",
      value: "INE000000001",
    });
  });

  it("rejects malformed ISIN and unsupported exchange identifiers", () => {
    const invalidIsin = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,INVALID,,,INR,1,100,,,,,,,,`,
    );
    const invalidExchange = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,,NYSE,ABC,USD,1,100,,,,,,,,`,
    );

    expect(invalidIsin.errors).toEqual([
      expect.objectContaining({ code: "invalidValue", column: "isin" }),
    ]);
    expect(invalidExchange.errors).toEqual([
      expect.objectContaining({ code: "invalidValue", column: "exchange" }),
    ]);
  });

  it.each([
    ["buy without price", "buy,2026-08-01,,NSE,ABC,INR,1,,,,,,,,"],
    ["sell without price", "sell,2026-08-01,,NSE,ABC,INR,1,,,,,,,,"],
    [
      "transferIn with unit price",
      "transferIn,2026-08-01,,NSE,ABC,INR,1,100,,,,,,,",
    ],
    [
      "transferOut with acquisition cost",
      "transferOut,2026-08-01,,NSE,ABC,INR,1,,100,,,,,,",
    ],
  ])("rejects invalid %s semantics", (_label, row) => {
    const result = parseTransactionCsv(
      `${header}\n1,${row}`,
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ rowNumber: 2 })]),
    );
  });

  it("accepts a costed transfer in and quantity-only transfer out", () => {
    const result = parseTransactionCsv(
      `${header}\n1,transferIn,2026-08-01,INE000000001,,,USD,0.00000001,,0,,,,,,,\n1,transferOut,2026-08-02,,CRYPTO,BTC,USD,0.00000001,,,,,,,,,`,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({ acquisitionCost: 0, quantity: 0.00000001 }),
      expect.objectContaining({ transactionType: "transferOut" }),
    ]);
    expect(result.rows[1]).not.toHaveProperty("unitPrice");
  });

  it("classifies named unsupported events without guessing", () => {
    const result = parseTransactionCsv(
      `${header}\n1,dividend,2026-08-01,,NSE,ABC,INR,1,,,,,,,,`,
    );

    expect(result.rows).toEqual([]);
    expect(result.unsupportedEvents).toEqual([
      { rowNumber: 2, transactionType: "dividend" },
    ]);
    expect(result.errors).toEqual([
      expect.objectContaining({
        classification: "unsupported",
        code: "unsupportedTransactionType",
      }),
    ]);
  });

  it.each([
    "buyback",
    "ipo",
    "ipoAllotment",
    "ofs",
    "ofsAllotment",
    "derivatives",
    "options",
  ])(
    "reviews unsupported %s rows without applying normal transaction validation",
    (transactionType) => {
      const result = parseTransactionCsv(`${header}\n1,${transactionType}`);

      expect(result.rows).toEqual([]);
      expect(result.unsupportedEvents).toEqual([
        { rowNumber: 2, transactionType },
      ]);
      expect(result.errors).toEqual([
        expect.objectContaining({
          classification: "unsupported",
          code: "unsupportedTransactionType",
          rowNumber: 2,
        }),
      ]);
    },
  );

  it("keeps valid rows available for dry run when other rows are unsupported", () => {
    const result = parseTransactionCsv(
      `${header}\n1,dividend,2026-08-01,,NSE,ABC,INR,1,,,,,,,,\n1,buy,2026-08-02,,NSE,ABC,INR,1,100,,,,,,,,`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].transactionType).toBe("buy");
    expect(result.unsupportedEvents).toEqual([
      { rowNumber: 2, transactionType: "dividend" },
    ]);
  });

  it("treats formulas as inert text and never evaluates them", () => {
    const result = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,,NSE,ABC,INR,1,100,,,,,,,"=HYPERLINK(""https://example.invalid"")",=SUM(A1)`,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        description: '=HYPERLINK("https://example.invalid")',
        notes: "=SUM(A1)",
      }),
    );
  });

  it.each([
    ["date", "2026/08/01", "invalidDate"],
    ["impossible date", "2026-02-31", "invalidDate"],
    ["future date is still syntactically valid", "2099-12-31", undefined],
  ])("handles %s", (_label, date, code) => {
    const result = parseTransactionCsv(
      `${header}\n1,buy,${date},,NSE,ABC,INR,1,100,,,,,,,,`,
    );

    if (code) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    } else {
      expect(result.errors).toEqual([]);
    }
  });

  it("preserves decimal precision in canonical numeric candidates", () => {
    const result = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,,NSE,ABC,USD,123.45678901,0.00000001,,,,,,,,`,
    );

    expect(result.rows[0]).toEqual(
      expect.objectContaining({ quantity: 123.45678901, unitPrice: 0.00000001 }),
    );
  });

  it.each([
    ["duplicate header", `${header},symbol\n`, "duplicateHeader"],
    ["unknown header", `${header},unexpected\n`, "invalidHeader"],
    ["missing required header", header.replace(",currency", "") + "\n", "missingHeader"],
    ["unsupported version", `${header}\n2,buy,2026-08-01,,NSE,ABC,INR,1,100,,,,,,,,`, "unsupportedVersion"],
    ["unterminated quote", `${header}\n1,buy,2026-08-01,,NSE,"ABC,INR,1,100`, "syntax"],
  ])("rejects %s", (_label, csv, code) => {
    expect(parseTransactionCsv(csv).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it("rejects missing native currency and non-decimal numeric values", () => {
    const result = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,,NSE,ABC,,=1,1,000,,,,,,,,`,
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalidValue", column: "currency" }),
        expect.objectContaining({ code: "invalidNumber", column: "quantity" }),
        expect.objectContaining({ code: "invalidNumber", column: "quantity" }),
      ]),
    );
  });

  it("rejects files over the 500-row limit", () => {
    const rows = Array.from(
      { length: transactionCsvMaxRows + 1 },
      (_, index) => `1,buy,2026-08-01,,NSE,A${index},INR,1,100,,,,,,,,`,
    );

    expect(parseTransactionCsv([header, ...rows].join("\n")).errors).toEqual([
      expect.objectContaining({ code: "rowLimit" }),
    ]);
  });

  it("rejects UTF-8 files over the 1 MB parser limit", () => {
    const result = parseTransactionCsv("é".repeat(500_001));

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "fileLimit" }),
    ]);
  });

  it("generates the same fingerprint for semantically identical candidates", () => {
    const csv = `${header}\n1,buy,2026-08-01,,nse,abc,INR,1,100,,,,,,,,`;
    const first = parseTransactionCsv(csv).rows[0];
    const second = parseTransactionCsv(csv).rows[0];

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).not.toContain("rowNumber");
  });

  it("uses only immutable financial identity in the fingerprint", () => {
    const base = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,,NSE,ABC,INR,1,100,,,,,,,,`,
    );
    const enriched = parseTransactionCsv(
      `${header}\n1,buy,2026-08-01,,NSE,ABC,INR,1,100,,2026-08-03,order-1,broker,2,3,Corrected description,Corrected note`,
    );

    expect(base.errors).toEqual([]);
    expect(enriched.errors).toEqual([]);
    expect(base.rows[0]?.fingerprint).toBe(enriched.rows[0]?.fingerprint);
    expect(
      getTransactionCsvFingerprint({
        currency: "INR",
        identity: { exchange: "NSE", kind: "exchangeSymbol", symbol: "ABC" },
        quantity: 1,
        tradeDate: "2026-08-01",
        transactionType: "buy",
        unitPrice: 100,
      }),
    ).toBe(base.rows[0]?.fingerprint);
  });
});
