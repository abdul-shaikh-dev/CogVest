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
});
