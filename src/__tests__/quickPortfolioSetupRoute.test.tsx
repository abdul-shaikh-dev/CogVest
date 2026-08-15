import { render } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockScreenProps:
  | {
      hardwareBackEnabled: boolean;
      now?: Date;
      onAddPpfAccount: () => void;
      onComplete: () => void;
      resolveQuote?: unknown;
      searchAssetLookupResults?: unknown;
    }
  | undefined;
let mockParams: { token?: string; visualQaState?: string } = {};

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: mockPush,
    replace: mockReplace,
  },
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require("react") as typeof import("react");
    React.useEffect(effect, [effect]);
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/src/features/quickSetup", () => ({
  QuickPortfolioSetupScreen: (props: typeof mockScreenProps) => {
    mockScreenProps = props;
    return null;
  },
}));

const QuickPortfolioSetupRoute =
  require("../../app/quick-portfolio-setup").default as typeof import("../../app/quick-portfolio-setup").default;

describe("Quick Portfolio Setup route", () => {
  beforeEach(() => {
    mockScreenProps = undefined;
    mockPush.mockClear();
    mockReplace.mockClear();
    mockParams = {};
  });

  it("keeps PPF inside setup and completes on Dashboard", () => {
    render(<QuickPortfolioSetupRoute />);

    expect(mockScreenProps?.hardwareBackEnabled).toBe(true);
    mockScreenProps?.onAddPpfAccount();
    expect(mockPush).toHaveBeenCalledWith({
      params: { returnTo: "quick-portfolio-setup" },
      pathname: "/ppf-account",
    });

    mockScreenProps?.onComplete();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("enables deterministic lookup only for the authorized development harness", () => {
    mockParams = {
      token: "cogvest-local-visual-qa",
      visualQaState: "lookup",
    };

    render(<QuickPortfolioSetupRoute />);

    expect(mockScreenProps?.resolveQuote).toEqual(expect.any(Function));
    expect(mockScreenProps?.now).toEqual(
      new Date("2026-05-29T10:15:00.000Z"),
    );
    expect(mockScreenProps?.searchAssetLookupResults).toEqual(
      expect.any(Function),
    );
  });

  it("does not expose deterministic providers without the harness token", () => {
    mockParams = { visualQaState: "lookup" };

    render(<QuickPortfolioSetupRoute />);

    expect(mockScreenProps?.resolveQuote).toBeUndefined();
    expect(mockScreenProps?.searchAssetLookupResults).toBeUndefined();
  });
});
