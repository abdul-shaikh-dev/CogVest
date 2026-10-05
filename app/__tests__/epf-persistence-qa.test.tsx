import { render } from "@testing-library/react-native";
import EpfPersistenceQaRoute from "@/app/epf-persistence-qa";
import { createPortfolioStore } from "@/src/store";
import { createMMKV } from "react-native-mmkv";

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: "invalid" }) }));
jest.mock("@/src/store", () => ({ createPortfolioStore: jest.fn() }));
jest.mock("react-native-mmkv", () => ({ createMMKV: jest.fn() }));

it("does not initialize the synthetic EPF store without the development token", () => {
  expect(render(<EpfPersistenceQaRoute />).getByText("EPF QA unavailable.")).toBeTruthy();
  expect(createPortfolioStore).not.toHaveBeenCalled();
  expect(createMMKV).not.toHaveBeenCalled();
});
