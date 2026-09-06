import { act, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import VisualQaSeedRoute from "../../app/visual-qa-seed";

const mockSeedVisualQaPortfolio = jest.fn();
const mockGetPortfolioStore = jest.fn(() => ({ getState: jest.fn() }));
let mockToken: string | undefined = "cogvest-local-visual-qa";
let mockHistory: string | undefined;

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ token: mockToken, history: mockHistory }),
}));

jest.mock("@/src/store", () => ({
  getPortfolioStore: () => mockGetPortfolioStore(),
}));

jest.mock("@/src/testing/visualQaSeed", () => {
  const actual = jest.requireActual("@/src/testing/visualQaSeed");

  return {
    ...actual,
    seedVisualQaPortfolio: (...args: unknown[]) =>
      mockSeedVisualQaPortfolio(...args),
  };
});

describe("visual QA seed deep link", () => {
  const alertSpy = jest
    .spyOn(Alert, "alert")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    mockToken = "cogvest-local-visual-qa";
    mockHistory = undefined;
  });

  it("does not replace local data until the developer confirms", () => {
    const { getByTestId, getByText } = render(<VisualQaSeedRoute />);

    expect(getByTestId("visual-qa-seed-confirmation")).toBeTruthy();
    expect(getByText("Visual QA confirmation required")).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      "Replace local developer data?",
      expect.any(String),
      expect.any(Array),
      { cancelable: false },
    );
    expect(mockSeedVisualQaPortfolio).not.toHaveBeenCalled();

    const actions = alertSpy.mock.calls.at(-1)?.[2];
    act(() => actions?.[1].onPress?.());

    expect(mockSeedVisualQaPortfolio).toHaveBeenCalledTimes(1);
    expect(getByText("Visual QA portfolio seeded.")).toBeTruthy();
  });

  it("blocks an invalid deep-link token without mutating data", () => {
    mockToken = "invalid";

    const { getByTestId } = render(<VisualQaSeedRoute />);

    expect(getByTestId("visual-qa-seed-blocked")).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockSeedVisualQaPortfolio).not.toHaveBeenCalled();
  });

  it("requires confirmation before preparing the optional long history", () => {
    mockHistory = "long";
    render(<VisualQaSeedRoute />);
    expect(mockSeedVisualQaPortfolio).not.toHaveBeenCalled();
    act(() => alertSpy.mock.calls.at(-1)?.[2]?.[1].onPress?.());
    expect(mockSeedVisualQaPortfolio).toHaveBeenCalledWith(
      mockGetPortfolioStore.mock.results.at(-1)?.value,
      { longHistory: true },
    );
  });

  it("lets the developer cancel without mutating data", () => {
    render(<VisualQaSeedRoute />);
    const actions = alertSpy.mock.calls.at(-1)?.[2];
    act(() => actions?.[0].onPress?.());

    expect(mockSeedVisualQaPortfolio).not.toHaveBeenCalled();
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock };
    };
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
  });
});
