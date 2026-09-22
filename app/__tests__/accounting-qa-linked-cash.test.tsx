import { render } from "@testing-library/react-native";

import AccountingQaRoute from "@/app/accounting-qa";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({
    run: "missing-linked-cash",
    token: "cogvest-local-visual-qa",
  }),
}));

it("renders the token-gated missing linked Cash QA state", () => {
  const screen = render(<AccountingQaRoute />);

  expect(screen.getByTestId("review-cash-entry-screen")).toBeTruthy();
  expect(screen.getByTestId("linked-cash-owner-missing")).toHaveTextContent(
    /no longer available/u,
  );
  expect(screen.queryByTestId("review-linked-cash-transaction")).toBeNull();
});
