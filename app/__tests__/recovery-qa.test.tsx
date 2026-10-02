import { fireEvent, render } from "@testing-library/react-native";
import RecoveryQaRoute from "@/app/recovery-qa";

let mockParams: { token?: string; preserved?: string } = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

it("blocks access without the development fixture token", () => {
  mockParams = {};
  expect(render(<RecoveryQaRoute />).getByTestId("recovery-qa-blocked")).toBeTruthy();
});

it("keeps synthetic reset callbacks isolated and preserves cancellation", () => {
  mockParams = { token: "cogvest-local-visual-qa" };
  const screen = render(<RecoveryQaRoute />);
  fireEvent.press(screen.getByTestId("start-storage-reset"));
  fireEvent.press(screen.getByTestId("cancel-storage-reset"));
  expect(screen.getByTestId("recovery-qa-result")).toHaveTextContent(/Reset callbacks: 0/);
  fireEvent.press(screen.getByTestId("start-storage-reset"));
  fireEvent.press(screen.getByTestId("confirm-storage-reset"));
  expect(screen.getByTestId("recovery-qa-result")).toHaveTextContent(/Reset callbacks: 1/);
});

it("offers no synthetic reset when the recovery copy was not preserved", () => {
  mockParams = { token: "cogvest-local-visual-qa", preserved: "no" };
  const screen = render(<RecoveryQaRoute />);
  expect(screen.queryByTestId("start-storage-reset")).toBeNull();
  expect(screen.getByText("CogVest stopped before overwriting your data")).toBeTruthy();
});
