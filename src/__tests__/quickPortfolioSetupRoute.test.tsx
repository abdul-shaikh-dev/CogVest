import { render } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockScreenProps:
  | {
      hardwareBackEnabled: boolean;
      onAddPpfAccount: () => void;
      onComplete: () => void;
    }
  | undefined;

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
});
