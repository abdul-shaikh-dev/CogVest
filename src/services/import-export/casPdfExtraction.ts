import { File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import {
  extractText,
  getPageCount,
  isAvailable,
} from "expo-pdf-text-extract";

import { createId } from "@/src/utils";

export const casPdfMaxBytes = 10 * 1024 * 1024;
export const casPdfMaxPages = 250;

export type CasPdfExtractionErrorCode =
  | "cacheCopyFailed"
  | "cleanupFailed"
  | "corruptPdf"
  | "emptyPdf"
  | "extractFailed"
  | "fileTooLarge"
  | "incorrectPassword"
  | "invalidFile"
  | "pageLimitExceeded"
  | "parseFailed"
  | "passwordRequired"
  | "unavailable";

export class CasPdfExtractionError extends Error {
  constructor(
    public readonly code: CasPdfExtractionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CasPdfExtractionError";
  }
}

export type CasPdfExtractionResult<T> = {
  extractedCharacters: number;
  pageCount: number;
  value: T;
};

export type CasPdfSourceFile = Pick<File, "size" | "uri">;

type CasPdfCacheFile = Pick<File, "delete" | "exists" | "uri">;

export type CasPdfExtractionRuntime = {
  copyToCache: (sourceUri: string, cacheUri: string) => Promise<void>;
  createCacheFile: () => CasPdfCacheFile;
  extractText: (filePath: string, password?: string) => Promise<string>;
  getPageCount: (filePath: string, password?: string) => Promise<number>;
  isAvailable: () => boolean;
};

const nativeRuntime: CasPdfExtractionRuntime = {
  copyToCache: (sourceUri, cacheUri) =>
    copyAsync({ from: sourceUri, to: cacheUri }),
  createCacheFile: () =>
    new File(Paths.cache, `${createId("cas-import")}.pdf`),
  extractText,
  getPageCount,
  isAvailable,
};

export async function extractCasPdfLocally<T>({
  consumeText,
  password,
  runtime = nativeRuntime,
  source,
}: {
  consumeText: (text: string) => Promise<T> | T;
  password?: string;
  runtime?: CasPdfExtractionRuntime;
  source: CasPdfSourceFile;
}): Promise<CasPdfExtractionResult<T>> {
  if (!runtime.isAvailable()) {
    throw new CasPdfExtractionError(
      "unavailable",
      "Statement reading is unavailable in this app build.",
    );
  }
  if (!Number.isFinite(source.size) || source.size <= 0) {
    throw new CasPdfExtractionError(
      "invalidFile",
      "Choose a non-empty PDF statement.",
    );
  }
  if (source.size > casPdfMaxBytes) {
    throw new CasPdfExtractionError(
      "fileTooLarge",
      "This statement is larger than the supported 10 MB limit.",
    );
  }

  const cacheFile = runtime.createCacheFile();
  let result: CasPdfExtractionResult<T> | undefined;
  let failure: CasPdfExtractionError | undefined;

  try {
    try {
      await runtime.copyToCache(source.uri, cacheFile.uri);
    } catch {
      throw new CasPdfExtractionError(
        "cacheCopyFailed",
        "The selected statement could not be prepared for local reading.",
      );
    }
    const nativePassword = password === "" ? undefined : password;
    const pageCount = await runtime.getPageCount(
      cacheFile.uri,
      nativePassword,
    );
    if (pageCount <= 0) {
      throw new CasPdfExtractionError(
        "emptyPdf",
        "The selected PDF has no readable pages.",
      );
    }
    if (pageCount > casPdfMaxPages) {
      throw new CasPdfExtractionError(
        "pageLimitExceeded",
        `This statement exceeds the supported ${casPdfMaxPages}-page limit.`,
      );
    }

    const text = await runtime.extractText(cacheFile.uri, nativePassword);
    if (text.trim().length === 0) {
      throw new CasPdfExtractionError(
        "emptyPdf",
        "No digital text was found. Scanned statements are not supported.",
      );
    }

    let value: T;
    try {
      value = await consumeText(text);
    } catch {
      throw new CasPdfExtractionError(
        "parseFailed",
        "This statement could not be read safely.",
      );
    }
    result = {
      extractedCharacters: text.length,
      pageCount,
      value,
    };
  } catch (error) {
    failure = sanitizeExtractionError(error);
  }

  try {
    if (cacheFile.exists) cacheFile.delete();
  } catch {
    throw new CasPdfExtractionError(
      "cleanupFailed",
      "The temporary statement copy could not be removed. Close CogVest and clear its cache before retrying.",
    );
  }

  if (failure) throw failure;
  return result!;
}

function sanitizeExtractionError(error: unknown) {
  if (error instanceof CasPdfExtractionError) return error;

  const nativeCode =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (nativeCode === "PASSWORD_REQUIRED") {
    return new CasPdfExtractionError(
      "passwordRequired",
      "This statement requires its PDF password.",
    );
  }
  if (nativeCode === "INCORRECT_PASSWORD") {
    return new CasPdfExtractionError(
      "incorrectPassword",
      "That PDF password did not unlock the statement.",
    );
  }
  if (
    nativeCode === "CORRUPT_PDF" ||
    nativeCode === "FILE_NOT_FOUND" ||
    nativeCode === "PDF_ERROR" ||
    nativeCode === "PDF_LOAD_ERROR"
  ) {
    return new CasPdfExtractionError(
      "corruptPdf",
      "The selected file is not a readable PDF statement.",
    );
  }
  return new CasPdfExtractionError(
    "extractFailed",
    "The statement could not be read on this device.",
  );
}
