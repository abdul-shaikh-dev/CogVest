import { getProgressEmptyStateKind } from "../progressEmptyState";

test.each([
  ["a truly empty portfolio", 0, false, "empty"],
  ["an EPF-only portfolio", 1, false, "epfOnly"],
  ["several EPF accounts and nothing else", 3, false, "epfOnly"],
  ["EPF with holdings, Cash or PPF", 1, true, "empty"],
  ["records without EPF", 0, true, "empty"],
] as const)("%s", (_, epfAccountCount, hasSnapshotRecords, expected) => {
  expect(getProgressEmptyStateKind({ epfAccountCount, hasSnapshotRecords })).toBe(expected);
});
