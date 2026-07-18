const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    replace: mockReplace,
  },
  useLocalSearchParams: () => ({}),
}));

const AddHoldingRoute =
  require("../../app/add-holding").default as typeof import("../../app/add-holding").default;

describe("Add Holding route", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("replaces the completed wizard with Holdings", () => {
    const routeElement = AddHoldingRoute() as {
      props: { onComplete: () => void };
    };

    routeElement.props.onComplete();

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/holdings");
  });
});
