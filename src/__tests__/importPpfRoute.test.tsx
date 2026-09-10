const mockBack = jest.fn(), mockReplace = jest.fn(), mockCanGoBack = jest.fn();
jest.mock("expo-router", () => ({
  router: { back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack },
  useLocalSearchParams: () => ({ accountId: "ppf-test" }),
}));
jest.mock("@/src/features/ppf/PpfImportScreen", () => ({ PpfImportScreen: () => null }));
jest.mock("@/src/services/import-export/ppfCsvFile", () => ({ pickPpfCsvFile: jest.fn(), savePpfCsvTemplate: jest.fn() }));
const Route = require("../../app/import-ppf").default;
it("targets the saved account and uses a safe back fallback", () => {
  const element = Route();
  expect(element.props.accountId).toBe("ppf-test");
  mockCanGoBack.mockReturnValue(false);
  element.props.onCancel();
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/holdings");
  mockCanGoBack.mockReturnValue(true);
  element.props.onCancel();
  expect(mockBack).toHaveBeenCalled();
  element.props.onImported("ppf-test");
  expect(mockBack).toHaveBeenCalledTimes(2);
  mockCanGoBack.mockReturnValue(false);
  element.props.onImported("ppf-test");
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/ppf-account", params: { accountId: "ppf-test" } });
});
