const mockParams: { assetId?: string; returnTo?: string } = {};
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/src/features/assets", () => ({
  ManageAssetsScreen: () => null,
  ReviewAssetScreen: () => null,
}));

const ManageAssetsRoute =
  require("../../app/manage-assets").default as typeof import("../../app/manage-assets").default;
const ReviewAssetRoute =
  require("../../app/asset").default as typeof import("../../app/asset").default;

describe("asset routes", () => {
  beforeEach(() => {
    delete mockParams.assetId;
    delete mockParams.returnTo;
    mockBack.mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it("opens review with a Manage Assets return context", () => {
    const route = ManageAssetsRoute() as {
      props: { onBack: () => void; onReviewAsset: (assetId: string) => void };
    };

    route.props.onReviewAsset("asset-1");
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/asset",
      params: { assetId: "asset-1", returnTo: "manage-assets" },
    });
    route.props.onBack();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/holdings");
  });

  it("returns a completed review to the preserved Manage Assets list", () => {
    mockParams.assetId = "asset-1";
    mockParams.returnTo = "manage-assets";
    const route = ReviewAssetRoute() as {
      props: { onCancel: () => void; onComplete: (message: string) => void };
    };

    route.props.onComplete("Asset updated.");
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("keeps the normal asset completion route to Holdings", () => {
    mockParams.assetId = "asset-1";
    const route = ReviewAssetRoute() as {
      props: { onCancel: () => void; onComplete: (message: string) => void };
    };

    route.props.onCancel();
    route.props.onComplete("Asset updated.");
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/(tabs)/holdings",
      params: { statusMessage: "Asset updated." },
    });
  });
});
