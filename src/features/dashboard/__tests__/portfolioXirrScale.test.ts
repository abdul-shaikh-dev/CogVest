import * as calculations from "@/src/domain/calculations/holdings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { createAndroidScaleFixture } from "@/src/testing/androidScaleFixture";

import { wholePortfolioXirrSummary } from "../portfolioXirr";

afterEach(() => jest.restoreAllMocks());

it("values the portfolio return from the Dashboard's holdings replay (#138)", () => {
  const now = new Date(2026, 10, 2, 12);
  const fixture = createAndroidScaleFixture(now);
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.setState({ ...fixture.portfolio, quoteCache: fixture.quoteCache });
  const state = store.getState();
  const replay = jest.spyOn(calculations, "calculateHoldings");

  const dashboardHoldings = calculations.calculateHoldings({
    assets: state.assets,
    now,
    openingPositions: state.openingPositions,
    quoteCache: state.quoteCache,
    trades: state.trades,
  });
  const summary = wholePortfolioXirrSummary(state, now);

  expect(summary.status).toBe("rate");
  expect(replay).toHaveBeenCalledTimes(2);
  expect(replay.mock.results[1]?.value).toBe(dashboardHoldings);
});
