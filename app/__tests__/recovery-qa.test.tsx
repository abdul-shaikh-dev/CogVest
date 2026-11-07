import { fireEvent, render } from "@testing-library/react-native";
import RecoveryQaRoute from "@/app/recovery-qa";

let mockParams: { token?: string; preserved?: string } = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

it("blocks access without the development fixture token", async () => {
  mockParams = {};
  expect((await render(<RecoveryQaRoute />)).getByTestId("recovery-qa-blocked")).toBeTruthy();
});

it("keeps synthetic reset callbacks isolated and preserves cancellation", async () => {
  mockParams = { token: "cogvest-local-visual-qa" };
  const screen = await render(<RecoveryQaRoute />);
  await fireEvent.press(screen.getByTestId("start-storage-reset"));
  await fireEvent.press(screen.getByTestId("cancel-storage-reset"));
  expect(screen.getByTestId("recovery-qa-result")).toHaveTextContent(/Reset callbacks: 0/);
  await fireEvent.press(screen.getByTestId("start-storage-reset"));
  await fireEvent.press(screen.getByTestId("confirm-storage-reset"));
  expect(screen.getByTestId("recovery-qa-result")).toHaveTextContent(/Reset callbacks: 1/);
});

it("offers no synthetic reset when the recovery copy was not preserved", async () => {
  mockParams = { token: "cogvest-local-visual-qa", preserved: "no" };
  const screen = await render(<RecoveryQaRoute />);
  expect(screen.queryByTestId("start-storage-reset")).toBeNull();
  expect(screen.getByText("CogVest stopped before overwriting your data")).toBeTruthy();
});
