import { transactionCsvMaxBytes } from "@/src/domain/transactionCsv";
import {
  parseTransactionImportFile,
  type TransactionImportSourceId,
} from "@/src/domain/transactionImportSources";
import type { CasStatementImportReview } from "@/src/services/import-export";
import type { PortfolioStoreState } from "@/src/store";

import {
  assetForResolution,
  type TransactionCsvResolution,
} from "./transactionImport";

export type PickedTransactionCsv = {
  name: string;
  size: number;
  text: string;
};

export type SelectedTransactionImportFile = PickedTransactionCsv & {
  id: string;
};

/**
 * Parses each selected file. A file over the size limit becomes a file-limit
 * error; messages and unsupported events are prefixed with the file name.
 * Each file with rows reports its date range through `onFileSummary`.
 */
export function parseTransactionImportFiles(
  files: SelectedTransactionImportFile[],
  sourceId: TransactionImportSourceId,
  onFileSummary: (fileId: string, summary: string) => void,
) {
  return files.map((file, fileIndex) => {
    if (
      file.size > transactionCsvMaxBytes ||
      file.text.length > transactionCsvMaxBytes
    ) {
      return {
        errors: [
          {
            code: "fileLimit" as const,
            message: `${file.name}: CSV files may be at most 1 MB.`,
          },
        ],
        rows: [],
        unsupportedEvents: [],
      };
    }
    const parsed = parseTransactionImportFile({
      fileIndex,
      fileName: file.name,
      sourceId,
      text: file.text,
    });
    const dates = parsed.rows.map((row) => row.tradeDate.slice(0, 10)).sort();
    if (dates.length > 0) onFileSummary(
      file.id,
      `${dates[0]} to ${dates[dates.length - 1]} • ${parsed.rows.length} transactions`,
    );
    return {
      errors: parsed.errors.map((error) => ({
        ...error,
        message: `${file.name}: ${error.message}`,
      })),
      rows: parsed.rows,
      unsupportedEvents: parsed.unsupportedEvents.map((event) => ({
        ...event,
        transactionType: `${file.name} • ${event.transactionType}`,
      })),
    };
  });
}

export function getImportCoverage(
  resolutions: TransactionCsvResolution[],
  casReview: CasStatementImportReview | undefined,
) {
  const resolvedDates = resolutions
    .map((resolution) => resolution.row.tradeDate.slice(0, 10))
    .filter(Boolean)
    .sort();
  return casReview?.normalization.coverage ??
    (resolvedDates.length > 0
      ? { from: resolvedDates[0], to: resolvedDates[resolvedDates.length - 1] }
      : undefined);
}

/** Opening positions of the assets the import touches, once each. */
export function getCutoverHoldings(
  resolutions: TransactionCsvResolution[],
  snapshot: PortfolioStoreState,
) {
  return [
    ...new Map(
      resolutions
        .flatMap((resolution) => {
          // The plan may map a provider listing to an existing local holding.
          const asset = assetForResolution(resolution, snapshot);
          if (!asset) return [];
          return snapshot.openingPositions
            .filter(
              (position) => position.assetId === asset.id,
            )
            .map(
              (position) =>
                [position.id, { asset, position }] as const,
            );
        }),
    ).values(),
  ];
}
