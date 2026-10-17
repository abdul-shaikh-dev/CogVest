import { render } from "@testing-library/react-native";
import { createMMKV } from "react-native-mmkv";
import EpfAccountsQa from "@/app/epf-accounts-qa";

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: "invalid" }) }));
jest.mock("react-native-mmkv", () => ({ createMMKV: jest.fn() }));
test("EPF accounts QA database is inaccessible without development authorization", () => {
  expect(render(<EpfAccountsQa />).getByText("EPF QA unavailable.")).toBeTruthy();
  expect(createMMKV).not.toHaveBeenCalled();
});
