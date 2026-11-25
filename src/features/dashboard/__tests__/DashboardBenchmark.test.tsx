import { fireEvent, render, waitFor } from "@testing-library/react-native";

import type { XirrSummary } from "@/src/domain/xirrSummary";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { DailyPriceEntry, DailyPriceRequest } from "@/src/types";

import { benchmarkGapText, DashboardBenchmark } from "../DashboardBenchmark";

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
    const screen = await render(<DashboardBenchmark cache={cache} loader={loader} summary={summary} />);

    expect(loader).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("dashboard-benchmark-compare"));
    await waitFor(() => expect(screen.getByTestId("dashboard-benchmark-rate")).toHaveTextContent("+10.00% a year"));
    expect(screen.getByTestId("dashboard-benchmark-gap")).toHaveTextContent("Your portfolio: 10.0 points above the index fund");
    expect(screen.getByTestId("dashboard-benchmark-note")).toHaveTextContent(/^Hypothetical\..*Not advice\.$/u);

    const again = await render(<DashboardBenchmark cache={cache} loader={loader} summary={summary} />);
    expect(again.getByTestId("dashboard-benchmark-rate")).toHaveTextContent("+10.00% a year");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("says why when AMFI fails, and offers to try again", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const screen = await render(<DashboardBenchmark cache={cache} loader={() => Promise.reject(new Error("offline"))} summary={summary} />);

    await fireEvent.press(screen.getByTestId("dashboard-benchmark-compare"));
    await waitFor(() => expect(screen.getByTestId("dashboard-benchmark-unavailable")).toHaveTextContent(/AMFI/u));
    expect(screen.getByTestId("dashboard-benchmark-retry")).toBeTruthy();
  });
});
