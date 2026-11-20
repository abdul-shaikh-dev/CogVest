import { readEpfPassbookFile } from "../epfPassbookImport";
import type { CasPdfExtractionRuntime } from "../casPdfExtraction";
import { passbookChain } from "@/src/testing/epfPassbookFixture";

jest.mock("expo-pdf-text-extract", () => ({
  extractText: jest.fn(),
  getPageCount: jest.fn(),
  isAvailable: jest.fn(() => false),
}));

function runtime({ text = passbookChain.oldFirstYear, pages = 1, failure }: {
  text?: string; pages?: number; failure?: { code: string };
} = {}) {
  const cache = { delete: jest.fn(), exists: false, size: 0, uri: "file:///cache/cas-import_a_b.pdf" };
  const value: CasPdfExtractionRuntime = {
    isAvailable: () => true,
    createCacheFile: () => cache as never,
    copyToCache: async () => { cache.exists = true; cache.size = 4000; },
    getPageCount: async () => { if (failure) throw failure; return pages; },
    extractText: async () => text,
  };
  return { value, cache };
}
const source = { size: 4000, uri: "content://provider/passbook.pdf" };

describe("reading an EPF passbook file on the device (#740)", () => {
  test("reads the passbook and removes the temporary copy", async () => {
    const { value, cache } = runtime();
    const result = await readEpfPassbookFile({ extractionRuntime: value, source });
    expect(result.ok && result.passbook).toMatchObject({ yearStart: "2021-04-01", layout: "A" });
    expect(cache.delete).toHaveBeenCalled();
  });

  test("rejects a multi-page file, a password-protected PDF and a scan with a specific message", async () => {
    expect(await readEpfPassbookFile({ extractionRuntime: runtime({ pages: 2 }).value, source }))
      .toMatchObject({ ok: false, reason: "multiplePages" });
    expect(await readEpfPassbookFile({ extractionRuntime: runtime({ failure: { code: "PASSWORD_REQUIRED" } }).value, source }))
      .toMatchObject({ ok: false, message: expect.stringContaining("password-protected") });
    expect(await readEpfPassbookFile({ extractionRuntime: runtime({ text: "   " }).value, source }))
      .toMatchObject({ ok: false, message: expect.stringContaining("Scanned passbooks can't be read") });
  });
});
