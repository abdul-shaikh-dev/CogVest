const mockParams: { accountId?: string; returnTo?: string } = {};
const mockRecordItem = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();
const mockDismissTo = jest.fn();
const mockPortfolioState = {
  ppfAccounts: [
    {
      id: "ppf-1",
      nickname: "Primary PPF",
    },
  ],
};

jest.mock("expo-router", () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    dismissTo: mockDismissTo,
    push: jest.fn(),
    replace: mockReplace,
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/src/features/quickSetup", () => ({
  getQuickSetupSessionStore: () => ({
    getState: () => ({ recordItem: mockRecordItem }),
  }),
}));

jest.mock("@/src/store", () => ({
  getPortfolioStore: () => ({ getState: () => mockPortfolioState }),
}));

const PpfAccountRoute =
  require("../../app/ppf-account").default as typeof import("../../app/ppf-account").default;

describe("PPF account route", () => {
  beforeEach(() => {
    delete mockParams.accountId;
    delete mockParams.returnTo;
    mockRecordItem.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReset();
    mockDismissTo.mockClear();
  });

  it("records a new account once and shows saved details before setup continues", () => {
    mockParams.returnTo = "quick-portfolio-setup";
    const routeElement = PpfAccountRoute() as {
      props: { onComplete: (accountId: string) => void };
    };

    routeElement.props.onComplete("ppf-1");

    expect(mockRecordItem).toHaveBeenCalledWith({
      kind: "ppfAccount",
      name: "Primary PPF",
      recordId: "ppf-1",
    });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/ppf-account",
      params: { accountId: "ppf-1", returnTo: "quick-portfolio-setup" },
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("keeps quick setup context after editing without recording the account again", () => {
    mockParams.returnTo = "quick-portfolio-setup";
    mockParams.accountId = "ppf-1";
    const routeElement = PpfAccountRoute() as {
      props: { onComplete: (accountId: string) => void };
    };

    routeElement.props.onComplete("ppf-1");

    expect(mockRecordItem).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/ppf-account",
      params: { accountId: "ppf-1", returnTo: "quick-portfolio-setup" },
    });
  });

  it("uses safe fallbacks for leaving the account or continuing setup", () => {
    mockParams.returnTo = "quick-portfolio-setup";
    mockCanGoBack.mockReturnValue(false);
    const routeElement = PpfAccountRoute() as {
      props: { onBack: () => void; onContinuePortfolioSetup: () => void };
    };

    routeElement.props.onBack();
    routeElement.props.onContinuePortfolioSetup();

    expect(mockReplace).toHaveBeenNthCalledWith(1, "/(tabs)/holdings");
    expect(mockDismissTo).toHaveBeenCalledWith("/quick-portfolio-setup");
  });

  it("targets setup explicitly even when another screen is behind the account", () => {
    mockParams.returnTo = "quick-portfolio-setup";
    mockCanGoBack.mockReturnValue(true);
    const routeElement = PpfAccountRoute() as { props: { onContinuePortfolioSetup: () => void } };
    routeElement.props.onContinuePortfolioSetup();
    expect(mockDismissTo).toHaveBeenCalledWith("/quick-portfolio-setup");
    expect(mockBack).not.toHaveBeenCalled();
  });
});
