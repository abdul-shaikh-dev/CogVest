import { render } from "@testing-library/react-native";
import ScaleQaRoute from "@/app/scale-qa";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createAndroidScaleFixture } from "@/src/testing/androidScaleFixture";

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: "invalid" }) }));
jest.mock("@/src/services/quotes/dailyPriceCache", () => ({ createDailyPriceCache: jest.fn() }));
jest.mock("@/src/testing/androidScaleFixture", () => ({ createAndroidScaleFixture: jest.fn() }));

it("does not initialize or replace data without the development token", () => {
  const screen = render(<ScaleQaRoute />);
  expect(screen.getByTestId("scale-qa-blocked")).toBeTruthy();
  expect(createDailyPriceCache).not.toHaveBeenCalled();
  expect(createAndroidScaleFixture).not.toHaveBeenCalled();
});
