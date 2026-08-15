const mockParams: { returnTo?: string } = {};
const mockRecordItem = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
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
    delete mockParams.returnTo;
    mockRecordItem.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  it("records the account and returns to an active quick setup", () => {
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
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
