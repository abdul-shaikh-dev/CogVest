import { act, render } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockCreateFile = jest.fn();
const mockPickDirectoryAsync = jest.fn();
const mockReplace = jest.fn();
const mockPickFileAsync = jest.fn();
const mockRecordItem = jest.fn();
const mockShowReview = jest.fn();
const mockWrite = jest.fn();
let capturedProps: Record<string, unknown> | undefined;

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("expo-file-system", () => ({
  Directory: class MockDirectory {
    static pickDirectoryAsync(...args: unknown[]) {
      return mockPickDirectoryAsync(...args);
    }
  },
  File: class MockFile {
    static pickFileAsync(...args: unknown[]) {
      return mockPickFileAsync(...args);
    }
    name = "holdings.csv";
    size = 123;
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    text() {
      return Promise.resolve("cogvest_version,quantity,average_cost\n1,1,1");
    }
  },
}));

jest.mock("@/src/features/holdingImport", () => ({
  HoldingImportScreen: (props: Record<string, unknown>) => {
    capturedProps = props;
    return null;
  },
  holdingsCsvMaxBytes: 1_000_000,
}));

jest.mock("@/src/features/quickSetup", () => ({
  getQuickSetupSessionStore: () => ({
    getState: () => ({ recordItem: mockRecordItem, showReview: mockShowReview }),
  }),
}));

import ImportHoldingsRoute from "@/app/import-holdings";

describe("Import holdings route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedProps = undefined;
    mockCreateFile.mockReturnValue({ write: mockWrite });
    mockPickDirectoryAsync.mockResolvedValue({ createFile: mockCreateFile });
  });

  it("writes the published template to a user-selected Android folder", async () => {
    render(<ImportHoldingsRoute />);

    await expect(
      (capturedProps?.saveCsvTemplate as () => Promise<unknown>)(),
    ).resolves.toBe("cogvest-holdings-v1.csv");
    expect(mockPickDirectoryAsync).toHaveBeenCalledWith();
    expect(mockCreateFile).toHaveBeenCalledWith(
      "cogvest-holdings-v1.csv",
      "text/csv",
    );
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringMatching(/^cogvest_version,name,ticker/u),
    );
  });

  it("reads the selected Android CSV and enters Quick Setup review after import", async () => {
    mockPickFileAsync.mockResolvedValue({
      size: 123,
      text: () => Promise.resolve("cogvest_version,quantity,average_cost\n1,1,1"),
      uri: "content://holdings.csv",
    });
    render(<ImportHoldingsRoute />);

    await expect(
      (capturedProps?.pickCsvFile as () => Promise<unknown>)(),
    ).resolves.toMatchObject({ name: "holdings.csv", size: 123 });
    expect(mockPickFileAsync).toHaveBeenCalledWith(undefined, "text/*");

    act(() => {
      (capturedProps?.onImported as (result: unknown) => void)({
        items: [
          {
            asset: { id: "asset-1", name: "HDFC Bank" },
            openingPosition: { id: "position-1" },
          },
        ],
        pendingValuations: 0,
      });
    });

    expect(mockRecordItem).toHaveBeenCalledWith({
      assetId: "asset-1",
      kind: "openingPosition",
      name: "HDFC Bank",
      recordId: "position-1",
    });
    expect(mockShowReview).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/quick-portfolio-setup");
  });

  it("rejects an oversized Android document before reading its contents", async () => {
    const text = jest.fn();
    mockPickFileAsync.mockResolvedValue({
      name: "too-large.csv",
      size: 1_000_001,
      text,
      uri: "content://documents/too-large.csv",
    });
    render(<ImportHoldingsRoute />);

    await expect(
      (capturedProps?.pickCsvFile as () => Promise<unknown>)(),
    ).resolves.toEqual({
      name: "too-large.csv",
      size: 1_000_001,
      text: "",
    });
    expect(text).not.toHaveBeenCalled();
  });
});
