import * as Crypto from "expo-crypto";

import {
  parseCamsKfinCasWithFolioFingerprint,
} from "@/src/domain/camsKfinCas";
import {
  normalizeCamsKfinCas,
  type CamsKfinCasNormalizationResult,
} from "@/src/domain/camsKfinCasNormalizer";
import {
  createMmkvJsonStorage,
  type JsonStorage,
} from "@/src/services/storage";

import {
  extractCasPdfLocally,
  type CasPdfExtractionRuntime,
  type CasPdfSourceFile,
} from "./casPdfExtraction";

import { casFolioSaltStorageKey, backupRestoreJournalKey } from "@/src/services/storage/backupKeys";
const casFolioFingerprintNamespace = "cogvest-cas-folio-v1";

type CasFingerprintRuntime = {
  digest: (value: string) => Promise<string>;
  randomBytes: (length: number) => Uint8Array;
  storage: JsonStorage;
};

export type CasStatementImportReview = {
  normalization: CamsKfinCasNormalizationResult;
  pageCount: number;
};

let defaultStorage: JsonStorage | undefined;

function getDefaultStorage() {
  defaultStorage ??= createMmkvJsonStorage();
  return defaultStorage;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function createCasFolioFingerprintProvider({
  digest,
  randomBytes,
  storage,
}: CasFingerprintRuntime) {
  if (storage.getRawItem(backupRestoreJournalKey) !== null) {
    throw new Error("Restart CogVest to finish local data recovery before importing.");
  }
  let salt = storage.getRawItem(casFolioSaltStorageKey);
  if (!salt) {
    salt = bytesToHex(randomBytes(32));
    storage.setRawItem(casFolioSaltStorageKey, salt);
  }

  return async (rawFolio: string) => {
    const hash = await digest(
      `${casFolioFingerprintNamespace}:${salt}:${rawFolio}`,
    );
    return `folio_${hash.toLowerCase()}`;
  };
}

function createDefaultFingerprintProvider() {
  return createCasFolioFingerprintProvider({
    digest: (value) =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
    randomBytes: Crypto.getRandomBytes,
    storage: getDefaultStorage(),
  });
}

export async function readCasStatementForImport({
  extractionRuntime,
  fingerprint = createDefaultFingerprintProvider(),
  password,
  source,
}: {
  extractionRuntime?: CasPdfExtractionRuntime;
  fingerprint?: (rawFolio: string) => Promise<string | undefined>;
  password?: string;
  source: CasPdfSourceFile;
}): Promise<CasStatementImportReview> {
  const result = await extractCasPdfLocally({
    consumeText: async (text) =>
      normalizeCamsKfinCas(
        await parseCamsKfinCasWithFolioFingerprint(text, fingerprint),
      ),
    password,
    runtime: extractionRuntime,
    source,
  });

  return {
    normalization: result.value,
    pageCount: result.pageCount,
  };
}
