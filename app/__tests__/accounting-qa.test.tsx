import { render } from "@testing-library/react-native";
import AccountingQaRoute from "@/app/accounting-qa";
import { createPortfolioStore } from "@/src/store";

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: "invalid" }) }));
jest.mock("@/src/store", () => ({ createPortfolioStore: jest.fn() }));

it("does not initialize the synthetic store without the development token", () => {
  expect(render(<AccountingQaRoute />).getByTestId("accounting-qa-blocked")).toBeTruthy();
  expect(createPortfolioStore).not.toHaveBeenCalled();
});
