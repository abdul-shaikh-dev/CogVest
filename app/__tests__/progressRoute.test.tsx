const mockNavigate = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: mockNavigate, push: mockPush },
}));

const ProgressRoute = require("../../app/(tabs)/progress").default;

describe("Progress route", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPush.mockClear();
  });

  it("routes status actions to portfolio setup, Holdings, and snapshot review", () => {
    const element = ProgressRoute();

    element.props.onSetUpPortfolio();
    expect(mockPush).toHaveBeenCalledWith("/quick-portfolio-setup");

    element.props.onOpenHoldings();
    expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/holdings");

    element.props.onReviewSnapshot();
    expect(mockPush).toHaveBeenCalledWith("/review-snapshot");
  });

  it("routes EPF-only actions to the account, the EPF list, or Add Holding", () => {
    const element = ProgressRoute();

    element.props.onOpenEpf("epf-main");
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/epf-account", params: { accountId: "epf-main" } });

    element.props.onOpenEpf(undefined);
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: "/(tabs)/holdings", params: { destination: "epf" } });

    element.props.onAddHolding();
    expect(mockPush).toHaveBeenCalledWith("/add-holding");
  });
});
