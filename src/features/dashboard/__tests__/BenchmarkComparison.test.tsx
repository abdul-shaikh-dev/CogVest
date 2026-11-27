import { fireEvent, render, waitFor } from "@testing-library/react-native";

import type { XirrSummary } from "@/src/domain/xirrSummary";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { DailyPriceEntry, DailyPriceRequest } from "@/src/types";

import { benchmarkGapText, benchmarkProgressText, BenchmarkComparison } from "../BenchmarkComparison";

const now = new Date("2026-11-26T06:00:00Z");
const summary: Extract<XirrSummary, { status: "rate" }> = {
  days: 365,
  endDate: "2026-11-20",
  flows: [
    { amountInr: "-1000", date: "2025-11-20", id: "in", source: "cash" },
    { amountInr: "1200", date: "2026-11-20", id: "end", source: "terminal" },
  ],
  notes: [],
  rate: 0.2,
  shortPeriod: false,
  startDate: "2025-11-20",
  status: "rate",
  valueAsOf: "2026-11-20",
};

function navLoader(request: DailyPriceRequest): Promise<DailyPriceEntry> {
  const points = [{ close: 100, date: "2025-11-20" }, { close: 110, date: "2026-11-20" }]
    .filter((point) => point.date >= request.from && point.date <= request.to);
  return Promise.resolve({ ...request, complete: true, fetchedAt: now.toISOString(), points });
}

describe("Dashboard benchmark (#765)", () => {
  it("writes the gap in points, with its direction", () => {
    expect(benchmarkGapText(0.2, 0.1)).toBe("10.0 points above the index fund");
    expect(benchmarkGapText(0.08, 0.1)).toBe("2.0 points below the index fund");
    expect(benchmarkGapText(0.1, 0.1)).toBe("Same as the index fund");
  });

  it("loads NAV only when asked, then shows the hypothetical rate and keeps it cached", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const loader = jest.fn(navLoader);
    const screen = await render(<BenchmarkComparison cache={cache} loader={loader} summary={summary} />);

    expect(loader).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("progress-benchmark-compare"));
    await waitFor(() => expect(screen.getByTestId("progress-benchmark-rate")).toHaveTextContent("+10.00% a year"));
    expect(screen.getByTestId("progress-benchmark-gap")).toHaveTextContent("Your portfolio: 10.0 points above the index fund");
    expect(screen.getByTestId("progress-benchmark-note")).toHaveTextContent(/^Hypothetical\..*Not advice\.$/u);

    const again = await render(<BenchmarkComparison cache={cache} loader={loader} summary={summary} />);
    expect(again.getByTestId("progress-benchmark-rate")).toHaveTextContent("+10.00% a year");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shows which year is loading and how far the load has got", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    let finish2026: () => void = () => undefined;
    const loader = (request: DailyPriceRequest) => (request.from.startsWith("2026")
      ? new Promise<DailyPriceEntry>((resolve) => { finish2026 = () => void navLoader(request).then(resolve); })
      : navLoader(request));
    const screen = await render(<BenchmarkComparison cache={cache} loader={loader} summary={summary} />);

    expect(benchmarkProgressText(undefined)).toBe("Checking saved NAV history.");
    await fireEvent.press(screen.getByTestId("progress-benchmark-compare"));
    await waitFor(() => expect(screen.getByTestId("progress-benchmark-loading"))
      .toHaveTextContent("Loading 2026 NAV history from AMFI, year 2 of 2"));
    expect(screen.getByTestId("progress-benchmark-progress").props.accessibilityValue).toEqual({ max: 100, min: 0, now: 50 });
    expect(screen.getByText("Each year is saved as it arrives, so the next comparison is quick.")).toBeTruthy();

    finish2026();
    await waitFor(() => expect(screen.getByTestId("progress-benchmark-rate")).toBeTruthy());
    expect(screen.queryByTestId("progress-benchmark-progress")).toBeNull();
  });

  it("says why when AMFI fails, and offers to try again", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const screen = await render(<BenchmarkComparison cache={cache} loader={() => Promise.reject(new Error("offline"))} summary={summary} />);

    await fireEvent.press(screen.getByTestId("progress-benchmark-compare"));
    await waitFor(() => expect(screen.getByTestId("progress-benchmark-unavailable")).toHaveTextContent(/AMFI/u));
    expect(screen.getByTestId("progress-benchmark-retry")).toBeTruthy();
  });
});

describe("Dashboard benchmark chart (#765)", () => {
  const monthly = [{ close: 100, date: "2025-11-20" }, { close: 102, date: "2025-11-28" }, { close: 105, date: "2026-05-29" },
    { close: 110, date: "2026-11-20" }];
  function monthlyLoader(request: DailyPriceRequest): Promise<DailyPriceEntry> {
    const points = monthly.filter((point) => point.date >= request.from && point.date <= request.to);
    return Promise.resolve({ ...request, complete: true, fetchedAt: now.toISOString(), points });
  }
  const snapshots = [{ month: "2025-11", portfolioValue: 1010 }, { month: "2026-05", portfolioValue: 1100 }];

  it("draws the portfolio against the fund and reads the latest values, masked when values are hidden", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const screen = await render(<BenchmarkComparison cache={cache} loader={monthlyLoader} monthlySnapshots={snapshots} summary={summary} />);
    await fireEvent.press(screen.getByTestId("progress-benchmark-compare"));
    await waitFor(() => expect(screen.getByTestId("progress-benchmark-chart")).toBeTruthy());
    expect(screen.getByText("Same money in the Nifty 50 fund")).toBeTruthy();
    expect(screen.getByTestId("progress-benchmark-readout")).toHaveTextContent("NowPortfolio ₹1,200.00 · Fund ₹1,100.00");

    const masked = await render(<BenchmarkComparison cache={cache} masked monthlySnapshots={snapshots} summary={summary} />);
    expect(masked.getByTestId("progress-benchmark-readout")).toHaveTextContent("NowPortfolio ₹•••• · Fund ₹••••");
  });

  it("explains the missing chart when there are too few month-end snapshots", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const screen = await render(<BenchmarkComparison cache={cache} loader={monthlyLoader} monthlySnapshots={snapshots.slice(0, 1)} summary={summary} />);
    await fireEvent.press(screen.getByTestId("progress-benchmark-compare"));
    await waitFor(() => expect(screen.getByTestId("progress-benchmark-chart-few")).toBeTruthy());
    expect(screen.queryByTestId("progress-benchmark-chart")).toBeNull();
  });
});
