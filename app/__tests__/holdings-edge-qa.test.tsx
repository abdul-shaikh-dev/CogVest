import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import HoldingsEdgeQaRoute from "@/app/holdings-edge-qa";
import { getPortfolioStore } from "@/src/store";
import { typography } from "@/src/theme";

let mockParams: { token?: string; scenario?: string; mode?: string } = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/src/store", () => ({
  ...jest.requireActual("@/src/store"),
  getPortfolioStore: jest.fn(() => { throw new Error("Persistent store must not be accessed"); }),
}));
jest.mock("@/src/features/holdings/useAssetHistory", () => ({
  useAssetHistory: () => ({ loading: false, retry: jest.fn() }),
}));
jest.mock("@/src/hooks/useReducedMotionPreference", () => ({
  useReducedMotionPreference: () => true,
}));

beforeEach(() => { mockParams = { token: "cogvest-local-visual-qa" }; });

it("blocks missing tokens and release access", () => {
  mockParams = {};
  const screen = render(<HoldingsEdgeQaRoute />);
  expect(screen.getByTestId("holdings-edge-qa-blocked")).toBeTruthy();
  const development = __DEV__;
  try {
    Object.assign(globalThis, { __DEV__: false });
    mockParams = { token: "cogvest-local-visual-qa" };
    screen.rerender(<HoldingsEdgeQaRoute />);
    expect(screen.getByTestId("holdings-edge-qa-blocked")).toBeTruthy();
  } finally { Object.assign(globalThis, { __DEV__: development }); }
});

it("renders exact synthetic balances and masking without changing the saved portfolio", () => {
  const screen = render(<HoldingsEdgeQaRoute />);
  fireEvent.press(screen.getByTestId("holding-row-edge-long"));
  expect(screen.getByText("₹12,19,31,84,926.08")).toBeTruthy();
  expect(screen.getByText("₹12,19,31,84,926.08")).toHaveStyle({ fontSize: typography.sizes.title });
  expect(screen.getByText("₹9,44,97,18,533.76")).toBeTruthy();
  fireEvent.press(screen.getByTestId("holding-detail-mask"));
  expect(screen.queryByText("₹12,19,31,84,926.08")).toBeNull();
  expect(getPortfolioStore).not.toHaveBeenCalled();
});

it("keeps missing prices pending and supports the empty fixture", () => {
  mockParams.scenario = "pending";
  const screen = render(<HoldingsEdgeQaRoute />);
  expect(screen.getAllByText("Valuation pending").length).toBeGreaterThan(0);
  mockParams.scenario = "empty";
  screen.rerender(<HoldingsEdgeQaRoute />);
  expect(screen.queryByTestId("holding-row-edge-long")).toBeNull();
});

it("stacks the large-text pending warning and preserves the failed refresh state", async () => {
  const dimensions = jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
    width: 360, height: 800, scale: 3, fontScale: 1.3,
  });
  try {
    mockParams = { ...mockParams, scenario: "pending", mode: "minimal" };
    const screen = render(<HoldingsEdgeQaRoute />);
    expect(screen.getByTestId("holdings-pending-valuations")).toHaveStyle({ flexDirection: "column" });
    expect(screen.queryByTestId("holding-pnl-edge-long")).toBeNull();
    fireEvent.press(screen.getByTestId("holdings-refresh-pending-prices"));
    fireEvent.press(screen.getByTestId("holdings-more-button"));
    fireEvent.press(screen.getByTestId("holdings-valuation-details-button"));
    await waitFor(() => expect(screen.getByText("Quote refresh failed")).toBeTruthy());
    expect(screen.getByText(/No usable prices are available/)).toBeTruthy();
    expect(getPortfolioStore).not.toHaveBeenCalled();
  } finally { dimensions.mockRestore(); }
});
