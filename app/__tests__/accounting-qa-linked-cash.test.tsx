import { render } from "@testing-library/react-native";

import AccountingQaRoute from "@/app/accounting-qa";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({
    run: "missing-linked-cash",
    token: "cogvest-local-visual-qa",
  }),
}));

it("renders the token-gated missing linked Cash QA state", async () => {
  const screen = await render(<AccountingQaRoute />);

  expect(screen.getByTestId("review-cash-entry-screen")).toBeTruthy();
  expect(screen.getByTestId("linked-cash-owner-missing")).toHaveTextContent(
    /The linked transaction is missing/u,
  );
  expect(screen.queryByTestId("review-linked-cash-transaction")).toBeNull();
});
