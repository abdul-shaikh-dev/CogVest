import { act, renderHook } from "@testing-library/react-native";

import * as drift from "@/src/domain/calculations/snapshotRecordDrift";
import type { MonthlySnapshot } from "@/src/types";

import { useSnapshotDrift, type SnapshotDriftInput } from "../useSnapshotDrift";

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const month = (value: string): MonthlySnapshot => ({
  cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: 100, id: value, investedValue: 100, month: value,
  monthlyInvestment: 0, portfolioValue: 100,
  generated: { generatedAt: "2026-11-01T00:00:00Z", priceBasis: "historical-close", source: "manual", warnings: [] },
});

function input(monthlySnapshots: MonthlySnapshot[]): SnapshotDriftInput {
  return { assets: [], cashEntries: [], monthlySnapshots, now: new Date("2026-11-21T12:00:00Z"), openingPositions: [], trades: [] };
}

test("checks a long history in slices that yield to the screen, and reports once every month is checked", async () => {
  jest.useFakeTimers();
  let clock = 0;
  jest.spyOn(Date, "now").mockImplementation(() => clock);
  const checked: string[] = [];
  // Each month takes 10 ms of work: the 12 ms slice fits two before yielding.
  jest.spyOn(drift, "createSnapshotDriftCheck").mockReturnValue((saved) => {
    checked.push(saved.month);
    clock += 10;
    return saved.month === "2026-02" ? { fields: ["investedValue"], month: saved.month, saved } : null;
  });
  // The caller memoizes the input: a new object would restart the check.
  const stable = input(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"].map(month));
  const stableHook = await renderHook(() => useSnapshotDrift(stable));
  expect(checked).toEqual([]);
  expect(stableHook.result.current.size).toBe(0);
  await act(() => jest.advanceTimersByTime(0));
  expect(checked).toEqual(["2026-01", "2026-02"]);
  expect(stableHook.result.current.size).toBe(0);
  await act(() => jest.runAllTimers());
  expect(checked).toHaveLength(5);
  expect([...stableHook.result.current.keys()]).toEqual(["2026-02"]);
});

test("a month saved again since the check drops out at once", async () => {
  jest.spyOn(drift, "createSnapshotDriftCheck").mockReturnValue((saved) =>
    ({ fields: ["investedValue"], month: saved.month, saved }));
  const february = month("2026-02");
  const first = input([february]);
  const hook = await renderHook<ReadonlyMap<string, drift.SnapshotRecordDrift>, { value: SnapshotDriftInput }>(
    ({ value }) => useSnapshotDrift(value), { initialProps: { value: first } });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  expect([...hook.result.current.keys()]).toEqual(["2026-02"]);
  jest.spyOn(drift, "createSnapshotDriftCheck").mockReturnValue(() => null);
  await hook.rerender({ value: input([{ ...february, investedValue: 150 }]) });
  expect(hook.result.current.size).toBe(0);
});
