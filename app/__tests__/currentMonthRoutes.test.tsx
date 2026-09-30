const mockNavigate = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock("expo-router", () => ({
  router: { navigate: mockNavigate, push: mockPush },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/src/features/quickSetup", () => ({
  useQuickSetupSession: () => ({ session: null }),
}));
const CashRoute = require("../../app/(tabs)/cash").default;
const DashboardRoute = require("../../app/(tabs)/dashboard").default;

describe("investing Cash routes", () => {
  beforeEach(() => { jest.clearAllMocks(); mockParams = {}; });

  it("does not expose household income capture from Dashboard", () => {
    expect(DashboardRoute().props.onRecordIncome).toBeUndefined();
  });

  it("ignores retired income deep-link parameters without opening a form", () => {
    mockParams = { openIncomeEntry: "true", returnTo: "dashboard" };
    const element = CashRoute();
    expect(element.props.openIncomeEntry).toBeUndefined();
    expect(element.props.onIncomeRecorded).toBeUndefined();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps Cash correction navigation", () => {
    CashRoute().props.onCorrectEntry("cash-example");
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/cash-entry", params: { entryId: "cash-example" },
    });
  });
});
