const mockPickFileAsync = jest.fn();
const mockPickDirectoryAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockCreateFile = jest.fn();
const mockWrite = jest.fn();

jest.mock("expo-file-system", () => ({
  Directory: { pickDirectoryAsync: (...args: unknown[]) => mockPickDirectoryAsync(...args) },
  File: { pickFileAsync: (...args: unknown[]) => mockPickFileAsync(...args) },
}));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

jest.mock(
  "@/src/domain/ppfCsv",
  () => ({
    ...jest.requireActual("@/src/domain/ppfCsv"),
    ppfCsvMaxBytes: 256 * 1024,
    ppfCsvTemplate: "account,entry\n",
    ppfCsvTemplateFileName: "cogvest-ppf-v1.csv",
  }),
);

const {
  pickPpfCsvFile,
  ppfCsvMaxBytes,
  savePpfCsvTemplate,
} = require("../ppfCsvFile") as typeof import("../ppfCsvFile");

describe("PPF CSV file adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns undefined when file or folder selection is cancelled", async () => {
    mockPickFileAsync.mockRejectedValueOnce(new Error("Picker canceled"));
    mockPickDirectoryAsync.mockResolvedValueOnce(undefined);

    await expect(pickPpfCsvFile()).resolves.toBeUndefined();
    await expect(savePpfCsvTemplate()).resolves.toBeUndefined();
  });

  it("uses a bounded read for a known-size CSV without exposing its contents in errors", async () => {
    const text = "account,entry\nPrimary,100\n";
    const selected = {
      name: "ppf.csv",
      size: new TextEncoder().encode(text).byteLength,
      text: jest.fn().mockResolvedValue(text),
      uri: "content://provider/ppf.csv",
    };
    mockPickFileAsync.mockResolvedValueOnce(selected);
    mockReadAsStringAsync.mockResolvedValueOnce(btoa(text));

    await expect(pickPpfCsvFile()).resolves.toEqual({
      name: "ppf.csv",
      size: selected.size,
      text,
    });
    expect(mockPickFileAsync).toHaveBeenCalledWith(undefined, "text/*");
    expect(selected.text).not.toHaveBeenCalled();
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(selected.uri, {
      encoding: "base64",
      length: ppfCsvMaxBytes + 1,
      position: 0,
    });
  });

  it("rejects known oversized files before reading them", async () => {
    const selected = {
      size: ppfCsvMaxBytes + 1,
      text: jest.fn(),
      uri: "content://provider/too-large.csv",
    };
    mockPickFileAsync.mockResolvedValueOnce(selected);

    await expect(pickPpfCsvFile()).rejects.toThrow("256 KB limit");
    expect(selected.text).not.toHaveBeenCalled();
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
  });

  it("decodes Unicode on Hermes without browser encoding globals", async () => {
    const originalAtob = globalThis.atob;
    const originalDecoder = globalThis.TextDecoder;
    const originalEncoder = globalThis.TextEncoder;
    const text = "date,type,amount,note\n2026-03-31,interest,350,₹ ब्याज";
    mockPickFileAsync.mockResolvedValueOnce({ uri: "content://provider/ppf.csv" });
    mockReadAsStringAsync.mockResolvedValueOnce(Buffer.from(text).toString("base64"));
    try {
      Object.assign(globalThis, { atob: undefined, TextDecoder: undefined, TextEncoder: undefined });
      await expect(pickPpfCsvFile()).resolves.toMatchObject({ text, size: Buffer.byteLength(text) });
    } finally {
      Object.assign(globalThis, { atob: originalAtob, TextDecoder: originalDecoder, TextEncoder: originalEncoder });
    }
  });

  it("rejects invalid UTF-8 without returning partial content", async () => {
    mockPickFileAsync.mockResolvedValueOnce({ uri: "content://provider/ppf.csv" });
    mockReadAsStringAsync.mockResolvedValueOnce("/w==");
    await expect(pickPpfCsvFile()).rejects.toThrow("could not be read");
  });

  it("uses a bounded read when the provider does not report a size", async () => {
    const text = "account,entry\nPrimary,100\n";
    mockPickFileAsync.mockResolvedValueOnce({
      size: undefined,
      uri: "content://provider/ppf%20history.csv",
    });
    mockReadAsStringAsync.mockResolvedValueOnce(btoa(text));

    await expect(pickPpfCsvFile()).resolves.toEqual({
      name: "ppf history.csv",
      size: new TextEncoder().encode(text).byteLength,
      text,
    });
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      "content://provider/ppf%20history.csv",
      { encoding: "base64", length: ppfCsvMaxBytes + 1, position: 0 },
    );
  });

  it("rejects an underreported finite size after the bounded read", async () => {
    const selected = {
      size: 1,
      text: jest.fn(),
      uri: "content://provider/underreported.csv",
    };
    mockPickFileAsync.mockResolvedValueOnce(selected);
    mockReadAsStringAsync.mockResolvedValueOnce(
      btoa("x".repeat(ppfCsvMaxBytes + 1)),
    );

    await expect(pickPpfCsvFile()).rejects.toThrow("256 KB limit");
    expect(selected.text).not.toHaveBeenCalled();
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(selected.uri, {
      encoding: "base64",
      length: ppfCsvMaxBytes + 1,
      position: 0,
    });
  });

  it("uses friendly read errors without logging selected content", async () => {
    const privateText = "private PPF balance";
    mockPickFileAsync.mockResolvedValueOnce({
      size: privateText.length,
      uri: "content://provider/private.csv",
    });
    mockReadAsStringAsync.mockRejectedValueOnce(new Error(privateText));
    const error = jest.spyOn(console, "error").mockImplementation();

    await expect(pickPpfCsvFile()).rejects.toThrow(
      "The selected PPF CSV could not be read.",
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("writes the PPF template to the selected folder and handles save errors", async () => {
    mockPickDirectoryAsync.mockResolvedValueOnce({
      createFile: mockCreateFile.mockReturnValue({ write: mockWrite }),
    });

    await expect(savePpfCsvTemplate()).resolves.toBe("cogvest-ppf-v1.csv");
    expect(mockCreateFile).toHaveBeenCalledWith("cogvest-ppf-v1.csv", "text/csv");
    expect(mockWrite).toHaveBeenCalledWith("account,entry\n");

    mockPickDirectoryAsync.mockRejectedValueOnce(new Error("permission denied"));
    await expect(savePpfCsvTemplate()).rejects.toThrow(
      "The PPF CSV template could not be saved.",
    );
  });
});
