import { render } from "@testing-library/react-native";
import AssetHistoryQaRoute from "@/app/asset-history-qa";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: "invalid" }) }));
jest.mock("@/src/services/quotes/dailyPriceCache", () => ({ createDailyPriceCache: jest.fn() }));

it("does not initialize a fixture or cache without the development token", () => {
  const screen = render(<AssetHistoryQaRoute />);
  expect(screen.getByTestId("asset-history-qa-blocked")).toBeTruthy();
  expect(createDailyPriceCache).not.toHaveBeenCalled();
});
