import { parsePersistedPortfolio } from "@/src/store/persistedPortfolioSchema";

const asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-1",
  name: "Example stock",
  symbol: "EXAMPLE",
  ticker: "EXAMPLE.NS",
};
const split = {
  id: "split-1",
  kind: "split",
  effectiveDate: "2026-09-01",
  oldIsin: "INE040A01026",
  newIsin: "INE040A01034",
  newShares: 2,
  oldShares: 1,
  evidence: {
    url: "https://www.nseindia.com/announcement.pdf",
    publishedDate: "2026-08-01",
    verifiedDate: "2026-08-02",
  },
};

function parse(stockSplits: unknown, schemaVersion = 13) {
  return parsePersistedPortfolio(
    JSON.stringify({ schemaVersion, assets: [{ ...asset, stockSplits }] }),
  );
}

const invalidShape = { success: false, reason: "invalid-shape" };

describe("stock split persistence", () => {
  it("preserves every split and evidence field", () => {
    expect(parse([split])).toEqual({
      success: true,
      data: { schemaVersion: 13, assets: [{ ...asset, stockSplits: [split] }] },
    });
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    "keeps legacy V%s assets valid without adding stockSplits",
    (schemaVersion) => {
      expect(parsePersistedPortfolio(JSON.stringify({ schemaVersion, assets: [asset] })))
        .toEqual({ success: true, data: { schemaVersion, assets: [asset] } });
    },
  );

  it("accepts an empty array and reverse splits", () => {
    expect(parse([]).success).toBe(true);
    expect(parse([{ ...split, newShares: 1, oldShares: 10 }]).success).toBe(true);
  });

  const bonus = { ...split, id: "bonus-1", kind: "bonus", effectiveDate: "2026-09-02", creditedDate: "2026-09-10", oldIsin: split.newIsin, newShares: 1 };

  it("preserves explicit same-day ordering without sorting records", () => {
    const events = [{ ...bonus, effectiveDate: split.effectiveDate, sequence: 1 }, { ...split, sequence: 0 }];
    expect(parse(events)).toMatchObject({ success: true, data: { schemaVersion: 13, assets: [{ stockSplits: events }] } });
    expect(parse([{ ...split, sequence: Number.MAX_SAFE_INTEGER }]).success).toBe(true);
    expect(parse([{ ...split, sequence: 0 }, { ...bonus, sequence: 0 }]).success).toBe(true);
  });

  it.each([[undefined, undefined], [0, undefined], [undefined, 1], [0, 0]])(
    "rejects ambiguous same-day sequences %s/%s", (first, second) => {
      expect(parse([{ ...split, sequence: first }, { ...bonus, effectiveDate: split.effectiveDate, sequence: second }])).toEqual(invalidShape);
    },
  );

  it("rejects duplicate IDs even with distinct sequences", () => {
    expect(parse([{ ...split, sequence: 0 }, { ...bonus, id: split.id, effectiveDate: split.effectiveDate, sequence: 1 }])).toEqual(invalidShape);
    expect(parse([{ ...split, sequence: 0 }, { ...bonus, effectiveDate: split.effectiveDate, sequence: 1 }, { ...bonus, id: "third", effectiveDate: split.effectiveDate }])).toEqual(invalidShape);
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, "0", true])("rejects invalid sequence %j", (sequence) => {
    expect(parse([{ ...split, sequence }])).toEqual(invalidShape);
  });

  it("preserves availability separately from credit evidence", () => {
    const { creditedDate, ...withoutCredit } = bonus;
    for (const availableFrom of [bonus.effectiveDate, creditedDate]) {
      const event = { ...withoutCredit, availableFrom };
      expect(parse([event])).toMatchObject({ success: true, data: { assets: [{ stockSplits: [event] }] } });
      const result = parse([event]);
      if (result.success) expect(result.data.assets?.[0].stockSplits?.[0]).not.toHaveProperty("creditedDate");
    }
    expect(parse([bonus], 11)).toMatchObject({ success: true, data: { schemaVersion: 11, assets: [{ stockSplits: [bonus] }] } });
  });

  it.each([undefined, null, "", "2026-09-01", "2026-02-29", "2026-09-10T00:00:00Z", " 2026-09-10", 123])(
    "rejects missing or invalid availability %j", (availableFrom) => {
      expect(parse([{ ...bonus, creditedDate: undefined, availableFrom }])).toEqual(invalidShape);
    },
  );

  it("rejects both bonus timing fields and either timing field on splits", () => {
    expect(parse([{ ...bonus, availableFrom: bonus.creditedDate }])).toEqual(invalidShape);
    expect(parse([{ ...bonus, availableFrom: bonus.effectiveDate }])).toEqual(invalidShape);
    for (const availableFrom of [bonus.effectiveDate, null]) {
      expect(parse([{ ...split, availableFrom }])).toEqual(invalidShape);
    }
  });

  it("allows credit on the ex-date and preserves a later credit date", () => {
    expect(parse([{ ...bonus, creditedDate: bonus.effectiveDate }]).success).toBe(true);
    expect(parse([bonus])).toMatchObject({ success: true, data: { assets: [{ stockSplits: [bonus] }] } });
  });

  it.each([undefined, null, "", "2026-09-01", "2026-02-29", "2026-09-10T00:00:00Z", " 2026-09-10"])(
    "rejects absent, earlier, or malformed bonus credit date %j", (creditedDate) => {
      expect(parse([{ ...bonus, creditedDate }])).toEqual(invalidShape);
    },
  );

  it.each(["2026-09-01", "2026-09-10", null])("forbids split credit date %j", (creditedDate) => {
    expect(parse([{ ...split, creditedDate }])).toEqual(invalidShape);
  });

  it.each([[1, 1], [1, 2], [2, 1], [2, 2]])("round trips additional bonus ratio %s:%s unchanged", (newShares, oldShares) => {
    const events = [split, { ...bonus, newShares, oldShares }];
    expect(parse(events)).toEqual({ success: true, data: { schemaVersion: 13, assets: [{ ...asset, stockSplits: events }] } });
  });

  it.each([
    { newIsin: split.oldIsin }, { newShares: 0 }, { oldShares: 0 },
    { newShares: -1 }, { oldShares: -1 }, { newShares: 1.5 },
    { oldShares: Number.MAX_SAFE_INTEGER + 1 }, { newShares: Number.MAX_SAFE_INTEGER + 1 },
    { kind: "dividend" }, { effectiveDate: "2026-02-29" }, { oldIsin: "invalid" },
    { evidence: { ...split.evidence, url: "http://example.com/bonus.pdf" } },
    { evidence: { ...split.evidence, verifiedDate: "2026-04-31" } }, { extra: true },
  ])("rejects malformed bonus %j", (overrides) => {
    expect(parse([{ ...bonus, ...overrides }])).toEqual(invalidShape);
  });

  it("shares uniqueness and collection bounds across split and bonus kinds", () => {
    expect(parse([split, { ...bonus, id: split.id }])).toEqual(invalidShape);
    expect(parse([split, { ...bonus, effectiveDate: split.effectiveDate }])).toEqual(invalidShape);
    const events = Array.from({ length: 100 }, (_, index) => ({ ...bonus, id: `bonus-${index}`, effectiveDate: `${1900 + index}-01-01` }));
    expect(parse(events).success).toBe(true);
    expect(parse([...events, bonus])).toEqual(invalidShape);
  });

  it.each([9, 10, 11])("preserves legacy V%s split records", (version) => {
    expect(parse([split], version)).toMatchObject({ success: true, data: { schemaVersion: version, assets: [{ stockSplits: [split] }] } });
  });

  it.each([
    { id: " " }, { kind: "bonus" }, { effectiveDate: "2026-02-29" },
    { effectiveDate: "2026-09-01T00:00:00Z" }, { effectiveDate: "0000-01-01" },
    { oldIsin: "invalid" }, { newIsin: "123456789012" },
    { oldIsin: "ine040a01026" }, { newIsin: "INE040A0103X" },
    { newShares: 0 }, { oldShares: -1 }, { newShares: 1.5 },
    { oldShares: Number.MAX_SAFE_INTEGER + 1 }, { newShares: Number.MAX_SAFE_INTEGER + 1 },
    { newShares: "2" }, { newShares: 1 }, { newShares: 2, oldShares: 2 },
    { evidence: null }, { extra: true },
  ])("rejects malformed event %j", (overrides) => {
    expect(parse([{ ...split, ...overrides }])).toEqual(invalidShape);
  });

  it.each([
    { url: "http://www.nseindia.com/announcement.pdf" },
    { url: "javascript:alert(1)" }, { url: "/announcement.pdf" },
    { url: "https://" }, { url: "https://user:password@example.com/file" },
    { url: "https://example.com/with space" }, { url: "https://example.com\\file" },
    { publishedDate: "2026-04-31" }, { verifiedDate: "2025-02-29" },
    { verifiedDate: " 2026-08-02" }, { extra: true },
  ])("rejects malformed evidence %j", (overrides) => {
    expect(parse([{ ...split, evidence: { ...split.evidence, ...overrides } }]))
      .toEqual(invalidShape);
  });

  it.each(Object.keys(split))("rejects missing event field %s", (field) => {
    expect(parse([Object.fromEntries(Object.entries(split).filter(([key]) => key !== field))]))
      .toEqual(invalidShape);
  });

  it.each(Object.keys(split.evidence))("rejects missing evidence field %s", (field) => {
    const evidence = Object.fromEntries(Object.entries(split.evidence).filter(([key]) => key !== field));
    expect(parse([{ ...split, evidence }])).toEqual(invalidShape);
  });

  it("rejects duplicate IDs and dates instead of silently deduplicating", () => {
    expect(parse([split, { ...split, effectiveDate: "2026-09-02" }])).toEqual(invalidShape);
    expect(parse([split, { ...split, id: "split-2" }])).toEqual(invalidShape);
  });

  it("bounds the array at 100 events", () => {
    const events = Array.from({ length: 100 }, (_, index) => ({
      ...split, id: `split-${index}`, effectiveDate: `${1900 + index}-01-01`,
    }));
    expect(parse(events).success).toBe(true);
    expect(parse([...events, { ...split, id: "split-101" }])).toEqual(invalidShape);
  });

  it.each([null, {}, "split"])("rejects a non-array value %j", (value) => {
    expect(parse(value)).toEqual(invalidShape);
  });
});
