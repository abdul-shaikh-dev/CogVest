import {
  casPdfMaxBytes,
  casPdfMaxPages,
  CasPdfExtractionError,
  extractCasPdfLocally,
  type CasPdfExtractionRuntime,
} from "../casPdfExtraction";

jest.mock("expo-pdf-text-extract", () => ({
  extractText: jest.fn(),
  getPageCount: jest.fn(),
  isAvailable: jest.fn(() => false),
}));

type TestFile = {
  delete: jest.Mock;
  exists: boolean;
  size: number;
  uri: string;
};

function createHarness({
  pageCount = 6,
  sourceSize = 120_000,
  text = "Consolidated Account Statement",
}: {
  pageCount?: number;
  sourceSize?: number;
  text?: string;
} = {}) {
  const cache: TestFile = {
    delete: jest.fn(),
    exists: false,
    size: 0,
    uri: "file:///cache/cas-import_random.pdf",
  };
  const source: TestFile = {
    delete: jest.fn(),
    exists: true,
    size: sourceSize,
    uri: "content://private-provider/sensitive-name.pdf",
  };
  const runtime: CasPdfExtractionRuntime = {
    copyToCache: jest.fn(async () => {
      cache.exists = true;
    }),
    createCacheFile: jest.fn(() => cache),
    extractText: jest.fn(async () => text),
    getPageCount: jest.fn(async () => pageCount),
    isAvailable: jest.fn(() => true),
  };
  return { cache, runtime, source };
}

async function captureError(run: () => Promise<unknown>) {
  try {
    await run();
    throw new Error("Expected extraction to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(CasPdfExtractionError);
    return error as CasPdfExtractionError;
  }
}

describe("extractCasPdfLocally", () => {
  it("copies to a neutral cache name, consumes text, and removes the copy", async () => {
    const { cache, runtime, source } = createHarness();
    const consumeText = jest.fn((text: string) => ({
      recognized: text.includes("Consolidated Account Statement"),
    }));

    const result = await extractCasPdfLocally({
      consumeText,
      password: "transient-password",
      runtime,
      source,
    });

    expect(runtime.copyToCache).toHaveBeenCalledWith(
      source.uri,
      cache.uri,
    );
    expect(runtime.getPageCount).toHaveBeenCalledWith(
      cache.uri,
      "transient-password",
    );
    expect(runtime.extractText).toHaveBeenCalledWith(
      cache.uri,
      "transient-password",
    );
    expect(consumeText).toHaveBeenCalledWith(
      "Consolidated Account Statement",
    );
    expect(result).toEqual({
      extractedCharacters: 30,
      pageCount: 6,
      value: { recognized: true },
    });
    expect(cache.delete).toHaveBeenCalledTimes(1);
  });

  it("rejects unavailable builds before copying the statement", async () => {
    const { runtime, source } = createHarness();
    runtime.isAvailable = jest.fn(() => false);

    const error = await captureError(() =>
      extractCasPdfLocally({ consumeText: () => true, runtime, source }),
    );

    expect(error.code).toBe("unavailable");
    expect(runtime.copyToCache).not.toHaveBeenCalled();
  });

  it("rejects oversized statements before creating a cache file", async () => {
    const { runtime, source } = createHarness({
      sourceSize: casPdfMaxBytes + 1,
    });

    const error = await captureError(() =>
      extractCasPdfLocally({ consumeText: () => true, runtime, source }),
    );

    expect(error.code).toBe("fileTooLarge");
    expect(runtime.createCacheFile).not.toHaveBeenCalled();
  });

  it("stops before text extraction when the page limit is exceeded", async () => {
    const { cache, runtime, source } = createHarness({
      pageCount: casPdfMaxPages + 1,
    });

    const error = await captureError(() =>
      extractCasPdfLocally({ consumeText: () => true, runtime, source }),
    );

    expect(error.code).toBe("pageLimitExceeded");
    expect(runtime.extractText).not.toHaveBeenCalled();
    expect(cache.delete).toHaveBeenCalledTimes(1);
  });

  it("reports a safe error when the picked statement cannot be cached", async () => {
    const { cache, runtime, source } = createHarness();
    runtime.copyToCache = jest.fn(async () => {
      throw new Error("content://provider/private-statement.pdf denied");
    });

    const error = await captureError(() =>
      extractCasPdfLocally({ consumeText: () => true, runtime, source }),
    );

    expect(error.code).toBe("cacheCopyFailed");
    expect(error.message).not.toMatch(/content:|private-statement/iu);
    expect(runtime.getPageCount).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it("removes a partial cache file when URI copying fails", async () => {
    const { cache, runtime, source } = createHarness();
    runtime.copyToCache = jest.fn(async () => {
      cache.exists = true;
      throw new Error("copy interrupted");
    });

    const error = await captureError(() =>
      extractCasPdfLocally({ consumeText: () => true, runtime, source }),
    );

    expect(error.code).toBe("cacheCopyFailed");
    expect(cache.delete).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["PASSWORD_REQUIRED", "passwordRequired"],
    ["INCORRECT_PASSWORD", "incorrectPassword"],
    ["CORRUPT_PDF", "corruptPdf"],
    ["FILE_NOT_FOUND", "corruptPdf"],
    ["PDF_ERROR", "corruptPdf"],
    ["PDF_LOAD_ERROR", "corruptPdf"],
    ["UNKNOWN_NATIVE_FAILURE", "extractFailed"],
  ] as const)("maps %s to a safe %s error", async (nativeCode, safeCode) => {
    const { cache, runtime, source } = createHarness();
    runtime.getPageCount = jest.fn(async () => {
      throw Object.assign(
        new Error("sensitive-name.pdf contained private statement data"),
        { code: nativeCode },
      );
    });

    const error = await captureError(() =>
      extractCasPdfLocally({ consumeText: () => true, runtime, source }),
    );

    expect(error.code).toBe(safeCode);
    expect(error.message).not.toMatch(/sensitive-name|private statement/iu);
    expect(cache.delete).toHaveBeenCalledTimes(1);
  });

  it("sanitizes parser failures and removes the cached PDF", async () => {
    const { cache, runtime, source } = createHarness();

    const error = await captureError(() =>
      extractCasPdfLocally({
        consumeText: () => {
          throw new Error("private extracted row");
        },
        runtime,
        source,
      }),
    );

    expect(error.code).toBe("parseFailed");
    expect(error.message).not.toContain("private extracted row");
    expect(cache.delete).toHaveBeenCalledTimes(1);
  });

  it("blocks completion when the cached statement cannot be removed", async () => {
    const { cache, runtime, source } = createHarness();
    cache.delete.mockImplementation(() => {
      throw new Error("delete failed");
    });

    const error = await captureError(() =>
      extractCasPdfLocally({ consumeText: () => true, runtime, source }),
    );

    expect(error.code).toBe("cleanupFailed");
  });
});
