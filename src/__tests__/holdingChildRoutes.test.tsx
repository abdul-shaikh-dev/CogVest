const mockParams: { assetId?: string; entryId?: string; openingPositionId?: string; returnTo?: string; tradeId?: string } = {};
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

jest.mock("@/src/features/cash", () => ({
  ReviewCashEntryScreen: () => null,
}));

const CashEntryRoute =
  require("../../app/cash-entry").default as typeof import("../../app/cash-entry").default;

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
    delete mockParams.entryId;
    delete mockParams.openingPositionId;
    delete mockParams.returnTo;
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

  it("opens a linked transaction from Cash and returns cancellation or completion to Cash", () => {
    mockParams.entryId = "cash-1";
    const cashRoute = CashEntryRoute() as {
      props: { entryId: string; onCancel: () => void; onReviewLinkedTrade: (tradeId: string) => void };
    };

    expect(cashRoute.props.entryId).toBe("cash-1");
    cashRoute.props.onCancel();
    expect(mockBack).toHaveBeenCalledTimes(1);
    cashRoute.props.onReviewLinkedTrade("trade-1");
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/trade",
      params: { returnTo: "cash", tradeId: "trade-1" },
    });

    mockParams.tradeId = "trade-1";
    mockParams.returnTo = "cash";
    const tradeRoute = TradeRoute() as {
      props: { backLabel: string; onCancel: () => void; onComplete: (message: string) => void };
    };
    expect(tradeRoute.props.backLabel).toBe("Back to Cash Ledger");
    tradeRoute.props.onCancel();
    tradeRoute.props.onComplete("Transaction saved.");

    expect(mockDismissTo).toHaveBeenNthCalledWith(1, "/(tabs)/cash");
    expect(mockDismissTo).toHaveBeenNthCalledWith(2, "/(tabs)/cash");
  });
});
