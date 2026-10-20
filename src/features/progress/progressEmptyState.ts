export type ProgressEmptyStateKind = "empty" | "epfOnly";

/**
 * EPF stays outside stored monthly history, so a portfolio holding only EPF
 * has nothing to chart yet. It still has a portfolio and must not be told to
 * set one up.
 */
export function getProgressEmptyStateKind({ epfAccountCount, hasSnapshotRecords }: {
  epfAccountCount: number;
  /** Market holdings, Cash entries or PPF accounts: records that monthly history is built from. */
  hasSnapshotRecords: boolean;
}): ProgressEmptyStateKind {
  return epfAccountCount > 0 && !hasSnapshotRecords ? "epfOnly" : "empty";
}
