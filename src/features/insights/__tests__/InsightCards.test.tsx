import { fireEvent, render } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

import { InsightCards } from "../InsightCards";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-patterns",
  name: "Synthetic Bank",
  symbol: "SYN",
  ticker: "SYN.NS",
};

describe("Investment patterns card (#806)", () => {
  it("folds to one line when no pattern has anything to show", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    const screen = await render(<InsightCards now={new Date("2026-11-25T10:00:00Z")} store={store} />);

    expect(screen.getByText("Patterns appear as you record buys, sells and planned holding periods.")).toBeTruthy();
    expect(screen.queryByTestId("open-insight-conviction")).toBeNull();
    expect(screen.queryByText(/0 buys/u)).toBeNull();

    await fireEvent.press(screen.getByTestId("insights-empty-toggle"));
    expect(screen.getByTestId("open-insight-conviction")).toBeTruthy();
    expect(screen.getByTestId("open-insight-frequency")).toBeTruthy();
  });
});
