import { render } from "@testing-library/react-native";
import ScaleQaRoute from "@/app/scale-qa";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createAndroidScaleFixture } from "@/src/testing/androidScaleFixture";
import { createRealShapedFixture } from "@/src/testing/realShapedFixture";

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: "invalid" }) }));
jest.mock("@/src/services/quotes/dailyPriceCache", () => ({ createDailyPriceCache: jest.fn() }));
jest.mock("@/src/testing/androidScaleFixture", () => ({ createAndroidScaleFixture: jest.fn() }));
jest.mock("@/src/testing/realShapedFixture", () => ({ createRealShapedFixture: jest.fn() }));

it("does not initialize or replace data without the development token", async () => {
  const screen = await render(<ScaleQaRoute />);
  expect(screen.getByTestId("scale-qa-blocked")).toBeTruthy();
  expect(createDailyPriceCache).not.toHaveBeenCalled();
  expect(createAndroidScaleFixture).not.toHaveBeenCalled();
  expect(createRealShapedFixture).not.toHaveBeenCalled();
});
