const mockParams: { assetId?: string; openingPositionId?: string; tradeId?: string } = {};
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: mockBack,
    dismissTo: mockDismissTo,
    push: mockPush,
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/src/features/openingPositions", () => ({
  ReviewOpeningPositionScreen: () => null,
}));

jest.mock("@/src/features/sellRedeem", () => ({
  SellRedeemScreen: () => null,
}));

jest.mock("@/src/features/trades", () => ({
  ReviewTradeScreen: () => null,
  TradeHistoryScreen: () => null,
}));

const HoldingTransactionsRoute =
  require("../../app/holding-transactions").default as typeof import("../../app/holding-transactions").default;
const OpeningPositionRoute =
  require("../../app/opening-position").default as typeof import("../../app/opening-position").default;
const SellRedeemRoute =
  require("../../app/sell-redeem").default as typeof import("../../app/sell-redeem").default;
const TradeRoute =
  require("../../app/trade").default as typeof import("../../app/trade").default;

describe("holding child routes", () => {
  beforeEach(() => {
    delete mockParams.assetId;
    delete mockParams.openingPositionId;
    delete mockParams.tradeId;
    mockBack.mockClear();
    mockDismissTo.mockClear();
    mockPush.mockClear();
  });

  it("returns sale cancellation and completion to the existing holding detail", () => {
    mockParams.assetId = "asset-1";
    const route = SellRedeemRoute() as {
      props: { assetId: string; onCancel: () => void; onSaved: () => void };
    };

    expect(route.props.assetId).toBe("asset-1");
    route.props.onCancel();
    route.props.onSaved();

    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it("keeps transaction history as an intermediate correction context", () => {
    mockParams.assetId = "asset-1";
    const route = HoldingTransactionsRoute() as {
      props: { assetId: string; onBack: () => void; onReviewTrade: (id: string) => void };
    };

    route.props.onReviewTrade("trade-1");
    route.props.onBack();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/trade",
      params: { tradeId: "trade-1" },
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("cancels opening corrections one level back and completes into preserved holdings", () => {
    mockParams.openingPositionId = "opening-1";
    const route = OpeningPositionRoute() as {
      props: { onCancel: () => void; onComplete: (message: string) => void };
    };

    route.props.onCancel();
    route.props.onComplete("Opening position updated.");

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: "/(tabs)/holdings",
      params: { statusMessage: "Opening position updated." },
    });
  });

  it("cancels trade corrections to history and completes into preserved holdings", () => {
    mockParams.tradeId = "trade-1";
    const route = TradeRoute() as {
      props: { onCancel: () => void; onComplete: (message: string) => void };
    };

    route.props.onCancel();
    route.props.onComplete("Transaction saved.");

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: "/(tabs)/holdings",
      params: { statusMessage: "Transaction saved." },
    });
  });
});
