import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import type { XirrSummary } from "@/src/domain/xirrSummary";
import { loadBenchmarkNav } from "@/src/services/quotes/benchmarkNav";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { DailyPriceEntry, DailyPriceRequest } from "@/src/types";

import { DashboardBenchmarkSummary } from "../DashboardBenchmarkSummary";

const now = new Date();
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
  return Promise.resolve({ ...request, complete: true, fetchedAt: new Date().toISOString(), points });
}

describe("Dashboard benchmark summary (#765)", () => {
  it("points to Progress until a comparison is cached, and never loads NAV itself", async () => {
    const cache = createDailyPriceCache({ storage: createMemoryJsonStorage() });
    const onOpenProgress = jest.fn();
    const screen = await render(<DashboardBenchmarkSummary cache={cache} onOpenProgress={onOpenProgress} summary={summary} />);

    expect(screen.getByText("Compare with a Nifty 50 index fund")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-benchmark-rate")).toBeNull();
    await fireEvent.press(screen.getByTestId("dashboard-benchmark-open-progress"));
    expect(onOpenProgress).toHaveBeenCalledTimes(1);
  });

  it("shows the rate and gap once Progress has loaded the comparison", async () => {
    const cache = createDailyPriceCache({ storage: createMemoryJsonStorage() });
    const screen = await render(<DashboardBenchmarkSummary cache={cache} onOpenProgress={jest.fn()} summary={summary} />);
    expect(screen.queryByTestId("dashboard-benchmark-rate")).toBeNull();

    await act(async () => {
      await loadBenchmarkNav(cache, summary.startDate, summary.endDate, navLoader, now);
    });

    await waitFor(() => expect(screen.getByTestId("dashboard-benchmark-rate")).toHaveTextContent("+10.00% a year"));
    expect(screen.getByTestId("dashboard-benchmark-gap")).toHaveTextContent("Your portfolio: 10.0 points above the index fund");
    expect(screen.getByText("Chart in Progress")).toBeTruthy();
    expect(screen.queryByTestId("progress-benchmark-chart")).toBeNull();
  });
});
