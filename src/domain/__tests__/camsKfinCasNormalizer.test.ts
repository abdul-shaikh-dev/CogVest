import { parseCamsKfinCas } from "../camsKfinCas";
import { normalizeCamsKfinCas } from "../camsKfinCasNormalizer";
import { sanitizedCombinedDetailedCasFixture as fixture } from "./fixtures/camsKfinCas.fixture";

describe("CAMS + KFintech CAS normalization", () => {
  it("normalizes supported purchases and keeps review evidence separate", () => {
    const result = normalizeCamsKfinCas(parseFixture(fixture));

    expect(result.parserErrors).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        account: `folio_${"a".repeat(32)}`,
        currency: "INR",
        description: "SIP purchase",
        externalId: "cas:2024-01-02:purchaseSip:8:125:18",
        identity: { kind: "isin", value: "INF000000001" },
        quantity: 8,
        source: { format: "cams-kfin-cas", version: "combined-detailed-v1" },
        tradeDate: "2024-01-02",
        transactionType: "buy",
        unitPrice: 125,
      }),
    );
    expect(result.preservedCharges).toEqual([
      expect.objectContaining({ amount: "0.05", type: "stampDuty" }),
    ]);
    expect(result.unsupportedEvents).toEqual([
      expect.objectContaining({ transactionType: "switchIn" }),
    ]);
    expect(result.schemes).toEqual([
      expect.objectContaining({
        closingUnits: "22",
        events: expect.arrayContaining([
          expect.objectContaining({
            amount: "1000",
            nav: "125",
            runningBalance: "18",
            units: "8",
          }),
        ]),
        folioLabel: "Folio 1",
        importableTransactions: 2,
        openingUnits: "10",
      }),
      expect.objectContaining({
        folioLabel: "Folio 2",
        importableTransactions: 0,
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/AAAAA0000A|BBBBB0000B|10000000|20000000/u);
  });

  it("uses stable source identities across repeated normalization", () => {
    const supported = fixture.replace("Switch In", "Purchase");
    const first = normalizeCamsKfinCas(parseFixture(supported));
    const second = normalizeCamsKfinCas(parseFixture(reverseSchemeOrder(supported)));

    expect(identitiesByIsin(first.rows)).toEqual(
      identitiesByIsin(second.rows),
    );
    expect(new Set(first.rows.map(({ externalId }) => externalId)).size).toBe(
      first.rows.length,
    );
  });

  it("does not normalize any rows when structural parsing fails", () => {
    const parsed = parseFixture(
      fixture.replace("Closing Unit Balance: 22.0000000", "Closing balance unavailable"),
    );
    const result = normalizeCamsKfinCas(parsed);

    expect(result.parserErrors).not.toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("fails closed when exact values cannot cross the numeric model boundary", () => {
    const parsed = parseFixture(
      fixture
        .replace("125.0000 18.0000000", "9007199254740993 18.0000000")
        .replace("125.0000 22.0000000", "9007199254740993 22.0000000"),
    );
    const result = normalizeCamsKfinCas(parsed);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalidEventValue" }),
    );
    expect(result.rows).toEqual([]);
  });

  it("fails closed when the combined transaction value is not finite", () => {
    const parsed = parseFixture(fixture.replace("Switch In", "Purchase"));
    const huge = `1${"0".repeat(200)}`;
    parsed.schemes[0].events[0].units = huge;
    parsed.schemes[0].events[0].nav = huge;
    const result = normalizeCamsKfinCas(parsed);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalidEventValue" }),
    );
    expect(result.rows).toEqual([]);
  });

  it("fails closed when a value changes at persisted precision", () => {
    const parsed = parseFixture(fixture.replace("Switch In", "Purchase"));
    parsed.schemes[0].events[0].units = "0.000000001";
    const result = normalizeCamsKfinCas(parsed);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalidEventValue" }),
    );
    expect(result.rows).toEqual([]);
  });

  it("requires an opaque stable folio fingerprint", () => {
    const result = normalizeCamsKfinCas(parseCamsKfinCas(fixture));

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingFolioFingerprint" }),
    );
    expect(result.rows).toEqual([]);
  });

  it("rejects raw-derived and colliding folio fingerprints", () => {
    const rawDerived = normalizeCamsKfinCas(
      parseCamsKfinCas(fixture, {
        folioFingerprint: (rawFolio) => `folio_${rawFolio}_${"x".repeat(24)}`,
      }),
    );
    const collision = normalizeCamsKfinCas(
      parseCamsKfinCas(fixture, {
        folioFingerprint: () => `folio_${"c".repeat(32)}`,
      }),
    );

    expect(rawDerived.errors).toContainEqual(
      expect.objectContaining({ code: "missingFolioFingerprint" }),
    );
    expect(rawDerived.rows).toEqual([]);
    expect(collision.errors).toContainEqual(
      expect.objectContaining({ code: "missingFolioFingerprint" }),
    );
    expect(collision.rows).toEqual([]);
  });

  it("rejects fingerprints outside the planner's lowercase account scope", () => {
    const result = normalizeCamsKfinCas(
      parseCamsKfinCas(fixture, {
        folioFingerprint: (rawFolio) =>
          rawFolio === "10000000/01"
            ? `folio_${"d".repeat(32)}`
            : `folio_${"D".repeat(32)}`,
      }),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missingFolioFingerprint" }),
    );
    expect(result.rows).toEqual([]);
  });
});

function parseFixture(text: string) {
  return parseCamsKfinCas(text, {
    folioFingerprint: (rawFolio) =>
      rawFolio === "10000000/01"
        ? `folio_${"a".repeat(32)}`
        : `folio_${"b".repeat(32)}`,
  });
}

function reverseSchemeOrder(text: string) {
  const firstStart = text.indexOf("Sample Mutual Fund");
  const secondStart = text.indexOf("Another Sample Mutual Fund");
  return [
    text.slice(0, firstStart),
    text.slice(secondStart),
    text.slice(firstStart, secondStart),
  ].join("\n");
}

function identitiesByIsin(rows: ReturnType<typeof normalizeCamsKfinCas>["rows"]) {
  return Object.fromEntries(
    rows.map((row) => [row.isin, { account: row.account, externalId: row.externalId }]),
  );
}
