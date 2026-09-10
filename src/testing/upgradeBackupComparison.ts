import { createHash } from "node:crypto";

import {
  parsePortfolioBackup,
  type BackupDigest,
  type BackupPayload,
} from "@/src/domain/portfolioBackup";

export type UpgradeBackupCollectionCounts = {
  assets: number;
  cashEntries: number;
  monthlySnapshots: number;
  openingPositions: number;
  ppfAccounts: number;
  ppfLedgerEntries: number;
  trades: number;
};

export type UpgradeBackupComparison = {
  collectionsMatch: boolean;
  after: UpgradeBackupCollectionCounts;
  before: UpgradeBackupCollectionCounts;
  payloadsMatch: boolean;
};

export const nodeSha256Digest: BackupDigest = async (text) =>
  createHash("sha256").update(text, "utf8").digest("hex");

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function collectionCounts(payload: BackupPayload): UpgradeBackupCollectionCounts {
  const { portfolio } = payload;

  return {
    assets: portfolio.assets.length,
    cashEntries: portfolio.cashEntries.length,
    monthlySnapshots: portfolio.monthlySnapshots.length,
    openingPositions: portfolio.openingPositions.length,
    ppfAccounts: portfolio.ppfAccounts.length,
    ppfLedgerEntries: portfolio.ppfLedgerEntries.length,
    trades: portfolio.trades.length,
  };
}

/**
 * Compares validated backup payloads, intentionally ignoring envelope metadata.
 * Object key order is irrelevant; record-array order remains significant.
 */
export async function compareUpgradeBackupTexts(
  beforeText: string,
  afterText: string,
  digest: BackupDigest = nodeSha256Digest,
): Promise<UpgradeBackupComparison> {
  try {
    // Two distinct exports are required evidence; comparing one text to itself is not useful.
    if (beforeText === afterText) throw new Error("identical backup texts");
    const [before, after] = await Promise.all([
      parsePortfolioBackup(beforeText, digest),
      parsePortfolioBackup(afterText, digest),
    ]);
    const beforeCounts = collectionCounts(before.payload);
    const afterCounts = collectionCounts(after.payload);

    return {
      after: afterCounts,
      before: beforeCounts,
      collectionsMatch: canonicalJson(beforeCounts) === canonicalJson(afterCounts),
      payloadsMatch:
        canonicalJson(before.payload) === canonicalJson(after.payload),
    };
  } catch {
    throw new Error("Backup comparison could not be completed.");
  }
}
