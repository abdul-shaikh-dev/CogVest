import { render } from "@testing-library/react-native";
import EpfReportingQa from "@/app/epf-reporting-qa";
import { createEpfReportingFixture } from "@/src/testing/epfReportingFixture";

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: "invalid" }) }));
jest.mock("@/src/testing/epfReportingFixture", () => ({ createEpfReportingFixture: jest.fn() }));
test("EPF reporting fixture is inaccessible without development authorization", () => {
  expect(render(<EpfReportingQa />).getByText("EPF QA unavailable.")).toBeTruthy();
  expect(createEpfReportingFixture).not.toHaveBeenCalled();
});
