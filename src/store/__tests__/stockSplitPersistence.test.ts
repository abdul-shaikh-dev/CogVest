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

function parse(stockSplits: unknown) {
  return parsePersistedPortfolio(
    JSON.stringify({ schemaVersion: 9, assets: [{ ...asset, stockSplits }] }),
  );
}

const invalidShape = { success: false, reason: "invalid-shape" };

describe("stock split persistence", () => {
  it("preserves every split and evidence field", () => {
    expect(parse([split])).toEqual({
      success: true,
      data: { schemaVersion: 9, assets: [{ ...asset, stockSplits: [split] }] },
    });
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
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
