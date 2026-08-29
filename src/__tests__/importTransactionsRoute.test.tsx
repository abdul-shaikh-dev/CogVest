import { act, render } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockCreateFile = jest.fn();
const mockPickDirectoryAsync = jest.fn();
const mockPickFileAsync = jest.fn();
const mockReplace = jest.fn();
const mockWrite = jest.fn();
let capturedProps: Record<string, unknown> | undefined;

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
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
  },
}));

jest.mock("@/src/features/transactionImport", () => ({
  TransactionImportScreen: (props: Record<string, unknown>) => {
    capturedProps = props;
    return null;
  },
  transactionCsvMaxBytes: 1_000_000,
}));

import ImportTransactionsRoute from "@/app/import-transactions";

describe("Import transactions route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedProps = undefined;
    mockCreateFile.mockReturnValue({ write: mockWrite });
    mockPickDirectoryAsync.mockResolvedValue({ createFile: mockCreateFile });
  });

  it("writes the published transaction template to a selected Android folder", async () => {
    render(<ImportTransactionsRoute />);

    await expect(
      (capturedProps?.saveCsvTemplate as () => Promise<unknown>)(),
    ).resolves.toBe("cogvest-transactions-v1.csv");
    expect(mockCreateFile).toHaveBeenCalledWith(
      "cogvest-transactions-v1.csv",
      "text/csv",
    );
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringMatching(/^cogvest_version,transaction_type,trade_date/u),
    );
  });

  it("reads the selected CSV and returns to Holdings after import", async () => {
    const text = "cogvest_version,transaction_type\n1,buy";
    mockPickFileAsync.mockResolvedValue({
      name: "transactions.csv",
      size: text.length,
      text: () => Promise.resolve(text),
      uri: "content://transactions.csv",
    });
    render(<ImportTransactionsRoute />);

    await expect(
      (capturedProps?.pickCsvFile as () => Promise<unknown>)(),
    ).resolves.toEqual({
      name: "transactions.csv",
      size: text.length,
      text,
    });
    expect(mockPickFileAsync).toHaveBeenCalledWith(undefined, "text/*");

    act(() => {
      (capturedProps?.onImported as (result: unknown) => void)({
        added: 1,
        removedOpeningPositions: 0,
        status: "applied",
        updatedCutovers: 1,
      });
    });
    expect(mockReplace).toHaveBeenCalledWith({
      params: { statusMessage: "Transaction history imported." },
      pathname: "/(tabs)/holdings",
    });
  });

  it("does not read an oversized Android document", async () => {
    const text = jest.fn();
    mockPickFileAsync.mockResolvedValue({
      name: "too-large.csv",
      size: 1_000_001,
      text,
      uri: "content://too-large.csv",
    });
    render(<ImportTransactionsRoute />);

    await expect(
      (capturedProps?.pickCsvFile as () => Promise<unknown>)(),
    ).resolves.toEqual({
      name: "too-large.csv",
      size: 1_000_001,
      text: "",
    });
    expect(text).not.toHaveBeenCalled();
  });

  it("selects a CAS PDF without returning its identity-bearing filename", async () => {
    mockPickFileAsync.mockResolvedValue({
      name: "private-statement.pdf",
      size: 4096,
      uri: "content://private-statement.pdf",
    });
    render(<ImportTransactionsRoute />);

    await expect(
      (capturedProps?.pickCasStatement as () => Promise<unknown>)(),
    ).resolves.toEqual({
      size: 4096,
      uri: "content://private-statement.pdf",
    });
    expect(mockPickFileAsync).toHaveBeenCalledWith(
      undefined,
      "application/pdf",
    );
  });
});
