import {
  holdingsCsvMaxRows,
  parseHoldingsCsv,
} from "@/src/domain/holdingsCsv";

const header =
  "cogvest_version,name,ticker,symbol,asset_class,instrument_type,sector,currency,exchange,quantity,average_cost,current_price,valuation_as_of,first_purchase_date";

describe("holdings CSV parser", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  it("parses BOM, quoted commas, whitespace, CRLF, and explicit unknown dates", () => {
    const result = parseHoldingsCsv(
      `\uFEFF${header}\r\n1,"Fund, Growth",FUND.NS,FUND,etf,etf,diversified,INR,NSE, 10 ,125.50,140,2026-08-14,unknown\r\n`,
      now,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        averageCost: 125.5,
        currentPrice: 140,
        firstPurchaseDate: null,
        name: "Fund, Growth",
        quantity: 10,
        rowNumber: 2,
        valuationAsOf: "2026-08-14",
      }),
    ]);
  });

  it("keeps spreadsheet formulas inert as text and rejects them as numbers", () => {
    const result = parseHoldingsCsv(
      `${header}\n1,=SUM(A1),FORMULA,,,stock,other,INR,NSE,=1+1,100,,,,`,
      now,
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalidNumber", column: "quantity" }),
      ]),
    );
  });

  it("rejects a header-only template with no holdings", () => {
    expect(parseHoldingsCsv(`${header}\n`, now)).toEqual({
      errors: [
        expect.objectContaining({
          code: "emptyFile",
          message: "CSV files need at least one holding row.",
        }),
      ],
      rows: [],
    });
  });

  it.each([
    ["duplicate headers", `${header},name\n`, "duplicateHeader"],
    ["unknown headers", `${header},surprise\n`, "invalidHeader"],
    ["unterminated quote", `${header}\n1,"broken`, "syntax"],
    ["unsupported version", `${header}\n2,HDFC,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,1,100,,,,`, "unsupportedVersion"],
    ["future acquisition date", `${header}\n1,HDFC,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,1,100,,,2026-08-16`, "invalidDate"],
    ["impossible acquisition date", `${header}\n1,HDFC,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,1,100,,,2026-02-31`, "invalidDate"],
    ["price without as-of", `${header}\n1,HDFC,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,1,100,110,,2026-01-01`, "invalidDate"],
    ["PPF row", `${header}\n1,PPF,PPF,PPF,debt,ppf,fixedIncome,INR,,1,100,,,,`, "unsupportedInstrument"],
  ])("rejects %s", (_label, csv, code) => {
    expect(parseHoldingsCsv(csv, now).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it("blocks the whole parse when any required row is invalid", () => {
    const result = parseHoldingsCsv(
      `${header}\n1,HDFC,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,1,100,,,2026-01-01\n1,Bad,BAD.NS,BAD,stock,stock,other,INR,NSE,0,100,,,,`,
      now,
    );

    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toMatchObject({ code: "invalidNumber", rowNumber: 3 });
  });

  it("rejects oversized files deterministically", () => {
    const rows = Array.from(
      { length: holdingsCsvMaxRows + 1 },
      (_, index) => `1,Asset ${index},A${index}.NS,A${index},stock,stock,other,INR,NSE,1,100,,,,`,
    );

    expect(parseHoldingsCsv([header, ...rows].join("\n"), now).errors).toEqual([
      expect.objectContaining({ code: "rowLimit" }),
    ]);
  });
});
