import { open } from "node:fs/promises";
import { resolve } from "node:path";

import {
  backupMaxBytes,
  createPortfolioBackup,
  type BackupPayload,
} from "@/src/domain/portfolioBackup";
import {
  compareUpgradeBackupTexts,
  nodeSha256Digest,
} from "@/src/testing/upgradeBackupComparison";

function payload(): BackupPayload {
  const asset = {
    assetClass: "stock" as const,
    currency: "INR" as const,
    exchange: "NSE" as const,
    id: "asset-1",
    instrumentType: "stock" as const,
    name: "Comparison Asset",
    symbol: "COMPARE",
    ticker: "COMPARE.NS",
  };

  return {
    casFolioSalt: null,
    historicalQuoteCache: {},
    portfolio: {
      assets: [asset],
      cashEntries: [{
        amount: 100,
        date: "2026-01-01",
        id: "cash-1",
        label: "Opening cash",
        purpose: "capitalContribution" as const,
        type: "addition" as const,
      }],
      monthlySnapshots: [],
      openingPositions: [],
      ppfAccounts: [],
      ppfLedgerEntries: [],
      preferences: {
        defaultChartRange: "1M" as const,
        displayMode: "standard" as const,
        hasCompletedOnboarding: true,
        maskWealthValues: false,
      },
      schemaVersion: 12,
      trades: [],
    },
    quoteCache: {
      "asset-1": {
        assetId: "asset-1",
        asOf: "2026-01-01T00:00:00.000Z",
        currency: "INR",
        price: 100,
        source: "manual",
      },
    },
  };
}

function backup(
  value = payload(),
  metadata = { appVersion: "1.0.0", createdAt: "2026-01-01T00:00:00.000Z" },
) {
  return createPortfolioBackup(value, metadata, nodeSha256Digest);
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, child]) => [key, reverseObjectKeys(child)]),
  );
}

async function readBoundedBackupText(path: string) {
  const file = await open(path, "r");
  try {
    const buffer = Buffer.alloc(backupMaxBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const result = await file.read(buffer, offset, buffer.length - offset, offset);
      if (result.bytesRead === 0) break;
      offset += result.bytesRead;
    }
    if (offset > backupMaxBytes) throw new Error("Backup comparison file is too large.");
    return buffer.subarray(0, offset).toString("utf8");
  } finally {
    await file.close();
  }
}

function assertDistinctBackupPaths(before: string, after: string) {
  if (resolve(before) === resolve(after)) {
    throw new Error("Configured upgrade backup comparison failed.");
  }
}

describe("upgrade backup comparison", () => {
  it("ignores envelope metadata and object key order while preserving payload equality", async () => {
    const before = await backup();
    const metadataOnly = await backup(payload(), {
      appVersion: "2.0.0",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    const reordered = JSON.stringify(reverseObjectKeys(JSON.parse(before)));

    await expect(compareUpgradeBackupTexts(before, metadataOnly)).resolves.toMatchObject({
      collectionsMatch: true,
      payloadsMatch: true,
    });
    await expect(compareUpgradeBackupTexts(before, reordered)).resolves.toMatchObject({
      collectionsMatch: true,
      payloadsMatch: true,
    });
  });

  it("detects changed financial data, record collections, preferences, quotes, and CAS salt", async () => {
    const before = await backup();
    const changedAmount = payload();
    changedAmount.portfolio.cashEntries[0].amount = 101;
    const addedRecord = payload();
    addedRecord.portfolio.cashEntries.push({
      amount: 1,
      date: "2026-01-02",
      id: "cash-2",
      label: "Extra cash",
      purpose: "capitalContribution",
      type: "addition",
    });
    const deletedRecord = payload();
    deletedRecord.portfolio.cashEntries = [];
    const changedPreferences = payload();
    changedPreferences.portfolio.preferences.maskWealthValues = true;
    const changedQuotes = payload();
    changedQuotes.quoteCache["asset-1"].price = 101;
    const changedSalt = payload();
    changedSalt.casFolioSalt = "a".repeat(64);

    for (const candidate of [
      changedAmount,
      addedRecord,
      deletedRecord,
      changedPreferences,
      changedQuotes,
      changedSalt,
    ]) {
      await expect(compareUpgradeBackupTexts(before, await backup(candidate))).resolves.toMatchObject({
        payloadsMatch: false,
      });
    }
    await expect(compareUpgradeBackupTexts(before, await backup(addedRecord))).resolves.toMatchObject({
      collectionsMatch: false,
      after: { cashEntries: 2 },
      before: { cashEntries: 1 },
    });
  });

  it("treats record-array order and identical export text as meaningful", async () => {
    const ordered = payload();
    ordered.portfolio.cashEntries.push({
      amount: 1,
      date: "2026-01-02",
      id: "cash-2",
      label: "Later cash",
      purpose: "capitalContribution",
      type: "addition",
    });
    const reordered = payload();
    reordered.portfolio.cashEntries = [...ordered.portfolio.cashEntries].reverse();
    const orderedText = await backup(ordered);

    await expect(compareUpgradeBackupTexts(orderedText, await backup(reordered))).resolves.toMatchObject({
      collectionsMatch: true,
      payloadsMatch: false,
    });
    await expect(compareUpgradeBackupTexts(orderedText, orderedText)).rejects.toThrow(
      "Backup comparison could not be completed.",
    );
    expect(() => assertDistinctBackupPaths("same-export.json", "same-export.json")).toThrow(
      "Configured upgrade backup comparison failed.",
    );
  });

  it("returns one safe error for malformed, checksum, and unsupported-field inputs", async () => {
    const valid = await backup();
    const checksumCorrupt = JSON.parse(valid) as Record<string, unknown>;
    checksumCorrupt.checksum = "0".repeat(64);
    const unknownField = JSON.parse(valid) as Record<string, unknown>;
    unknownField.unrecognizedRecord = true;

    for (const invalid of ["{", JSON.stringify(checksumCorrupt), JSON.stringify(unknownField)]) {
      await expect(compareUpgradeBackupTexts(invalid, valid)).rejects.toThrow(
        "Backup comparison could not be completed.",
      );
    }
  });
});

const beforePath = process.env.COGVEST_UPGRADE_BEFORE;
const afterPath = process.env.COGVEST_UPGRADE_AFTER;
const upgradeFileTest = beforePath === undefined && afterPath === undefined ? it.skip : it;

upgradeFileTest("compares configured upgrade backup files without exposing file details", async () => {
  if (!beforePath || !afterPath) {
    throw new Error("Both upgrade backup files must be configured.");
  }

  try {
    assertDistinctBackupPaths(beforePath, afterPath);
    const comparison = await compareUpgradeBackupTexts(
      await readBoundedBackupText(beforePath),
      await readBoundedBackupText(afterPath),
    );
    expect(comparison.payloadsMatch).toBe(true);
    console.info("[upgrade-backup-comparison]", JSON.stringify({
      after: comparison.after,
      before: comparison.before,
      collectionsMatch: comparison.collectionsMatch,
      payloadsMatch: comparison.payloadsMatch,
    }));
  } catch {
    throw new Error("Configured upgrade backup comparison failed.");
  }
});
