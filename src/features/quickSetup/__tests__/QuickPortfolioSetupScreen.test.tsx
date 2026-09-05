import { fireEvent, render } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { MASKED_INR_VALUE } from "@/src/components/common";
import { createPortfolioStore } from "@/src/store";

import { QuickPortfolioSetupScreen } from "../QuickPortfolioSetupScreen";
import { createQuickSetupSessionStore } from "../quickSetupSession";

describe("QuickPortfolioSetupScreen", () => {
  it("restores confirmed progress and completes from the aggregate review", () => {
    const portfolioStore = createPortfolioStore({
      storage: createMemoryJsonStorage(),
    });
    portfolioStore.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "asset-1",
      name: "HDFC Bank",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    portfolioStore.getState().addOpeningPosition({
      assetId: "asset-1",
      averageCostPrice: 100,
      date: null,
      id: "opening-1",
      quantity: 10,
    });
    const sessionStorage = createMemoryJsonStorage();
    const sessionStore = createQuickSetupSessionStore({
      now: () => new Date("2026-08-15T10:00:00.000Z"),
      storage: sessionStorage,
    });
    sessionStore.getState().recordItem({
      assetId: "asset-1",
      kind: "openingPosition",
      name: "HDFC Bank",
      recordId: "opening-1",
    });
    sessionStore.getState().showReview();
    const onComplete = jest.fn();
    const { getByRole, getByTestId, getByText } = render(
      <QuickPortfolioSetupScreen
        onAddPpfAccount={jest.fn()}
        onComplete={onComplete}
        onExit={jest.fn()}
        sessionStore={sessionStore}
        store={portfolioStore}
      />,
    );

    expect(getByTestId("quick-setup-review-screen")).toBeTruthy();
    expect(getByText("HDFC Bank")).toBeTruthy();
    expect(getByText(/1 current price is still needed/u)).toBeTruthy();
    expect(getByRole("button", { name: "Add another holding" })).toBeTruthy();
    expect(getByRole("button", { name: "Open Dashboard" })).toBeTruthy();
    fireEvent.press(getByTestId("quick-setup-complete"));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(sessionStore.getState().session).toBeNull();
    expect(portfolioStore.getState().openingPositions).toHaveLength(1);
  });

  it("keeps confirmed items when the entry screen is exited", () => {
    const portfolioStore = createPortfolioStore({
      storage: createMemoryJsonStorage(),
    });
    const sessionStore = createQuickSetupSessionStore({
      storage: createMemoryJsonStorage(),
    });
    sessionStore.getState().recordItem({
      assetId: "asset-1",
      kind: "openingPosition",
      name: "Saved holding",
      recordId: "opening-1",
    });
    const onExit = jest.fn();
    const { getByLabelText } = render(
      <QuickPortfolioSetupScreen
        onAddPpfAccount={jest.fn()}
        onComplete={jest.fn()}
        onExit={onExit}
        sessionStore={sessionStore}
        store={portfolioStore}
      />,
    );

    fireEvent.press(getByLabelText("Exit portfolio setup"));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(sessionStore.getState().session?.items).toHaveLength(1);
  });

  it("blocks completion until a stale confirmed reference is removed", () => {
    const portfolioStore = createPortfolioStore({
      storage: createMemoryJsonStorage(),
    });
    const sessionStore = createQuickSetupSessionStore({
      storage: createMemoryJsonStorage(),
    });
    sessionStore.getState().recordItem({
      assetId: "deleted-asset",
      kind: "openingPosition",
      name: "Deleted holding",
      recordId: "deleted-opening",
    });
    sessionStore.getState().showReview();
    const onComplete = jest.fn();
    const { getByTestId, getByText } = render(
      <QuickPortfolioSetupScreen
        onAddPpfAccount={jest.fn()}
        onComplete={onComplete}
        onExit={jest.fn()}
        sessionStore={sessionStore}
        store={portfolioStore}
      />,
    );

    expect(getByTestId("quick-setup-missing-records")).toBeTruthy();
    fireEvent.press(getByTestId("quick-setup-complete"));
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.press(getByText("Remove"));
    expect(sessionStore.getState().session?.items).toEqual([]);
  });

  it.each([true, false])("masks only wealth values in review (priced: %s)", (hasPrice) => {
    const portfolioStore = createPortfolioStore({
      storage: createMemoryJsonStorage(),
    });
    portfolioStore.getState().updatePreferences({ maskWealthValues: true });
    const sessionStore = createQuickSetupSessionStore({
      storage: createMemoryJsonStorage(),
    });
    sessionStore.getState().recordItem({
      assetId: "asset-masked",
      kind: "openingPosition",
      name: "Masked holding",
      recordId: "opening-masked",
    });
    portfolioStore.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      id: "asset-masked",
      name: "Masked holding",
      symbol: "MASKED",
      ticker: "MASKED.NS",
    });
    portfolioStore.getState().addOpeningPosition({
      assetId: "asset-masked",
      averageCostPrice: 100,
      date: null,
      id: "opening-masked",
      manualValuation: hasPrice ? {
        asOf: "2026-08-15T10:00:00.000Z",
        currency: "INR",
        price: 125,
        provenance: "user",
        source: "manual",
      } : undefined,
      quantity: 2,
    });
    sessionStore.getState().showReview();
    const { getAllByText, getByText } = render(
      <QuickPortfolioSetupScreen
        onAddPpfAccount={jest.fn()}
        onComplete={jest.fn()}
        onExit={jest.fn()}
        sessionStore={sessionStore}
        store={portfolioStore}
      />,
    );

    expect(getAllByText(MASKED_INR_VALUE).length).toBe(hasPrice ? 3 : 1);
    if (hasPrice) expect(getByText("+25.00%")).toBeTruthy();
    else expect(getAllByText("Pending")).toHaveLength(3);
  });
});
