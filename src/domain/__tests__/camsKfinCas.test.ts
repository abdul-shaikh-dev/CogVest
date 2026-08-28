import {
  camsKfinCasSourceFormat,
  camsKfinCasSourceVersion,
  detectCamsKfinCasLayout,
  parseCamsKfinCas,
} from "../camsKfinCas";
import { sanitizedCombinedDetailedCasFixture as fixture } from "./fixtures/camsKfinCas.fixture";

describe("CAMS + KFintech detailed CAS parser", () => {
  it("detects only the versioned detailed statement layout", () => {
    expect(detectCamsKfinCasLayout(fixture)).toEqual({
      version: camsKfinCasSourceVersion,
    });
    expect(detectCamsKfinCasLayout("Consolidated Account Summary")).toEqual({
      error: "unsupportedSummary",
    });
    expect(detectCamsKfinCasLayout("Portfolio report")).toEqual({
      error: "unknownLayout",
    });
  });

  it("parses synthetic scheme blocks without retaining private identity fields", () => {
    const result = parseCamsKfinCas(fixture);

    expect(result.source).toEqual({
      format: camsKfinCasSourceFormat,
      version: camsKfinCasSourceVersion,
    });
    expect(result.errors).toEqual([]);
    expect(result.status).toBe("blocked");
    expect(result.schemes).toHaveLength(2);
    expect(result.schemes[0]).toEqual(
      expect.objectContaining({
        closingUnits: "22",
        folioReference: { label: "Folio 1", scope: "statement" },
        isin: "INF000000001",
        name: "Sample Equity Fund - Direct Plan - Growth",
        openingUnits: "10",
        registrar: "CAMS",
      }),
    );
    expect(result.schemes[1]).toEqual(
      expect.objectContaining({
        folioReference: { label: "Folio 2", scope: "statement" },
        isin: "INF000000002",
        registrar: "KFINTECH",
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/AAAAA0000A|BBBBB0000B|10000000|20000000/u);
  });

  it("preserves exact decimals, mixed dates, charges, and unsupported switches", () => {
    const result = parseCamsKfinCas(fixture);
    const [sip, stampDuty, purchase] = result.schemes[0].events;

    expect(sip).toEqual(
      expect.objectContaining({
        amount: "1000",
        date: "2024-01-02",
        disposition: "importable",
        nav: "125",
        runningBalance: "18",
        type: "purchaseSip",
        units: "8",
      }),
    );
    expect(stampDuty).toEqual(
      expect.objectContaining({
        amount: "0.05",
        disposition: "preservedCharge",
        type: "stampDuty",
      }),
    );
    expect(purchase.date).toBe("2024-02-15");
    expect(result.unsupportedEvents).toEqual([
      expect.objectContaining({ type: "switchIn" }),
    ]);
    expect(result.status).toBe("blocked");
  });

  it("reports running balance mismatches and resynchronizes to the statement", () => {
    const result = parseCamsKfinCas(
      fixture.replace("18.0000000\n02-Jan", "17.0000000\n02-Jan"),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "runningBalanceMismatch" }),
    );
    expect(result.errors.filter((error) => error.code === "runningBalanceMismatch")).toHaveLength(2);
    expect(result.errors).not.toContainEqual(
      expect.objectContaining({ code: "closingBalanceMismatch" }),
    );
    expect(result.status).toBe("blocked");
  });

  it("fails closed when parsed units do not reach the closing balance", () => {
    const result = parseCamsKfinCas(
      fixture.replace("Closing Unit Balance: 22.0000000", "Closing Unit Balance: 23.0000000"),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "closingBalanceMismatch" }),
    );
    expect(result.status).toBe("blocked");
  });

  it("does not pair a scheme with a later scheme's closing balance", () => {
    const result = parseCamsKfinCas(
      fixture.replace("Closing Unit Balance: 22.0000000", "Closing balance unavailable"),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingClosingBalance" }),
    );
    expect(result.schemes).toEqual([]);
    expect(result.status).toBe("blocked");
  });

  it("blocks a scheme whose opening balance is missing from extraction", () => {
    const result = parseCamsKfinCas(
      fixture.replace("Opening Unit Balance: 10.0000000", "Opening balance unavailable"),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingOpeningBalance" }),
    );
    expect(result.status).toBe("blocked");
  });

  it.each([
    "(10.0000000",
    "10.0000000)",
    "1-0.0000000",
    "1,,000",
    "12,34,56",
    "10.0000000corrupt",
  ])(
    "rejects malformed decimal syntax: %s",
    (malformed) => {
      const result = parseCamsKfinCas(
        fixture.replace("Opening Unit Balance: 10.0000000", `Opening Unit Balance: ${malformed}`),
      );

      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "invalidDecimal" }),
      );
      expect(result.status).toBe("blocked");
    },
  );

  it("fails closed when a unit-changing row loses its printed balance", () => {
    const result = parseCamsKfinCas(
      fixture.replace(
        "15/02/2024 Purchase 500.00 4.0000000 125.0000 22.0000000",
        "15/02/2024 Purchase 500.00 4.0000000 125.0000",
      ),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingRunningBalance" }),
    );
    expect(result.status).toBe("blocked");
  });

  it("rejects extra trailing numeric transaction columns", () => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        "02-Jan-2024 Purchase 999.00 100.00 1.0000000 100.0000 11.0000000",
        "11.0000000",
      ),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "malformedTransaction",
        detail: "extraColumns",
      }),
    );
    expect(result.status).toBe("blocked");
  });

  it("rejects malformed numeric-looking content before valid columns", () => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        "02-Jan-2024 Purchase 1,,000 1,000.00 8.0000000 125.0000 18.0000000",
        "18.0000000",
      ),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalidDecimal" }),
    );
    expect(result.status).toBe("blocked");
  });

  it.each([
    "10.0000corrupt",
    "1000corrupt",
    "-1000corrupt",
    "(1000)corrupt",
  ])("rejects numeric content with an invalid suffix: %s", (malformed) => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        `02-Jan-2024 Purchase ${malformed} 1,000.00 8.0000000 125.0000 18.0000000`,
        "18.0000000",
      ),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalidDecimal" }),
    );
    expect(result.status).toBe("blocked");
  });

  it("accepts valid Indian-grouped decimal amounts", () => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        "02-Jan-2024 Purchase 1,23,456.78 1.0000000 1,23,456.78 11.0000000",
        "11.0000000",
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.schemes[0]?.events[0]?.amount).toBe("123456.78");
    expect(result.status).toBe("ready");
  });

  it("rejects malformed scheme identity instead of guessing", () => {
    const result = parseCamsKfinCas(fixture.replace("INF000000001", "NOT-AN-ISIN"));

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "malformedScheme",
        reason: "missingIsin",
      }),
    );
    expect(result.schemes).toHaveLength(1);
    expect(result.status).toBe("blocked");
  });

  it("requires an explicit registrar for every scheme block", () => {
    const missingRegistrar = fixture.replace("Registrar : KFINTECH\nOpening", "Opening");
    const result = parseCamsKfinCas(missingRegistrar);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "malformedScheme",
        reason: "missingRegistrar",
      }),
    );
  });

  it("requires a transaction table header in every scheme block", () => {
    const result = parseCamsKfinCas(
      fixture.replace("Date Transaction Amount Units Price Unit Balance\n05-Mar", "05-Mar"),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingTransactionHeader" }),
    );
    expect(result.status).toBe("blocked");
  });

  it("rejects a partial transaction header even when balances are unchanged", () => {
    const noTransactions = fixture.replace(
      [
        "Date Transaction Amount Units NAV Unit Balance",
        "02-Jan-2024 SIP Purchase - Instalment 1/12 1,000.00 8.0000000 125.0000 18.0000000",
        "02-Jan-2024 *** Stamp Duty *** 0.05",
        "15/02/2024 Purchase 500.00 4.0000000 125.0000 22.0000000",
        "Closing Unit Balance: 22.0000000",
      ].join("\n"),
      [
        "Date Transaction Units Unit Balance",
        "Closing Unit Balance: 10.0000000",
      ].join("\n"),
    );
    const result = parseCamsKfinCas(noTransactions);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingTransactionHeader" }),
    );
    expect(result.status).toBe("blocked");
  });

  it("accepts wrapped content between the registrar label and RTA token", () => {
    const wrappedRegistrar = fixture.replace(
      "Registrar : KFINTECH",
      "Registrar : (Advisor: DIRECT) wrapped-fragment KFINTECH",
    );
    const result = parseCamsKfinCas(wrappedRegistrar);

    expect(result.errors).toEqual([]);
    expect(result.schemes[1]?.registrar).toBe("KFINTECH");
  });

  it("ignores unrelated RTA tokens before the registrar field", () => {
    const mixedRtaHeader = fixture.replace(
      "S200 - Sample Debt Fund",
      "CAMS reference S200 - Sample Debt Fund",
    );
    const result = parseCamsKfinCas(mixedRtaHeader);

    expect(result.errors).toEqual([]);
    expect(result.schemes[1]?.registrar).toBe("KFINTECH");
  });

  it("reuses a statement-scoped label for repeated folios without exposing the raw value", () => {
    const repeatedFolio = fixture
      .replace("20000000 / 02", "10000000 / 01")
      .replace("INF000000002", "INF000000001");
    const result = parseCamsKfinCas(repeatedFolio);

    expect(result.schemes[0]?.folioReference).toEqual({
      label: "Folio 1",
      scope: "statement",
    });
    expect(result.schemes[1]?.folioReference).toEqual(
      result.schemes[0]?.folioReference,
    );
    expect(JSON.stringify(result)).not.toContain("10000000");
  });

  it("keeps duplicate ISINs in different folios distinguishable for review", () => {
    const duplicateIsin = fixture.replace("INF000000002", "INF000000001");
    const result = parseCamsKfinCas(duplicateIsin);

    expect(result.schemes[0]?.isin).toBe(result.schemes[1]?.isin);
    expect(result.schemes[0]?.folioReference).not.toEqual(
      result.schemes[1]?.folioReference,
    );
  });

  it.each([
    ["Redemption", "(2.0000000)", "redemption"],
    ["Switch Out", "(2.0000000)", "switchOut"],
    ["Purchase Reversal", "2.0000000", "reversal"],
    ["Bonus allotment", "2.0000000", "unknown"],
  ] as const)("classifies %s as a visible unsupported event", (description, units, type) => {
    const closing = units.startsWith("(") ? "8.0000000" : "12.0000000";
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        `02-Jan-2024 ${description} 200.00 ${units} 100.0000 ${closing}`,
        closing,
      ),
    );

    expect(result.unsupportedEvents).toEqual([
      expect.objectContaining({ type }),
    ]);
    expect(result.status).toBe("blocked");
  });

  it("rejects invalid and unsupported transaction dates", () => {
    const invalid = parseCamsKfinCas(
      singleSchemeFixture("31-Feb-2024 Purchase 100.00 1.0000000 100.0000 11.0000000", "11.0000000"),
    );
    const unsupported = parseCamsKfinCas(
      singleSchemeFixture("2024-01-02 Purchase 100.00 1.0000000 100.0000 11.0000000", "11.0000000"),
    );

    expect(invalid.errors).toContainEqual(
      expect.objectContaining({ code: "invalidDate" }),
    );
    expect(unsupported.errors).toContainEqual(
      expect.objectContaining({ code: "malformedTransaction" }),
    );
    expect(invalid.status).toBe("blocked");
    expect(unsupported.status).toBe("blocked");
  });

  it("blocks offsetting incomplete rows even when closing units still match", () => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        [
          "02-Jan-2024 Purchase 100.00 1.0000000 100.0000",
          "03-Jan-2024 Redemption 100.00 (1.0000000) 100.0000",
        ].join("\n"),
        "10.0000000",
      ),
    );

    expect(result.errors.filter((error) => error.code === "missingRunningBalance")).toHaveLength(2);
    expect(result.errors).not.toContainEqual(
      expect.objectContaining({ code: "closingBalanceMismatch" }),
    );
    expect(result.status).toBe("blocked");
  });

  it("reassembles one PDFBox-wrapped numeric continuation line", () => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        "02-Jan-2024 Purchase\n100.00 1.0000000 100.0000 11.0000000",
        "11.0000000",
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.schemes[0]?.events).toEqual([
      expect.objectContaining({
        amount: "100",
        runningBalance: "11",
        type: "purchase",
        units: "1",
      }),
    ]);
    expect(result.status).toBe("ready");
  });

  it("reassembles a bounded wrapped description before numeric columns", () => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        [
          "02-Jan-2024 SIP Purchase",
          "Instalment 1/12",
          "100.00 1.0000000 100.0000 11.0000000",
        ].join("\n"),
        "11.0000000",
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.schemes[0]?.events[0]).toEqual(
      expect.objectContaining({ type: "purchaseSip", units: "1" }),
    );
    expect(result.status).toBe("ready");
  });

  it("preserves a date-only row instead of joining it to the next transaction", () => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        [
          "02-Jan-2024 Purchase",
          "03-Jan-2024 Purchase 100.00 1.0000000 100.0000 11.0000000",
        ].join("\n"),
        "11.0000000",
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.schemes[0]?.events).toEqual([
      expect.objectContaining({ disposition: "unsupported", type: "unknown" }),
      expect.objectContaining({ disposition: "importable", type: "purchase" }),
    ]);
    expect(result.unsupportedEvents).toEqual([
      expect.objectContaining({ type: "unknown" }),
    ]);
    expect(result.status).toBe("blocked");
  });

  it("fails closed on detached content inside a transaction region", () => {
    const result = parseCamsKfinCas(
      singleSchemeFixture(
        [
          "02-Jan-2024 Purchase 100.00 1.0000000 100.0000 11.0000000",
          "detached unproven content",
          "03-Jan-2024 Redemption 100.00 (1.0000000) 100.0000 10.0000000",
        ].join("\n"),
        "10.0000000",
      ),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "malformedTransaction",
        detail: "orphanedContent",
      }),
    );
    expect(result.status).toBe("blocked");
  });

  it("marks a fully supported and reconciled statement ready", () => {
    const result = parseCamsKfinCas(fixture.replace("Switch In", "Purchase"));

    expect(result.errors).toEqual([]);
    expect(result.unsupportedEvents).toEqual([]);
    expect(result.status).toBe("ready");
  });
});

function singleSchemeFixture(rows: string, closingUnits: string) {
  return `Consolidated Account Statement
Synthetic Mutual Fund
Folio No: 30000000 / 01 PAN: CCCCC0000C KYC: OK
S300 - Synthetic Fund - Direct Plan - Growth - ISIN: INF000000003
Registrar : CAMS
Opening Unit Balance: 10.0000000
Date Transaction Amount Units NAV Unit Balance
${rows}
Closing Unit Balance: ${closingUnits}`;
}
