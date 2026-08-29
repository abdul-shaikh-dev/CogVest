import { createMemoryJsonStorage } from "@/src/services/storage";
import { sanitizedCombinedDetailedCasFixture } from "@/src/domain/__tests__/fixtures/camsKfinCas.fixture";

import {
  createCasFolioFingerprintProvider,
  readCasStatementForImport,
} from "../casStatementImport";

describe("CAS folio fingerprint provider", () => {
  it("uses a persistent install-local salt and returns stable opaque fingerprints", async () => {
    const storage = createMemoryJsonStorage();
    const digest = jest.fn(async (value: string) =>
      value.includes("10000000/01") ? "a".repeat(64) : "b".repeat(64),
    );
    const randomBytes = jest.fn(() => new Uint8Array(32).fill(7));

    const firstProvider = createCasFolioFingerprintProvider({
      digest,
      randomBytes,
      storage,
    });
    const first = await firstProvider("10000000/01");
    const different = await firstProvider("20000000/02");
    const restartedProvider = createCasFolioFingerprintProvider({
      digest,
      randomBytes,
      storage,
    });
    const afterRestart = await restartedProvider("10000000/01");

    expect(first).toBe(`folio_${"a".repeat(64)}`);
    expect(different).toBe(`folio_${"b".repeat(64)}`);
    expect(afterRestart).toBe(first);
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(storage.getRawItem("cogvest.cas-folio-salt.v1")).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    expect(JSON.stringify(storage)).not.toContain("10000000/01");
  });

  it("returns normalized review data while raw statement identity stays inside extraction", async () => {
    const cache = {
      delete: jest.fn(),
      exists: true,
      uri: "file:///cache/random-cas.pdf",
    };
    const review = await readCasStatementForImport({
      extractionRuntime: {
        copyToCache: jest.fn(async () => undefined),
        createCacheFile: () => cache,
        extractText: jest.fn(async () => sanitizedCombinedDetailedCasFixture),
        getPageCount: jest.fn(async () => 3),
        isAvailable: () => true,
      },
      fingerprint: async (rawFolio) =>
        `folio_${(rawFolio.startsWith("100") ? "a" : "b").repeat(64)}`,
      password: "not-a-real-password",
      source: { size: 4096, uri: "content://private-statement.pdf" },
    });

    expect(review.pageCount).toBe(3);
    expect(review.normalization.coverage).toEqual({
      from: "2024-01-01",
      to: "2024-12-31",
    });
    expect(review.normalization.rows).toHaveLength(2);
    expect(review.normalization.schemes).toEqual([
      expect.objectContaining({
        folioLabel: "Folio 1",
        importableTransactions: 2,
        name: "Sample Equity Fund - Direct Plan - Growth",
      }),
      expect.objectContaining({
        folioLabel: "Folio 2",
        importableTransactions: 0,
      }),
    ]);
    expect(review.normalization.unsupportedEvents).toHaveLength(1);
    expect(JSON.stringify(review)).not.toMatch(
      /10000000|20000000|not-a-real-password|private-statement/u,
    );
    expect(cache.delete).toHaveBeenCalledTimes(1);
  });
});
