const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

jest.mock("expo-router", () => ({
  router: {
    navigate: mockNavigate,
    push: jest.fn(),
    setParams: mockSetParams,
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/src/features/quickSetup", () => ({
  useQuickSetupSession: () => ({ session: null }),
}));

const CashRoute = require("../../app/(tabs)/cash").default;
const DashboardRoute = require("../../app/(tabs)/dashboard").default;

describe("current-month recovery routes", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSetParams.mockClear();
    mockParams = {};
  });

  it("opens income entry from Dashboard with a return target", () => {
    const element = DashboardRoute();

    element.props.onRecordIncome();

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/cash",
      params: { openIncomeEntry: "true", returnTo: "dashboard" },
    });
  });

  it("returns to Dashboard after income is recorded", () => {
    mockParams = { openIncomeEntry: "true", returnTo: "dashboard" };
    const element = CashRoute();

    expect(element.props.openIncomeEntry).toBe(true);
    element.props.onIncomeEntryOpened();
    expect(mockSetParams).toHaveBeenCalledWith({ openIncomeEntry: undefined });

    element.props.onIncomeRecorded();
    expect(mockSetParams).toHaveBeenCalledWith({ returnTo: undefined });
    expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("clears the return target when income entry is cancelled", () => {
    mockParams = { returnTo: "dashboard" };
    const element = CashRoute();

    element.props.onIncomeEntryClosed();

    expect(mockSetParams).toHaveBeenCalledWith({ returnTo: undefined });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
